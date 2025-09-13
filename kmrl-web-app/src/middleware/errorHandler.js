/**
 * Global Error Handler Middleware
 * 
 * This module provides comprehensive error handling for the KMRL
 * fleet management system, including proper logging and response formatting.
 */

const logger = require('../utils/logger');

/**
 * Custom error classes
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409, 'CONFLICT');
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

/**
 * Format error response
 */
function formatErrorResponse(error, req) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const response = {
    error: {
      message: error.message,
      code: error.code || 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
      requestId: req.id || req.headers['x-request-id']
    }
  };
  
  // Add validation errors if present
  if (error.errors && Array.isArray(error.errors)) {
    response.error.details = error.errors;
  }
  
  // Add stack trace in development
  if (isDevelopment && error.stack) {
    response.error.stack = error.stack;
  }
  
  // Add request context in development
  if (isDevelopment) {
    response.error.request = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      params: req.params,
      query: req.query
    };
  }
  
  return response;
}

/**
 * Log error with context
 */
function logError(error, req, res) {
  const context = {
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    requestId: req.id || req.headers['x-request-id']
  };
  
  if (error.statusCode >= 500) {
    logger.errorWithContext(error, context);
  } else if (error.statusCode >= 400) {
    logger.warn(`Client error: ${error.message}`, context);
  } else {
    logger.info(`Request processed: ${error.message}`, context);
  }
  
  // Log security-related errors
  if (error.code === 'AUTHENTICATION_ERROR' || error.code === 'AUTHORIZATION_ERROR') {
    logger.security(`Security error: ${error.message}`, context);
  }
}

/**
 * Handle specific error types
 */
function handleSpecificErrors(error) {
  // MongoDB/Mongoose errors
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(err => ({
      field: err.path,
      message: err.message,
      value: err.value
    }));
    return new ValidationError('Validation failed', errors);
  }
  
  if (error.name === 'CastError') {
    return new ValidationError(`Invalid ${error.path}: ${error.value}`);
  }
  
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    return new ConflictError(`${field} already exists`);
  }
  
  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return new AuthenticationError('Invalid token');
  }
  
  if (error.name === 'TokenExpiredError') {
    return new AuthenticationError('Token expired');
  }
  
  // Firebase errors
  if (error.code && error.code.startsWith('auth/')) {
    return new AuthenticationError('Authentication failed');
  }
  
  if (error.code && error.code.startsWith('permission-denied')) {
    return new AuthorizationError('Permission denied');
  }
  
  // File upload errors
  if (error.code === 'LIMIT_FILE_SIZE') {
    return new ValidationError('File size too large');
  }
  
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return new ValidationError('Unexpected file field');
  }
  
  // Python/Optimization errors
  if (error.message && error.message.includes('python')) {
    return new AppError('Optimization engine error', 500, 'OPTIMIZATION_ERROR');
  }
  
  return error;
}

/**
 * Main error handler middleware
 */
function errorHandler(error, req, res, next) {
  // Handle specific error types
  let handledError = handleSpecificErrors(error);
  
  // Ensure error has required properties
  if (!handledError.statusCode) {
    handledError = new AppError(
      handledError.message || 'Internal server error',
      500,
      'INTERNAL_ERROR'
    );
  }
  
  // Set response status
  res.status(handledError.statusCode);
  
  // Log error
  logError(handledError, req, res);
  
  // Send error response
  const errorResponse = formatErrorResponse(handledError, req);
  res.json(errorResponse);
}

/**
 * Async error wrapper
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 handler
 */
function notFoundHandler(req, res, next) {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
}

/**
 * Validation error handler for express-validator
 */
function handleValidationErrors(req, res, next) {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const validationErrors = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
      location: error.location
    }));
    
    const error = new ValidationError('Validation failed', validationErrors);
    return next(error);
  }
  
  next();
}

module.exports = {
  errorHandler,
  asyncHandler,
  notFoundHandler,
  handleValidationErrors,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError
};
