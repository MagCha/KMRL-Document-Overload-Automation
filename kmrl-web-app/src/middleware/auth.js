/**
 * Authentication Middleware
 * 
 * This module provides authentication and authorization middleware
 * for the KMRL fleet management system.
 */

const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');
const { dbOperations } = require('../config/firebase');
const logger = require('../utils/logger');
const { getConfig } = require('../utils/validation');

/**
 * Authentication middleware
 */
async function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);
    
    if (!token) {
      throw new AppError('Authentication required', 401, 'AUTHENTICATION_ERROR');
    }
    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await dbOperations.read('users', decoded.userId);
    
    if (!user) {
      throw new AppError('User not found', 401, 'AUTHENTICATION_ERROR');
    }
    
    if (user.status === 'inactive') {
      throw new AppError('Account is inactive', 401, 'AUTHENTICATION_ERROR');
    }
    
    // Attach user to request
    req.user = {
      id: user.id,
      userId: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      permissions: user.permissions || []
    };
    
    // Log authentication
    logger.info('User authenticated', {
      userId: user.id,
      role: user.role,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      logger.security('Invalid JWT token attempted', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        error: error.message
      });
      return next(new AppError('Invalid token', 401, 'AUTHENTICATION_ERROR'));
    }
    
    if (error.name === 'TokenExpiredError') {
      logger.security('Expired JWT token attempted', {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return next(new AppError('Token expired', 401, 'AUTHENTICATION_ERROR'));
    }
    
    next(error);
  }
}

/**
 * Optional authentication middleware
 */
async function optionalAuth(req, res, next) {
  try {
    const token = extractToken(req);
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await dbOperations.read('users', decoded.userId);
      
      if (user && user.status === 'active') {
        req.user = {
          id: user.id,
          userId: user.user_id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          permissions: user.permissions || []
        };
      }
    }
    
    next();
  } catch (error) {
    // For optional auth, we don't fail on invalid tokens
    next();
  }
}

/**
 * Role-based authorization middleware
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'AUTHENTICATION_ERROR'));
    }
    
    if (!roles.includes(req.user.role)) {
      logger.security('Unauthorized role access attempted', {
        userId: req.user.id,
        requiredRoles: roles,
        userRole: req.user.role,
        ip: req.ip,
        path: req.path
      });
      
      return next(new AppError('Insufficient permissions', 403, 'AUTHORIZATION_ERROR'));
    }
    
    next();
  };
}

/**
 * Permission-based authorization middleware
 */
function requirePermission(...permissions) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'AUTHENTICATION_ERROR'));
    }
    
    const userPermissions = req.user.permissions || [];
    const hasPermission = permissions.some(permission => 
      userPermissions.includes(permission) || req.user.role === 'admin'
    );
    
    if (!hasPermission) {
      logger.security('Unauthorized permission access attempted', {
        userId: req.user.id,
        requiredPermissions: permissions,
        userPermissions,
        ip: req.ip,
        path: req.path
      });
      
      return next(new AppError('Insufficient permissions', 403, 'AUTHORIZATION_ERROR'));
    }
    
    next();
  };
}

/**
 * Department-based authorization middleware
 */
function requireDepartment(...departments) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'AUTHENTICATION_ERROR'));
    }
    
    if (!departments.includes(req.user.department) && req.user.role !== 'admin') {
      logger.security('Unauthorized department access attempted', {
        userId: req.user.id,
        requiredDepartments: departments,
        userDepartment: req.user.department,
        ip: req.ip,
        path: req.path
      });
      
      return next(new AppError('Department access denied', 403, 'AUTHORIZATION_ERROR'));
    }
    
    next();
  };
}

/**
 * Resource ownership middleware
 */
function requireOwnership(resourceIdParam = 'id') {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new AppError('Authentication required', 401, 'AUTHENTICATION_ERROR'));
      }
      
      // Admin can access any resource
      if (req.user.role === 'admin') {
        return next();
      }
      
      const resourceId = req.params[resourceIdParam];
      
      // Check resource ownership logic here
      // This is a simplified version - you'd implement specific ownership checks
      // based on your data model and business rules
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Rate limiting per user
 */
function userRateLimit(maxRequests = 100, windowMs = 15 * 60 * 1000) {
  const userRequests = new Map();
  
  return (req, res, next) => {
    if (!req.user) {
      return next();
    }
    
    const userId = req.user.id;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Get user's request history
    let requests = userRequests.get(userId) || [];
    
    // Remove old requests outside the window
    requests = requests.filter(timestamp => timestamp > windowStart);
    
    // Check if user has exceeded the limit
    if (requests.length >= maxRequests) {
      logger.security('User rate limit exceeded', {
        userId,
        requestCount: requests.length,
        maxRequests,
        ip: req.ip
      });
      
      return next(new AppError('Too many requests', 429, 'RATE_LIMIT_EXCEEDED'));
    }
    
    // Add current request
    requests.push(now);
    userRequests.set(userId, requests);
    
    next();
  };
}

/**
 * Extract token from request
 */
function extractToken(req) {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Check query parameter (for WebSocket connections)
  if (req.query.token) {
    return req.query.token;
  }
  
  // Check cookie (optional)
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  
  return null;
}

/**
 * Generate JWT token
 */
function generateToken(user) {
  const config = getConfig();
  
  const payload = {
    userId: user.id,
    role: user.role,
    department: user.department,
    iat: Math.floor(Date.now() / 1000)
  };
  
  return jwt.sign(payload, config.security.jwtSecret, {
    expiresIn: config.security.jwtExpiresIn,
    issuer: 'kmrl-fleet-management',
    audience: 'kmrl-users'
  });
}

/**
 * Verify and refresh token
 */
async function refreshToken(req, res, next) {
  try {
    const token = extractToken(req);
    
    if (!token) {
      return next(new AppError('Token required for refresh', 401, 'AUTHENTICATION_ERROR'));
    }
    
    // Verify current token
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
    
    // Check if token is close to expiry (within 1 hour)
    const now = Math.floor(Date.now() / 1000);
    const tokenExp = decoded.exp;
    const timeToExpiry = tokenExp - now;
    
    if (timeToExpiry > 3600) {
      // Token still has more than 1 hour, no need to refresh
      return res.json({
        success: true,
        message: 'Token still valid',
        timeToExpiry
      });
    }
    
    // Get fresh user data
    const user = await dbOperations.read('users', decoded.userId);
    
    if (!user || user.status !== 'active') {
      return next(new AppError('User not found or inactive', 401, 'AUTHENTICATION_ERROR'));
    }
    
    // Generate new token
    const newToken = generateToken(user);
    
    logger.info('Token refreshed', {
      userId: user.id,
      oldExpiry: new Date(tokenExp * 1000).toISOString(),
      ip: req.ip
    });
    
    res.json({
      success: true,
      data: {
        token: newToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department
        }
      },
      message: 'Token refreshed successfully'
    });
    
  } catch (error) {
    next(error);
  }
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireRole,
  requirePermission,
  requireDepartment,
  requireOwnership,
  userRateLimit,
  generateToken,
  refreshToken,
  extractToken
};
