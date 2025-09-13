/**
 * Environment Validation Utilities
 * 
 * This module validates required environment variables and
 * provides configuration validation for the application.
 */

const logger = require('./logger');

/**
 * Required environment variables
 */
const REQUIRED_ENV_VARS = [
  'NODE_ENV',
  'PORT',
  'FIREBASE_PROJECT_ID',
  'GEMINI_API_KEY',
  'JWT_SECRET'
];

/**
 * Optional environment variables with default values
 */
const OPTIONAL_ENV_VARS = {
  HOST: 'localhost',
  API_VERSION: 'v1',
  LOG_LEVEL: 'info',
  RATE_LIMIT_WINDOW_MS: '900000',
  RATE_LIMIT_MAX_REQUESTS: '100',
  BCRYPT_ROUNDS: '12',
  JWT_EXPIRES_IN: '24h',
  MAX_FILE_SIZE: '5242880',
  CORS_ORIGIN: 'http://localhost:3001'
};

/**
 * Validate environment variables
 */
function validateEnvironment() {
  const missing = [];
  
  // Check required variables
  REQUIRED_ENV_VARS.forEach(envVar => {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  });
  
  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    logger.error('Please check your .env file and ensure all required variables are set.');
    process.exit(1);
  }
  
  // Set default values for optional variables
  Object.entries(OPTIONAL_ENV_VARS).forEach(([key, defaultValue]) => {
    if (!process.env[key]) {
      process.env[key] = defaultValue;
      logger.info(`Using default value for ${key}: ${defaultValue}`);
    }
  });
  
  // Validate specific formats
  validateSpecificFormats();
  
  logger.info('Environment validation completed successfully');
}

/**
 * Validate specific environment variable formats
 */
function validateSpecificFormats() {
  // Validate PORT
  const port = parseInt(process.env.PORT);
  if (isNaN(port) || port < 1 || port > 65535) {
    logger.error('PORT must be a valid number between 1 and 65535');
    process.exit(1);
  }
  
  // Validate LOG_LEVEL
  const validLogLevels = ['error', 'warn', 'info', 'debug'];
  if (!validLogLevels.includes(process.env.LOG_LEVEL)) {
    logger.warn(`Invalid LOG_LEVEL: ${process.env.LOG_LEVEL}. Using 'info' as default.`);
    process.env.LOG_LEVEL = 'info';
  }
  
  // Validate BCRYPT_ROUNDS
  const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS);
  if (isNaN(bcryptRounds) || bcryptRounds < 10 || bcryptRounds > 15) {
    logger.warn('BCRYPT_ROUNDS should be between 10 and 15. Using default value of 12.');
    process.env.BCRYPT_ROUNDS = '12';
  }
  
  // Validate MAX_FILE_SIZE
  const maxFileSize = parseInt(process.env.MAX_FILE_SIZE);
  if (isNaN(maxFileSize) || maxFileSize < 1024) {
    logger.warn('MAX_FILE_SIZE should be at least 1KB. Using default value of 5MB.');
    process.env.MAX_FILE_SIZE = '5242880';
  }
  
  // Validate JWT_SECRET length
  if (process.env.JWT_SECRET.length < 32) {
    logger.error('JWT_SECRET must be at least 32 characters long for security');
    process.exit(1);
  }
}

/**
 * Get configuration object
 */
function getConfig() {
  return {
    server: {
      port: parseInt(process.env.PORT),
      host: process.env.HOST,
      environment: process.env.NODE_ENV
    },
    
    firebase: {
      projectId: process.env.FIREBASE_PROJECT_ID,
      serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
      databaseUrl: process.env.FIREBASE_DATABASE_URL
    },
    
    security: {
      jwtSecret: process.env.JWT_SECRET,
      jwtExpiresIn: process.env.JWT_EXPIRES_IN,
      bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS),
      corsOrigin: process.env.CORS_ORIGIN
    },
    
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS),
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS)
    },
    
    upload: {
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE),
      uploadDir: process.env.UPLOAD_DIR || './uploads'
    },
    
    ai: {
      geminiApiKey: process.env.GEMINI_API_KEY
    },
    
    optimization: {
      pythonPath: process.env.PYTHON_PATH || 'python',
      scriptPath: process.env.OPTIMIZATION_SCRIPT_PATH || '../Optimization_Engine/optimization_engine_v3.py',
      cacheTtl: parseInt(process.env.OPTIMIZATION_CACHE_TTL) || 3600,
      maxHistory: parseInt(process.env.MAX_OPTIMIZATION_HISTORY) || 50
    },
    
    logging: {
      level: process.env.LOG_LEVEL,
      file: process.env.LOG_FILE || './logs/app.log'
    },
    
    api: {
      version: process.env.API_VERSION,
      basePath: `/api/${process.env.API_VERSION}`
    }
  };
}

/**
 * Validate Firebase configuration
 */
async function validateFirebaseConfig() {
  try {
    const config = getConfig().firebase;
    
    if (!config.projectId) {
      throw new Error('Firebase project ID is required');
    }
    
    // Additional Firebase validation can be added here
    logger.info('Firebase configuration validated');
    return true;
  } catch (error) {
    logger.error('Firebase configuration validation failed:', error);
    return false;
  }
}

/**
 * Validate AI configuration
 */
function validateAIConfig() {
  try {
    const config = getConfig().ai;
    
    if (!config.geminiApiKey || config.geminiApiKey === 'your_gemini_api_key_here') {
      throw new Error('Valid Gemini API key is required for AI features');
    }
    
    logger.info('AI configuration validated');
    return true;
  } catch (error) {
    logger.error('AI configuration validation failed:', error);
    return false;
  }
}

module.exports = {
  validateEnvironment,
  getConfig,
  validateFirebaseConfig,
  validateAIConfig
};
