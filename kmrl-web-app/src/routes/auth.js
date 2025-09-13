/**
 * Authentication Routes
 * 
 * This module handles user authentication, registration, and profile management
 * for the KMRL fleet management system.
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, query } = require('express-validator');

// Middleware and utilities
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { handleValidationErrors } = require('../middleware/errorHandler');
const { requireAuth, generateToken, refreshToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const { dbOperations } = require('../config/firebase');

/**
 * POST /auth/login
 * User login
 */
router.post('/login',
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    
    logger.info('Login attempt', { email, ip: req.ip });
    
    // Find user by email
    const users = await dbOperations.query('users', [['email', '==', email]]);
    
    if (users.length === 0) {
      logger.security('Login attempt with non-existent email', { email, ip: req.ip });
      throw new AppError('Invalid credentials', 401, 'AUTHENTICATION_ERROR');
    }
    
    const user = users[0];
    
    // Check if user is active
    if (user.status !== 'active') {
      logger.security('Login attempt with inactive account', { email, ip: req.ip });
      throw new AppError('Account is inactive', 401, 'AUTHENTICATION_ERROR');
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      logger.security('Login attempt with invalid password', { email, ip: req.ip });
      throw new AppError('Invalid credentials', 401, 'AUTHENTICATION_ERROR');
    }
    
    // Generate JWT token
    const token = generateToken(user);
    
    // Update last login
    await dbOperations.update('users', user.id, {
      last_login: new Date().toISOString(),
      login_count: (user.login_count || 0) + 1
    });
    
    logger.info('User logged in successfully', {
      userId: user.id,
      email: user.email,
      role: user.role,
      ip: req.ip
    });
    
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          userId: user.user_id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          permissions: user.permissions || [],
          lastLogin: user.last_login
        }
      },
      message: 'Login successful'
    });
  })
);

/**
 * POST /auth/register
 * User registration (admin only in production)
 */
router.post('/register',
  [
    body('name')
      .notEmpty()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must be at least 8 characters with uppercase, lowercase, number, and special character'),
    body('role')
      .isIn(['operator', 'supervisor', 'admin'])
      .withMessage('Role must be operator, supervisor, or admin'),
    body('department')
      .isIn(['operations', 'maintenance', 'planning', 'administration'])
      .withMessage('Invalid department'),
    body('userId')
      .notEmpty()
      .matches(/^user\d{3}$/)
      .withMessage('User ID must be in format user### (e.g., user001)')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { name, email, password, role, department, userId } = req.body;
    
    logger.info('Registration attempt', { email, role, department, ip: req.ip });
    
    // Check if email already exists
    const existingEmailUsers = await dbOperations.query('users', [['email', '==', email]]);
    if (existingEmailUsers.length > 0) {
      throw new AppError('Email already registered', 409, 'CONFLICT');
    }
    
    // Check if userId already exists
    const existingUserIdUsers = await dbOperations.query('users', [['user_id', '==', userId]]);
    if (existingUserIdUsers.length > 0) {
      throw new AppError('User ID already exists', 409, 'CONFLICT');
    }
    
    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Create user
    const userData = {
      user_id: userId,
      name,
      email,
      password_hash: passwordHash,
      role,
      department,
      status: 'active',
      permissions: getDefaultPermissions(role),
      created_at: new Date().toISOString(),
      login_count: 0
    };
    
    const newUser = await dbOperations.create('users', userData);
    
    logger.info('User registered successfully', {
      userId: newUser.id,
      email,
      role,
      department
    });
    
    // Generate token for immediate login
    const token = generateToken(newUser);
    
    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: newUser.id,
          userId: newUser.user_id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          department: newUser.department,
          permissions: newUser.permissions
        }
      },
      message: 'Registration successful'
    });
  })
);

/**
 * POST /auth/logout
 * User logout
 */
router.post('/logout',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    
    // Update last logout time
    await dbOperations.update('users', userId, {
      last_logout: new Date().toISOString()
    });
    
    logger.info('User logged out', {
      userId,
      ip: req.ip
    });
    
    res.json({
      success: true,
      message: 'Logout successful'
    });
  })
);

/**
 * GET /auth/profile
 * Get user profile
 */
router.get('/profile',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await dbOperations.read('users', req.user.id);
    
    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }
    
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          userId: user.user_id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          permissions: user.permissions || [],
          status: user.status,
          lastLogin: user.last_login,
          loginCount: user.login_count || 0,
          createdAt: user.created_at
        }
      }
    });
  })
);

/**
 * PUT /auth/profile
 * Update user profile
 */
router.put('/profile',
  requireAuth,
  [
    body('name')
      .optional()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),
    body('email')
      .optional()
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('currentPassword')
      .optional()
      .notEmpty()
      .withMessage('Current password is required when updating password'),
    body('newPassword')
      .optional()
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('New password must meet security requirements')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { name, email, currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    
    const user = await dbOperations.read('users', userId);
    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }
    
    const updateData = {};
    
    // Update name
    if (name && name !== user.name) {
      updateData.name = name;
    }
    
    // Update email
    if (email && email !== user.email) {
      // Check if new email is available
      const existingUsers = await dbOperations.query('users', [['email', '==', email]]);
      if (existingUsers.length > 0 && existingUsers[0].id !== userId) {
        throw new AppError('Email already in use', 409, 'CONFLICT');
      }
      updateData.email = email;
    }
    
    // Update password
    if (newPassword) {
      if (!currentPassword) {
        throw new AppError('Current password is required', 400, 'VALIDATION_ERROR');
      }
      
      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isCurrentPasswordValid) {
        throw new AppError('Current password is incorrect', 400, 'VALIDATION_ERROR');
      }
      
      // Hash new password
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
      updateData.password_hash = await bcrypt.hash(newPassword, saltRounds);
    }
    
    // Update user
    if (Object.keys(updateData).length > 0) {
      await dbOperations.update('users', userId, updateData);
      
      logger.info('User profile updated', {
        userId,
        updatedFields: Object.keys(updateData),
        ip: req.ip
      });
    }
    
    // Get updated user data
    const updatedUser = await dbOperations.read('users', userId);
    
    res.json({
      success: true,
      data: {
        user: {
          id: updatedUser.id,
          userId: updatedUser.user_id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          department: updatedUser.department,
          permissions: updatedUser.permissions || []
        }
      },
      message: 'Profile updated successfully'
    });
  })
);

/**
 * POST /auth/refresh
 * Refresh JWT token
 */
router.post('/refresh', refreshToken);

/**
 * POST /auth/forgot-password
 * Initiate password reset
 */
router.post('/forgot-password',
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    
    logger.info('Password reset requested', { email, ip: req.ip });
    
    // Find user by email
    const users = await dbOperations.query('users', [['email', '==', email]]);
    
    // Always return success to prevent email enumeration
    res.json({
      success: true,
      message: 'If the email exists, a password reset link has been sent'
    });
    
    if (users.length === 0) {
      logger.security('Password reset attempted for non-existent email', { email, ip: req.ip });
      return;
    }
    
    const user = users[0];
    
    // Generate reset token (simplified - in production, use crypto.randomBytes)
    const resetToken = require('crypto').randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes
    
    // Save reset token
    await dbOperations.update('users', user.id, {
      reset_token: resetToken,
      reset_expires: resetExpires
    });
    
    // In a real implementation, send email here
    logger.info('Password reset token generated', {
      userId: user.id,
      email: user.email,
      resetToken: resetToken.substring(0, 8) + '...' // Log partial token for debugging
    });
  })
);

/**
 * GET /auth/verify-reset-token
 * Verify password reset token
 */
router.get('/verify-reset-token',
  [
    query('token')
      .notEmpty()
      .withMessage('Reset token is required')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { token } = req.query;
    
    const users = await dbOperations.query('users', [
      ['reset_token', '==', token]
    ]);
    
    if (users.length === 0) {
      throw new AppError('Invalid reset token', 400, 'VALIDATION_ERROR');
    }
    
    const user = users[0];
    
    // Check if token is expired
    if (new Date() > new Date(user.reset_expires)) {
      throw new AppError('Reset token has expired', 400, 'VALIDATION_ERROR');
    }
    
    res.json({
      success: true,
      data: {
        email: user.email,
        userId: user.user_id
      },
      message: 'Reset token is valid'
    });
  })
);

/**
 * POST /auth/reset-password
 * Reset password with token
 */
router.post('/reset-password',
  [
    body('token')
      .notEmpty()
      .withMessage('Reset token is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must meet security requirements')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body;
    
    const users = await dbOperations.query('users', [
      ['reset_token', '==', token]
    ]);
    
    if (users.length === 0) {
      throw new AppError('Invalid reset token', 400, 'VALIDATION_ERROR');
    }
    
    const user = users[0];
    
    // Check if token is expired
    if (new Date() > new Date(user.reset_expires)) {
      throw new AppError('Reset token has expired', 400, 'VALIDATION_ERROR');
    }
    
    // Hash new password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);
    
    // Update password and clear reset token
    await dbOperations.update('users', user.id, {
      password_hash: passwordHash,
      reset_token: null,
      reset_expires: null,
      password_changed_at: new Date().toISOString()
    });
    
    logger.info('Password reset completed', {
      userId: user.id,
      email: user.email,
      ip: req.ip
    });
    
    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  })
);

/**
 * Helper function to get default permissions based on role
 */
function getDefaultPermissions(role) {
  const permissions = {
    operator: [
      'view_fleet',
      'view_schedules',
      'update_trainset_status'
    ],
    supervisor: [
      'view_fleet',
      'view_schedules',
      'update_trainset_status',
      'manage_maintenance',
      'run_optimization',
      'view_reports'
    ],
    admin: [
      'view_fleet',
      'view_schedules',
      'update_trainset_status',
      'manage_maintenance',
      'run_optimization',
      'view_reports',
      'manage_users',
      'system_admin'
    ]
  };
  
  return permissions[role] || permissions.operator;
}

module.exports = router;
