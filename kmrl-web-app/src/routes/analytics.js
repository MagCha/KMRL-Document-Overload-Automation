/**
 * Analytics Routes
 * 
 * This module provides analytics and reporting endpoints for the
 * KMRL fleet management system.
 */

const express = require('express');
const router = express.Router();

// Middleware and utilities
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth, requirePermission } = require('../middleware/auth');
const logger = require('../utils/logger');
const { dbOperations } = require('../config/firebase');

/**
 * GET /analytics/dashboard
 * Get dashboard analytics data
 */
router.get('/dashboard',
  requireAuth,
  requirePermission('view_reports'),
  asyncHandler(async (req, res) => {
    const [fleetMetrics, performanceMetrics, optimizationMetrics] = await Promise.all([
      getFleetMetrics(),
      getPerformanceMetrics(),
      getOptimizationMetrics()
    ]);

    res.json({
      success: true,
      data: {
        fleet: fleetMetrics,
        performance: performanceMetrics,
        optimization: optimizationMetrics,
        timestamp: new Date().toISOString()
      }
    });
  })
);

/**
 * GET /analytics/performance
 * Get performance analytics
 */
router.get('/performance',
  requireAuth,
  requirePermission('view_reports'),
  asyncHandler(async (req, res) => {
    const performanceData = await getDetailedPerformanceMetrics();

    res.json({
      success: true,
      data: performanceData
    });
  })
);

/**
 * GET /analytics/reports
 * Get available reports
 */
router.get('/reports',
  requireAuth,
  requirePermission('view_reports'),
  asyncHandler(async (req, res) => {
    const reports = [
      {
        id: 'fleet_utilization',
        name: 'Fleet Utilization Report',
        description: 'Comprehensive fleet utilization analysis',
        type: 'fleet'
      },
      {
        id: 'maintenance_summary',
        name: 'Maintenance Summary',
        description: 'Maintenance activities and scheduling',
        type: 'maintenance'
      },
      {
        id: 'optimization_performance',
        name: 'Optimization Performance',
        description: 'Analysis of optimization results and improvements',
        type: 'optimization'
      }
    ];

    res.json({
      success: true,
      data: { reports }
    });
  })
);

// Helper functions
async function getFleetMetrics() {
  const trainsets = await dbOperations.getAll('trainsets');
  
  return {
    total: trainsets.length,
    operational: trainsets.filter(t => t.status === 'operational').length,
    maintenance: trainsets.filter(t => t.status === 'maintenance').length,
    out_of_service: trainsets.filter(t => t.status === 'out_of_service').length,
    availability: (trainsets.filter(t => t.status === 'operational').length / trainsets.length) * 100
  };
}

async function getPerformanceMetrics() {
  // Mock performance data - in real implementation, this would come from operational systems
  return {
    efficiency: 87.5,
    punctuality: 92.3,
    energy_efficiency: 89.1,
    passenger_satisfaction: 88.7
  };
}

async function getOptimizationMetrics() {
  const optimizations = await dbOperations.query('optimization_history', [], ['createdAt', 'desc'], 10);
  
  const completed = optimizations.filter(o => o.status === 'completed');
  
  return {
    total_runs: optimizations.length,
    success_rate: optimizations.length > 0 ? (completed.length / optimizations.length) * 100 : 0,
    average_improvement: 15.2, // Mock data
    last_run: optimizations.length > 0 ? optimizations[0].createdAt : null
  };
}

async function getDetailedPerformanceMetrics() {
  // This would integrate with real operational data
  return {
    efficiency_trend: [85, 87, 86, 88, 87, 89, 87],
    punctuality_trend: [90, 92, 91, 93, 92, 94, 92],
    utilization_by_trainset: generateMockUtilizationData(),
    maintenance_compliance: 94.5,
    cost_efficiency: 78.2
  };
}

function generateMockUtilizationData() {
  const data = [];
  for (let i = 1; i <= 25; i++) {
    data.push({
      trainset_id: `TS${i.toString().padStart(3, '0')}`,
      utilization: Math.random() * 30 + 70,
      mileage: Math.random() * 100 + 150,
      efficiency: Math.random() * 20 + 80
    });
  }
  return data;
}

module.exports = router;
