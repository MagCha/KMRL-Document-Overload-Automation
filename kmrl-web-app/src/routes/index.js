/**
 * Main Routes Configuration
 * 
 * This module sets up all API routes for the KMRL fleet management system.
 */

const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth');
const optimizationRoutes = require('./optimization');
const chatbotRoutes = require('./chatbot');
const fleetRoutes = require('./fleet');
const analyticsRoutes = require('./analytics');
const notificationRoutes = require('./notifications');

// Middleware
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// API documentation endpoint
router.get('/docs', asyncHandler(async (req, res) => {
  res.json({
    name: 'KMRL Fleet Management System API',
    version: '1.0.0',
    description: 'AI-driven fleet induction planning system for Kochi Metro Rail Limited',
    endpoints: {
      auth: {
        base: '/auth',
        description: 'Authentication and user management',
        endpoints: [
          'POST /auth/login',
          'POST /auth/register',
          'POST /auth/logout',
          'GET /auth/profile',
          'PUT /auth/profile'
        ]
      },
      optimization: {
        base: '/optimization',
        description: 'Fleet optimization and scheduling',
        endpoints: [
          'POST /optimization/schedule',
          'GET /optimization/history',
          'GET /optimization/results/:id',
          'POST /optimization/validate'
        ]
      },
      chatbot: {
        base: '/chatbot',
        description: 'AI chatbot for fleet queries',
        endpoints: [
          'POST /chatbot/chat',
          'GET /chatbot/history',
          'POST /chatbot/feedback'
        ]
      },
      fleet: {
        base: '/fleet',
        description: 'Fleet data management',
        endpoints: [
          'GET /fleet/trainsets',
          'GET /fleet/trainsets/:id',
          'PUT /fleet/trainsets/:id',
          'GET /fleet/status',
          'GET /fleet/maintenance'
        ]
      },
      analytics: {
        base: '/analytics',
        description: 'Fleet analytics and reporting',
        endpoints: [
          'GET /analytics/dashboard',
          'GET /analytics/performance',
          'GET /analytics/reports'
        ]
      },
      notifications: {
        base: '/notifications',
        description: 'System notifications',
        endpoints: [
          'GET /notifications',
          'PUT /notifications/:id/read',
          'DELETE /notifications/:id'
        ]
      }
    },
    authentication: {
      type: 'JWT Bearer Token',
      header: 'Authorization: Bearer <token>'
    },
    responseFormat: {
      success: {
        success: true,
        data: {},
        message: 'Success message',
        timestamp: 'ISO timestamp'
      },
      error: {
        error: {
          message: 'Error message',
          code: 'ERROR_CODE',
          timestamp: 'ISO timestamp'
        }
      }
    }
  });
}));

// Health check endpoint
router.get('/health', asyncHandler(async (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      optimization: 'available',
      ai: 'available'
    }
  });
}));

// Route mounting
router.use('/auth', authRoutes);
router.use('/optimization', optimizationRoutes);
router.use('/chatbot', chatbotRoutes);
router.use('/fleet', fleetRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/notifications', notificationRoutes);

// API statistics endpoint
router.get('/stats', asyncHandler(async (req, res) => {
  // This could be enhanced with actual statistics
  res.json({
    totalEndpoints: 25,
    activeConnections: 0, // This would come from WebSocket connections
    lastOptimization: null, // This would come from optimization history
    systemUptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
}));

module.exports = router;
