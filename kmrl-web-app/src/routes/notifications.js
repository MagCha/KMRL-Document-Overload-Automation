/**
 * Notification Routes
 * 
 * This module handles system notifications and alerts
 * for the KMRL fleet management system.
 */

const express = require('express');
const router = express.Router();

// Middleware and utilities
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth } = require('../middleware/auth');
const { dbOperations } = require('../config/firebase');

/**
 * GET /notifications
 * Get user notifications
 */
router.get('/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const notifications = await dbOperations.query('notifications', [
      ['userId', '==', req.user.id]
    ], ['created_at', 'desc'], 20);

    res.json({
      success: true,
      data: {
        notifications,
        unread_count: notifications.filter(n => !n.read).length
      }
    });
  })
);

/**
 * PUT /notifications/:id/read
 * Mark notification as read
 */
router.put('/:id/read',
  requireAuth,
  asyncHandler(async (req, res) => {
    await dbOperations.update('notifications', req.params.id, {
      read: true,
      read_at: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  })
);

module.exports = router;
