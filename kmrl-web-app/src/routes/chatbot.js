/**
 * Chatbot Routes
 * 
 * This module handles AI chatbot interactions, including conversation
 * management and integration with Gemini AI for explainable fleet analytics.
 */

const express = require('express');
const router = express.Router();
const { body, query, param } = require('express-validator');

// Middleware and utilities
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { handleValidationErrors } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { dbOperations } = require('../config/firebase');

// Services
const ChatbotService = require('../services/chatbotService');
const { requireAuth } = require('../middleware/auth');

/**
 * POST /chatbot/chat
 * Send message to AI chatbot
 */
router.post('/chat',
  requireAuth,
  [
    body('message')
      .notEmpty()
      .withMessage('Message is required')
      .isLength({ max: 1000 })
      .withMessage('Message must be less than 1000 characters'),
    body('conversationId')
      .optional()
      .isString()
      .withMessage('Conversation ID must be a string'),
    body('context')
      .optional()
      .isObject()
      .withMessage('Context must be an object')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { message, conversationId, context = {} } = req.body;
    const userId = req.user.id;
    
    logger.info('Chatbot message received', {
      userId,
      conversationId,
      messageLength: message.length,
      hasContext: Object.keys(context).length > 0
    });
    
    try {
      // Process the message through the chatbot service
      const response = await ChatbotService.processMessage({
        message,
        userId,
        conversationId,
        context,
        userRole: req.user.role
      });
      
      // Save conversation to database
      const conversationRecord = {
        userId,
        conversationId: response.conversationId,
        userMessage: message,
        botResponse: response.response,
        context,
        timestamp: new Date().toISOString(),
        responseTime: response.responseTime,
        confidence: response.confidence || null
      };
      
      await dbOperations.create('chat_history', conversationRecord);
      
      logger.info('Chatbot response generated', {
        userId,
        conversationId: response.conversationId,
        responseLength: response.response.length,
        responseTime: response.responseTime
      });
      
      res.json({
        success: true,
        data: {
          conversationId: response.conversationId,
          response: response.response,
          suggestions: response.suggestions || [],
          analysisData: response.analysisData || null,
          responseTime: response.responseTime,
          confidence: response.confidence
        }
      });
      
    } catch (error) {
      logger.error('Chatbot processing failed', {
        userId,
        error: error.message,
        message: message.substring(0, 100)
      });
      
      throw new AppError('Failed to process message: ' + error.message, 500, 'CHATBOT_ERROR');
    }
  })
);

/**
 * GET /chatbot/history
 * Get conversation history for the user
 */
router.get('/history',
  requireAuth,
  [
    query('conversationId')
      .optional()
      .isString()
      .withMessage('Conversation ID must be a string'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be non-negative')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { conversationId, limit = 20, offset = 0 } = req.query;
    const userId = req.user.id;
    
    const filters = [['userId', '==', userId]];
    if (conversationId) {
      filters.push(['conversationId', '==', conversationId]);
    }
    
    const history = await dbOperations.query(
      'chat_history',
      filters,
      ['timestamp', 'desc'],
      parseInt(limit)
    );
    
    // Group by conversation if no specific conversation requested
    let formattedHistory;
    if (!conversationId) {
      formattedHistory = ChatbotService.groupConversationHistory(history);
    } else {
      formattedHistory = history.slice(parseInt(offset));
    }
    
    res.json({
      success: true,
      data: {
        history: formattedHistory,
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
 * POST /chatbot/feedback
 * Submit feedback for chatbot response
 */
router.post('/feedback',
  requireAuth,
  [
    body('messageId')
      .notEmpty()
      .withMessage('Message ID is required'),
    body('rating')
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be between 1 and 5'),
    body('feedback')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Feedback must be less than 500 characters'),
    body('category')
      .optional()
      .isIn(['helpful', 'accurate', 'relevant', 'complete', 'other'])
      .withMessage('Invalid feedback category')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { messageId, rating, feedback, category } = req.body;
    const userId = req.user.id;
    
    // Verify the message belongs to the user
    const message = await dbOperations.read('chat_history', messageId);
    if (!message || message.userId !== userId) {
      throw new AppError('Message not found or access denied', 404, 'NOT_FOUND');
    }
    
    // Save feedback
    const feedbackRecord = {
      messageId,
      userId,
      rating,
      feedback: feedback || null,
      category: category || null,
      timestamp: new Date().toISOString()
    };
    
    await dbOperations.create('chatbot_feedback', feedbackRecord);
    
    // Update message with feedback reference
    await dbOperations.update('chat_history', messageId, {
      hasFeedback: true,
      lastFeedbackRating: rating
    });
    
    logger.info('Chatbot feedback received', {
      userId,
      messageId,
      rating,
      category
    });
    
    res.json({
      success: true,
      message: 'Feedback submitted successfully'
    });
  })
);

/**
 * GET /chatbot/suggestions
 * Get suggested questions based on current context
 */
router.get('/suggestions',
  requireAuth,
  [
    query('context')
      .optional()
      .isString()
      .withMessage('Context must be a string'),
    query('category')
      .optional()
      .isIn(['fleet', 'optimization', 'maintenance', 'analytics', 'general'])
      .withMessage('Invalid category')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { context, category = 'general' } = req.query;
    const userId = req.user.id;
    
    try {
      const suggestions = await ChatbotService.generateSuggestions({
        context,
        category,
        userRole: req.user.role,
        userId
      });
      
      res.json({
        success: true,
        data: {
          suggestions,
          category,
          count: suggestions.length
        }
      });
      
    } catch (error) {
      logger.error('Failed to generate suggestions', {
        userId,
        error: error.message
      });
      
      throw new AppError('Failed to generate suggestions: ' + error.message, 500, 'SUGGESTION_ERROR');
    }
  })
);

/**
 * POST /chatbot/analyze
 * Analyze specific data with AI assistance
 */
router.post('/analyze',
  requireAuth,
  [
    body('query')
      .notEmpty()
      .withMessage('Analysis query is required'),
    body('dataType')
      .isIn(['trainsets', 'maintenance', 'optimization', 'performance'])
      .withMessage('Invalid data type'),
    body('filters')
      .optional()
      .isObject()
      .withMessage('Filters must be an object'),
    body('timeRange')
      .optional()
      .isObject()
      .withMessage('Time range must be an object')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { query, dataType, filters = {}, timeRange = {} } = req.body;
    const userId = req.user.id;
    
    logger.info('Data analysis request', {
      userId,
      dataType,
      query: query.substring(0, 100)
    });
    
    try {
      const analysis = await ChatbotService.analyzeData({
        query,
        dataType,
        filters,
        timeRange,
        userId,
        userRole: req.user.role
      });
      
      res.json({
        success: true,
        data: analysis
      });
      
    } catch (error) {
      logger.error('Data analysis failed', {
        userId,
        dataType,
        error: error.message
      });
      
      throw new AppError('Data analysis failed: ' + error.message, 500, 'ANALYSIS_ERROR');
    }
  })
);

/**
 * DELETE /chatbot/conversation/:conversationId
 * Delete a conversation
 */
router.delete('/conversation/:conversationId',
  requireAuth,
  [
    param('conversationId')
      .notEmpty()
      .withMessage('Conversation ID is required')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const userId = req.user.id;
    
    // Get all messages in the conversation
    const messages = await dbOperations.query('chat_history', [
      ['userId', '==', userId],
      ['conversationId', '==', conversationId]
    ]);
    
    if (messages.length === 0) {
      throw new AppError('Conversation not found', 404, 'NOT_FOUND');
    }
    
    // Delete all messages in the conversation
    const deleteOperations = messages.map(message => ({
      type: 'delete',
      collection: 'chat_history',
      docId: message.id
    }));
    
    await dbOperations.batchWrite(deleteOperations);
    
    logger.info('Conversation deleted', {
      userId,
      conversationId,
      messageCount: messages.length
    });
    
    res.json({
      success: true,
      message: 'Conversation deleted successfully'
    });
  })
);

/**
 * GET /chatbot/analytics
 * Get chatbot usage analytics (admin only)
 */
router.get('/analytics',
  requireAuth,
  asyncHandler(async (req, res) => {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      throw new AppError('Admin access required', 403, 'AUTHORIZATION_ERROR');
    }
    
    try {
      const analytics = await ChatbotService.getChatbotAnalytics();
      
      res.json({
        success: true,
        data: analytics
      });
      
    } catch (error) {
      throw new AppError('Failed to get analytics: ' + error.message, 500, 'ANALYTICS_ERROR');
    }
  })
);

module.exports = router;
