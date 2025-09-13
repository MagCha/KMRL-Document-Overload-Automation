/**
 * Fleet Management Routes
 * 
 * This module handles fleet data management endpoints including
 * trainset information, status updates, and operational data.
 */

const express = require('express');
const router = express.Router();
const { param, query, body } = require('express-validator');

// Middleware and utilities
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { handleValidationErrors } = require('../middleware/errorHandler');
const { requireAuth, requirePermission } = require('../middleware/auth');
const logger = require('../utils/logger');
const { dbOperations } = require('../config/firebase');

/**
 * GET /fleet/trainsets
 * Get all trainsets with optional filtering
 */
router.get('/trainsets',
  requireAuth,
  requirePermission('view_fleet'),
  [
    query('status')
      .optional()
      .isIn(['operational', 'maintenance', 'out_of_service'])
      .withMessage('Invalid status filter'),
    query('location')
      .optional()
      .isString()
      .withMessage('Location must be a string'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { status, location, limit = 50 } = req.query;
    
    const filters = [];
    if (status) filters.push(['status', '==', status]);
    if (location) filters.push(['current_location', '==', location]);
    
    const trainsets = await dbOperations.query('trainsets', filters, ['trainset_id', 'asc'], parseInt(limit));
    
    // Enrich with maintenance and branding information
    const enrichedTrainsets = await Promise.all(
      trainsets.map(async (trainset) => {
        const [maintenanceInfo, brandingInfo] = await Promise.all([
          getTrainsetMaintenance(trainset.trainset_id),
          getTrainsetBranding(trainset.trainset_id)
        ]);
        
        return {
          ...trainset,
          maintenance: maintenanceInfo,
          branding: brandingInfo
        };
      })
    );
    
    res.json({
      success: true,
      data: {
        trainsets: enrichedTrainsets,
        count: enrichedTrainsets.length,
        filters: { status, location }
      }
    });
  })
);

/**
 * GET /fleet/trainsets/:id
 * Get specific trainset details
 */
router.get('/trainsets/:id',
  requireAuth,
  requirePermission('view_fleet'),
  [
    param('id')
      .matches(/^TS\d{3}$/)
      .withMessage('Trainset ID must be in format TS### (e.g., TS001)')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const trainsets = await dbOperations.query('trainsets', [['trainset_id', '==', id]]);
    
    if (trainsets.length === 0) {
      throw new AppError('Trainset not found', 404, 'NOT_FOUND');
    }
    
    const trainset = trainsets[0];
    
    // Get comprehensive information
    const [maintenanceHistory, brandingInfo, utilizationData, currentSchedule] = await Promise.all([
      getTrainsetMaintenanceHistory(id),
      getTrainsetBranding(id),
      getTrainsetUtilization(id),
      getTrainsetCurrentSchedule(id)
    ]);
    
    const enrichedTrainset = {
      ...trainset,
      maintenance: {
        current: await getTrainsetMaintenance(id),
        history: maintenanceHistory
      },
      branding: brandingInfo,
      utilization: utilizationData,
      schedule: currentSchedule
    };
    
    res.json({
      success: true,
      data: {
        trainset: enrichedTrainset
      }
    });
  })
);

/**
 * PUT /fleet/trainsets/:id
 * Update trainset information
 */
router.put('/trainsets/:id',
  requireAuth,
  requirePermission('update_trainset_status'),
  [
    param('id')
      .matches(/^TS\d{3}$/)
      .withMessage('Trainset ID must be in format TS### (e.g., TS001)'),
    body('status')
      .optional()
      .isIn(['operational', 'maintenance', 'out_of_service'])
      .withMessage('Invalid status'),
    body('current_location')
      .optional()
      .isString()
      .withMessage('Location must be a string'),
    body('notes')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Notes must be less than 500 characters')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, current_location, notes } = req.body;
    const userId = req.user.id;
    
    // Check if trainset exists
    const trainsets = await dbOperations.query('trainsets', [['trainset_id', '==', id]]);
    
    if (trainsets.length === 0) {
      throw new AppError('Trainset not found', 404, 'NOT_FOUND');
    }
    
    const trainset = trainsets[0];
    const updateData = {};
    
    if (status && status !== trainset.status) {
      updateData.status = status;
      updateData.status_changed_at = new Date().toISOString();
      updateData.status_changed_by = userId;
    }
    
    if (current_location && current_location !== trainset.current_location) {
      updateData.current_location = current_location;
      updateData.location_updated_at = new Date().toISOString();
    }
    
    if (notes) {
      updateData.notes = notes;
    }
    
    if (Object.keys(updateData).length === 0) {
      return res.json({
        success: true,
        message: 'No changes to update'
      });
    }
    
    // Update trainset
    await dbOperations.update('trainsets', trainset.id, updateData);
    
    // Log status change
    if (updateData.status) {
      await logTrainsetStatusChange({
        trainsetId: id,
        oldStatus: trainset.status,
        newStatus: updateData.status,
        userId,
        timestamp: updateData.status_changed_at,
        notes
      });
    }
    
    logger.info('Trainset updated', {
      trainsetId: id,
      updates: Object.keys(updateData),
      userId,
      userRole: req.user.role
    });
    
    // Get updated trainset
    const updatedTrainset = await dbOperations.read('trainsets', trainset.id);
    
    res.json({
      success: true,
      data: {
        trainset: updatedTrainset
      },
      message: 'Trainset updated successfully'
    });
  })
);

/**
 * GET /fleet/status
 * Get fleet status overview
 */
router.get('/status',
  requireAuth,
  requirePermission('view_fleet'),
  asyncHandler(async (req, res) => {
    const [trainsets, maintenanceItems, cleaningSlots] = await Promise.all([
      dbOperations.getAll('trainsets'),
      dbOperations.getAll('health_and_maintenance'),
      dbOperations.query('cleaning_slots', [
        ['date', '==', new Date().toISOString().split('T')[0]]
      ])
    ]);
    
    // Calculate status summary
    const statusSummary = {
      total: trainsets.length,
      operational: trainsets.filter(t => t.status === 'operational').length,
      maintenance: trainsets.filter(t => t.status === 'maintenance').length,
      out_of_service: trainsets.filter(t => t.status === 'out_of_service').length
    };
    
    // Calculate maintenance summary
    const maintenanceSummary = {
      total: maintenanceItems.length,
      due: maintenanceItems.filter(m => m.status === 'due').length,
      in_progress: maintenanceItems.filter(m => m.status === 'in_progress').length,
      completed_today: maintenanceItems.filter(m => 
        m.status === 'completed' && 
        m.completed_date === new Date().toISOString().split('T')[0]
      ).length
    };
    
    // Calculate cleaning summary
    const cleaningSummary = {
      scheduled_today: cleaningSlots.length,
      completed: cleaningSlots.filter(c => c.status === 'completed').length,
      in_progress: cleaningSlots.filter(c => c.status === 'in_progress').length,
      pending: cleaningSlots.filter(c => c.status === 'scheduled').length
    };
    
    // Get recent activities
    const recentActivities = await getRecentFleetActivities(10);
    
    res.json({
      success: true,
      data: {
        status: statusSummary,
        maintenance: maintenanceSummary,
        cleaning: cleaningSummary,
        efficiency: calculateFleetEfficiency(trainsets),
        recent_activities: recentActivities,
        last_updated: new Date().toISOString()
      }
    });
  })
);

/**
 * GET /fleet/maintenance
 * Get maintenance information
 */
router.get('/maintenance',
  requireAuth,
  requirePermission('manage_maintenance'),
  [
    query('status')
      .optional()
      .isIn(['due', 'in_progress', 'completed', 'overdue'])
      .withMessage('Invalid maintenance status'),
    query('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Invalid priority level'),
    query('trainset_id')
      .optional()
      .matches(/^TS\d{3}$/)
      .withMessage('Invalid trainset ID format')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { status, priority, trainset_id } = req.query;
    
    const filters = [];
    if (status) filters.push(['status', '==', status]);
    if (priority) filters.push(['priority', '==', priority]);
    if (trainset_id) filters.push(['trainset_id', '==', trainset_id]);
    
    const maintenanceItems = await dbOperations.query(
      'health_and_maintenance',
      filters,
      ['due_date', 'asc']
    );
    
    // Group by trainset and add additional information
    const maintenanceByTrainset = {};
    for (const item of maintenanceItems) {
      if (!maintenanceByTrainset[item.trainset_id]) {
        maintenanceByTrainset[item.trainset_id] = [];
      }
      maintenanceByTrainset[item.trainset_id].push(item);
    }
    
    // Calculate maintenance metrics
    const metrics = {
      total_items: maintenanceItems.length,
      overdue: maintenanceItems.filter(item => 
        new Date(item.due_date) < new Date() && item.status !== 'completed'
      ).length,
      due_this_week: maintenanceItems.filter(item => {
        const dueDate = new Date(item.due_date);
        const weekFromNow = new Date();
        weekFromNow.setDate(weekFromNow.getDate() + 7);
        return dueDate <= weekFromNow && item.status !== 'completed';
      }).length,
      critical: maintenanceItems.filter(item => item.priority === 'critical').length
    };
    
    res.json({
      success: true,
      data: {
        maintenance_items: maintenanceItems,
        by_trainset: maintenanceByTrainset,
        metrics,
        filters: { status, priority, trainset_id }
      }
    });
  })
);

/**
 * POST /fleet/maintenance/:id/complete
 * Mark maintenance item as completed
 */
router.post('/maintenance/:id/complete',
  requireAuth,
  requirePermission('manage_maintenance'),
  [
    param('id')
      .notEmpty()
      .withMessage('Maintenance ID is required'),
    body('completion_notes')
      .optional()
      .isString()
      .isLength({ max: 1000 })
      .withMessage('Completion notes must be less than 1000 characters'),
    body('actual_duration')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Actual duration must be a positive integer')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { completion_notes, actual_duration } = req.body;
    const userId = req.user.id;
    
    const maintenanceItem = await dbOperations.read('health_and_maintenance', id);
    
    if (!maintenanceItem) {
      throw new AppError('Maintenance item not found', 404, 'NOT_FOUND');
    }
    
    if (maintenanceItem.status === 'completed') {
      throw new AppError('Maintenance item already completed', 400, 'VALIDATION_ERROR');
    }
    
    // Update maintenance item
    const updateData = {
      status: 'completed',
      completed_date: new Date().toISOString(),
      completed_by: userId,
      completion_notes: completion_notes || null,
      actual_duration: actual_duration || null
    };
    
    await dbOperations.update('health_and_maintenance', id, updateData);
    
    // Update trainset status if necessary
    if (maintenanceItem.priority === 'critical') {
      await updateTrainsetAfterMaintenance(maintenanceItem.trainset_id);
    }
    
    logger.info('Maintenance completed', {
      maintenanceId: id,
      trainsetId: maintenanceItem.trainset_id,
      completedBy: userId,
      priority: maintenanceItem.priority
    });
    
    res.json({
      success: true,
      message: 'Maintenance marked as completed'
    });
  })
);

/**
 * Helper functions
 */
async function getTrainsetMaintenance(trainsetId) {
  try {
    const maintenance = await dbOperations.query('health_and_maintenance', [
      ['trainset_id', '==', trainsetId],
      ['status', '!=', 'completed']
    ]);
    
    return {
      pending: maintenance.filter(m => m.status === 'due').length,
      in_progress: maintenance.filter(m => m.status === 'in_progress').length,
      next_due: maintenance.length > 0 ? maintenance[0].due_date : null
    };
  } catch (error) {
    return { error: 'Maintenance data unavailable' };
  }
}

async function getTrainsetBranding(trainsetId) {
  try {
    const branding = await dbOperations.query('branding_priorities', [
      ['trainset_id', '==', trainsetId]
    ]);
    
    return branding.length > 0 ? branding[0] : null;
  } catch (error) {
    return null;
  }
}

async function getTrainsetMaintenanceHistory(trainsetId) {
  try {
    return await dbOperations.query('health_and_maintenance', [
      ['trainset_id', '==', trainsetId]
    ], ['created_at', 'desc'], 10);
  } catch (error) {
    return [];
  }
}

async function getTrainsetUtilization(trainsetId) {
  // This would typically come from operational data
  // For now, return mock utilization data
  return {
    daily_mileage: Math.floor(Math.random() * 200) + 100,
    utilization_rate: Math.random() * 0.3 + 0.7,
    last_service: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
  };
}

async function getTrainsetCurrentSchedule(trainsetId) {
  // This would typically come from scheduling system
  // For now, return mock schedule data
  return {
    route: `Route ${Math.floor(Math.random() * 5) + 1}`,
    shift: Math.random() > 0.5 ? 'morning' : 'evening',
    estimated_completion: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
  };
}

async function logTrainsetStatusChange(changeData) {
  try {
    await dbOperations.create('system_logs', {
      type: 'trainset_status_change',
      trainset_id: changeData.trainsetId,
      old_status: changeData.oldStatus,
      new_status: changeData.newStatus,
      changed_by: changeData.userId,
      timestamp: changeData.timestamp,
      notes: changeData.notes
    });
  } catch (error) {
    logger.error('Failed to log status change', error);
  }
}

async function getRecentFleetActivities(limit) {
  try {
    const activities = await dbOperations.query('system_logs', [
      ['type', 'in', ['trainset_status_change', 'maintenance_completed', 'optimization_run']]
    ], ['timestamp', 'desc'], limit);
    
    return activities.map(activity => ({
      id: activity.id,
      type: activity.type,
      description: formatActivityDescription(activity),
      timestamp: activity.timestamp,
      trainset_id: activity.trainset_id
    }));
  } catch (error) {
    return [];
  }
}

function formatActivityDescription(activity) {
  switch (activity.type) {
    case 'trainset_status_change':
      return `${activity.trainset_id} status changed from ${activity.old_status} to ${activity.new_status}`;
    case 'maintenance_completed':
      return `Maintenance completed for ${activity.trainset_id}`;
    case 'optimization_run':
      return `Optimization completed with ${activity.solution_count} solutions`;
    default:
      return 'Fleet activity';
  }
}

function calculateFleetEfficiency(trainsets) {
  const operational = trainsets.filter(t => t.status === 'operational').length;
  const total = trainsets.length;
  
  return {
    availability: total > 0 ? (operational / total) * 100 : 0,
    operational_count: operational,
    total_count: total
  };
}

async function updateTrainsetAfterMaintenance(trainsetId) {
  try {
    const trainsets = await dbOperations.query('trainsets', [['trainset_id', '==', trainsetId]]);
    
    if (trainsets.length > 0) {
      const trainset = trainsets[0];
      
      // Check if all critical maintenance is completed
      const criticalMaintenance = await dbOperations.query('health_and_maintenance', [
        ['trainset_id', '==', trainsetId],
        ['priority', '==', 'critical'],
        ['status', '!=', 'completed']
      ]);
      
      if (criticalMaintenance.length === 0 && trainset.status === 'maintenance') {
        await dbOperations.update('trainsets', trainset.id, {
          status: 'operational',
          status_changed_at: new Date().toISOString(),
          status_changed_by: 'system'
        });
        
        logger.info('Trainset status automatically updated to operational', {
          trainsetId,
          reason: 'critical_maintenance_completed'
        });
      }
    }
  } catch (error) {
    logger.error('Failed to update trainset after maintenance', { trainsetId, error: error.message });
  }
}

module.exports = router;
