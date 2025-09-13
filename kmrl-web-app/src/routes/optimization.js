/**
 * Optimization Routes
 * 
 * This module handles all optimization-related endpoints, including
 * running the NSGA-II optimization engine and managing optimization history.
 */

const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');

// Middleware and utilities
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { handleValidationErrors } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { dbOperations } = require('../config/firebase');

// Services
const OptimizationService = require('../services/optimizationService');
const { requireAuth } = require('../middleware/auth');

/**
 * POST /optimization/schedule
 * Run optimization for fleet scheduling
 */
router.post('/schedule',
  requireAuth,
  [
    body('date')
      .isISO8601()
      .withMessage('Date must be in ISO 8601 format'),
    body('constraints')
      .optional()
      .isObject()
      .withMessage('Constraints must be an object'),
    body('preferences')
      .optional()
      .isObject()
      .withMessage('Preferences must be an object'),
    body('mode')
      .optional()
      .isIn(['quick', 'balanced', 'comprehensive'])
      .withMessage('Mode must be quick, balanced, or comprehensive')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { date, constraints = {}, preferences = {}, mode = 'balanced' } = req.body;
    const userId = req.user.id;
    
    logger.optimization('Starting optimization request', {
      userId,
      date,
      mode,
      hasConstraints: Object.keys(constraints).length > 0,
      hasPreferences: Object.keys(preferences).length > 0
    });
    
    // Create optimization request
    const optimizationRequest = {
      userId,
      date,
      constraints,
      preferences,
      mode,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    // Save request to database
    const savedRequest = await dbOperations.create('optimization_history', optimizationRequest);
    
    try {
      // Run optimization
      const result = await OptimizationService.runOptimization({
        date,
        constraints,
        preferences,
        mode,
        requestId: savedRequest.id
      });
      
      // Update request with results
      await dbOperations.update('optimization_history', savedRequest.id, {
        status: 'completed',
        result,
        completedAt: new Date().toISOString()
      });
      
      logger.optimization('Optimization completed successfully', {
        requestId: savedRequest.id,
        userId,
        objectives: result.objectives,
        solutionCount: result.solutions?.length || 0
      });
      
      res.json({
        success: true,
        data: {
          requestId: savedRequest.id,
          result,
          status: 'completed'
        },
        message: 'Optimization completed successfully'
      });
      
    } catch (error) {
      // Update request with error
      await dbOperations.update('optimization_history', savedRequest.id, {
        status: 'failed',
        error: error.message,
        failedAt: new Date().toISOString()
      });
      
      logger.error('Optimization failed', { requestId: savedRequest.id, error: error.message });
      throw new AppError('Optimization failed: ' + error.message, 500, 'OPTIMIZATION_ERROR');
    }
  })
);

/**
 * GET /optimization/history
 * Get optimization history for the user
 */
router.get('/history',
  requireAuth,
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be non-negative'),
    query('status')
      .optional()
      .isIn(['pending', 'completed', 'failed'])
      .withMessage('Status must be pending, completed, or failed')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { limit = 20, offset = 0, status } = req.query;
    const userId = req.user.id;
    
    const filters = [['userId', '==', userId]];
    if (status) {
      filters.push(['status', '==', status]);
    }
    
    const history = await dbOperations.query(
      'optimization_history',
      filters,
      ['createdAt', 'desc'],
      parseInt(limit)
    );
    
    // Skip offset manually since Firestore doesn't support offset directly
    const paginatedHistory = history.slice(parseInt(offset));
    
    res.json({
      success: true,
      data: {
        history: paginatedHistory,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: history.length
        }
      }
    });
  })
);

/**
 * GET /optimization/results/:id
 * Get specific optimization result
 */
router.get('/results/:id',
  requireAuth,
  [
    param('id')
      .notEmpty()
      .withMessage('Optimization ID is required')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    
    const optimization = await dbOperations.read('optimization_history', id);
    
    if (!optimization) {
      throw new AppError('Optimization not found', 404, 'NOT_FOUND');
    }
    
    // Check if user owns this optimization
    if (optimization.userId !== userId && req.user.role !== 'admin') {
      throw new AppError('Access denied', 403, 'AUTHORIZATION_ERROR');
    }
    
    res.json({
      success: true,
      data: optimization
    });
  })
);

/**
 * POST /optimization/validate
 * Validate optimization parameters before running
 */
router.post('/validate',
  requireAuth,
  [
    body('date')
      .isISO8601()
      .withMessage('Date must be in ISO 8601 format'),
    body('constraints')
      .optional()
      .isObject()
      .withMessage('Constraints must be an object'),
    body('preferences')
      .optional()
      .isObject()
      .withMessage('Preferences must be an object')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { date, constraints = {}, preferences = {} } = req.body;
    
    try {
      const validation = await OptimizationService.validateParameters({
        date,
        constraints,
        preferences
      });
      
      res.json({
        success: true,
        data: validation,
        message: validation.isValid ? 'Parameters are valid' : 'Validation issues found'
      });
      
    } catch (error) {
      throw new AppError('Validation failed: ' + error.message, 400, 'VALIDATION_ERROR');
    }
  })
);

/**
 * GET /optimization/status/:id
 * Get real-time optimization status
 */
router.get('/status/:id',
  requireAuth,
  [
    param('id')
      .notEmpty()
      .withMessage('Optimization ID is required')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    
    const optimization = await dbOperations.read('optimization_history', id);
    
    if (!optimization) {
      throw new AppError('Optimization not found', 404, 'NOT_FOUND');
    }
    
    // Check if user owns this optimization
    if (optimization.userId !== userId && req.user.role !== 'admin') {
      throw new AppError('Access denied', 403, 'AUTHORIZATION_ERROR');
    }
    
    // Get detailed status from optimization service
    const detailedStatus = await OptimizationService.getOptimizationStatus(id);
    
    res.json({
      success: true,
      data: {
        id,
        status: optimization.status,
        progress: detailedStatus.progress || 0,
        currentPhase: detailedStatus.currentPhase || 'unknown',
        estimatedTimeRemaining: detailedStatus.estimatedTimeRemaining || null,
        createdAt: optimization.createdAt,
        updatedAt: optimization.updatedAt
      }
    });
  })
);

/**
 * DELETE /optimization/results/:id
 * Delete optimization result
 */
router.delete('/results/:id',
  requireAuth,
  [
    param('id')
      .notEmpty()
      .withMessage('Optimization ID is required')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    
    const optimization = await dbOperations.read('optimization_history', id);
    
    if (!optimization) {
      throw new AppError('Optimization not found', 404, 'NOT_FOUND');
    }
    
    // Check if user owns this optimization or is admin
    if (optimization.userId !== userId && req.user.role !== 'admin') {
      throw new AppError('Access denied', 403, 'AUTHORIZATION_ERROR');
    }
    
    await dbOperations.delete('optimization_history', id);
    
    logger.info('Optimization result deleted', { id, userId });
    
    res.json({
      success: true,
      message: 'Optimization result deleted successfully'
    });
  })
);

/**
 * GET /optimization/templates
 * Get optimization template configurations
 */
router.get('/templates',
  requireAuth,
  asyncHandler(async (req, res) => {
    const templates = await OptimizationService.getOptimizationTemplates();
    
    res.json({
      success: true,
      data: {
        templates,
        count: templates.length
      }
    });
  })
);

module.exports = router;
