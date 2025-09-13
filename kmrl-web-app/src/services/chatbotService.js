/**
 * Chatbot Service
 * 
 * This service handles AI chatbot interactions using Google Gemini AI,
 * implementing the explainable AI patterns from Xplainable.ipynb for
 * fleet management queries and analysis.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { v4: uuidv4 } = require('uuid');

const logger = require('../utils/logger');
const { dbOperations } = require('../config/firebase');
const { getConfig } = require('../utils/validation');

class ChatbotService {
  constructor() {
    this.config = getConfig();
    this.genAI = new GoogleGenerativeAI(this.config.ai.geminiApiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    this.conversationContexts = new Map();
    this.initializeSystemPrompts();
  }

  /**
   * Initialize system prompts for different contexts
   */
  initializeSystemPrompts() {
    this.systemPrompts = {
      general: `You are KMRL Assistant, an AI expert for Kochi Metro Rail Limited's fleet management system. 
      You help users with trainset scheduling, maintenance planning, optimization results, and operational insights.
      
      Capabilities:
      - Analyze fleet data and provide insights
      - Explain optimization results in simple terms
      - Answer questions about trainset status, maintenance, and scheduling
      - Provide recommendations based on data analysis
      - Generate structured responses with actionable insights
      
      Always respond in a helpful, professional manner and provide specific data-driven insights when possible.`,

      optimization: `You are an optimization expert for KMRL's fleet management system using NSGA-II multi-objective optimization.
      
      Your expertise includes:
      - Explaining optimization results and trade-offs
      - Helping users understand Pareto fronts and solution selection
      - Analyzing objective values (mileage efficiency, punctuality, branding coverage)
      - Recommending schedule adjustments based on optimization outcomes
      - Explaining constraint violations and their implications
      
      Always provide clear explanations of complex optimization concepts in practical terms.`,

      maintenance: `You are a maintenance planning expert for KMRL's trainset fleet.
      
      Your expertise includes:
      - Analyzing maintenance schedules and requirements
      - Identifying critical maintenance priorities
      - Explaining health status indicators
      - Recommending maintenance optimizations
      - Predicting maintenance needs based on usage patterns
      
      Focus on safety, efficiency, and operational reliability in all recommendations.`,

      analytics: `You are a data analytics expert for KMRL's fleet operations.
      
      Your expertise includes:
      - Analyzing operational performance metrics
      - Identifying trends and patterns in fleet data
      - Generating insights from historical data
      - Creating performance reports and visualizations
      - Benchmarking against operational targets
      
      Provide data-driven insights with clear explanations and actionable recommendations.`
    };
  }

  /**
   * Process user message and generate AI response
   */
  async processMessage(params) {
    const { message, userId, conversationId, context, userRole } = params;
    const startTime = Date.now();
    
    try {
      // Get or create conversation ID
      const activeConversationId = conversationId || uuidv4();
      
      // Determine conversation category
      const category = this.determineMessageCategory(message, context);
      
      // Get conversation context
      const conversationContext = await this.getConversationContext(activeConversationId, userId);
      
      // Prepare system prompt
      const systemPrompt = this.systemPrompts[category] || this.systemPrompts.general;
      
      // Get relevant data for context
      const relevantData = await this.getRelevantData(message, category, context);
      
      // Generate AI response
      const aiResponse = await this.generateAIResponse({
        message,
        systemPrompt,
        conversationContext,
        relevantData,
        userRole,
        category
      });
      
      // Parse and enhance response
      const enhancedResponse = await this.enhanceResponse(aiResponse, category, relevantData);
      
      // Update conversation context
      this.updateConversationContext(activeConversationId, {
        userMessage: message,
        botResponse: enhancedResponse.response,
        category,
        timestamp: new Date().toISOString()
      });
      
      const responseTime = Date.now() - startTime;
      
      return {
        conversationId: activeConversationId,
        response: enhancedResponse.response,
        suggestions: enhancedResponse.suggestions,
        analysisData: enhancedResponse.analysisData,
        responseTime: `${responseTime}ms`,
        confidence: enhancedResponse.confidence,
        category
      };
      
    } catch (error) {
      logger.error('Chatbot message processing failed', {
        userId,
        error: error.message,
        message: message.substring(0, 100)
      });
      throw error;
    }
  }

  /**
   * Determine message category based on content and context
   */
  determineMessageCategory(message, context = {}) {
    const messageLower = message.toLowerCase();
    
    // Optimization-related keywords
    if (messageLower.includes('optim') || messageLower.includes('schedule') || 
        messageLower.includes('nsga') || messageLower.includes('pareto') ||
        context.type === 'optimization') {
      return 'optimization';
    }
    
    // Maintenance-related keywords
    if (messageLower.includes('maintenance') || messageLower.includes('repair') ||
        messageLower.includes('health') || messageLower.includes('service') ||
        context.type === 'maintenance') {
      return 'maintenance';
    }
    
    // Analytics-related keywords
    if (messageLower.includes('analytic') || messageLower.includes('report') ||
        messageLower.includes('performance') || messageLower.includes('metric') ||
        context.type === 'analytics') {
      return 'analytics';
    }
    
    return 'general';
  }

  /**
   * Get conversation context for continuity
   */
  async getConversationContext(conversationId, userId) {
    // Check in-memory context first
    if (this.conversationContexts.has(conversationId)) {
      return this.conversationContexts.get(conversationId);
    }
    
    // Get recent conversation history from database
    try {
      const recentMessages = await dbOperations.query('chat_history', [
        ['conversationId', '==', conversationId],
        ['userId', '==', userId]
      ], ['timestamp', 'desc'], 5);
      
      return recentMessages.map(msg => ({
        userMessage: msg.userMessage,
        botResponse: msg.botResponse,
        timestamp: msg.timestamp
      }));
    } catch (error) {
      logger.warn('Failed to get conversation context', { conversationId, error: error.message });
      return [];
    }
  }

  /**
   * Get relevant data based on message content and category
   */
  async getRelevantData(message, category, context = {}) {
    try {
      const relevantData = {};
      
      // Base data that's always useful
      relevantData.summary = await this.getFleetSummary();
      
      // Category-specific data
      switch (category) {
        case 'optimization':
          relevantData.recentOptimizations = await this.getRecentOptimizations(5);
          break;
          
        case 'maintenance':
          relevantData.maintenanceStatus = await this.getMaintenanceStatus();
          break;
          
        case 'analytics':
          relevantData.performanceMetrics = await this.getPerformanceMetrics();
          break;
          
        default:
          // For general queries, include a broader data set
          relevantData.trainsetStatus = await this.getTrainsetStatus();
          break;
      }
      
      // Add specific data if mentioned in message
      if (message.toLowerCase().includes('trainset') || message.toLowerCase().includes('ts')) {
        const trainsetIds = this.extractTrainsetIds(message);
        if (trainsetIds.length > 0) {
          relevantData.specificTrainsets = await this.getSpecificTrainsets(trainsetIds);
        }
      }
      
      return relevantData;
      
    } catch (error) {
      logger.error('Failed to get relevant data', { category, error: error.message });
      return { error: 'Data temporarily unavailable' };
    }
  }

  /**
   * Generate AI response using Gemini
   */
  async generateAIResponse(params) {
    const { message, systemPrompt, conversationContext, relevantData, userRole, category } = params;
    
    // Build comprehensive prompt
    const fullPrompt = this.buildPrompt({
      systemPrompt,
      userMessage: message,
      conversationContext,
      relevantData,
      userRole,
      category
    });
    
    try {
      // Generate response with structured output when needed
      const response = await this.model.generateContent(fullPrompt);
      const responseText = response.response.text();
      
      return responseText;
      
    } catch (error) {
      logger.error('Gemini AI response generation failed', {
        error: error.message,
        category,
        messageLength: message.length
      });
      
      // Fallback response
      return this.generateFallbackResponse(category);
    }
  }

  /**
   * Build comprehensive prompt for AI
   */
  buildPrompt(params) {
    const { systemPrompt, userMessage, conversationContext, relevantData, userRole, category } = params;
    
    let prompt = `${systemPrompt}\n\n`;
    
    // Add user role context
    prompt += `User Role: ${userRole}\n`;
    prompt += `Query Category: ${category}\n\n`;
    
    // Add relevant data context
    if (relevantData && Object.keys(relevantData).length > 0) {
      prompt += `RELEVANT DATA CONTEXT:\n`;
      prompt += `${JSON.stringify(relevantData, null, 2)}\n\n`;
    }
    
    // Add conversation history for context
    if (conversationContext && conversationContext.length > 0) {
      prompt += `CONVERSATION HISTORY:\n`;
      conversationContext.slice(-3).forEach((msg, index) => {
        prompt += `[${index + 1}] User: ${msg.userMessage}\n`;
        prompt += `[${index + 1}] Assistant: ${msg.botResponse}\n\n`;
      });
    }
    
    // Add specific instructions based on category
    prompt += this.getCategorySpecificInstructions(category);
    
    // Add the current user message
    prompt += `\nCURRENT USER MESSAGE:\n${userMessage}\n\n`;
    
    // Response format instructions
    prompt += `RESPONSE REQUIREMENTS:
1. Provide a clear, helpful response to the user's question
2. Use the provided data context to give specific insights
3. If analyzing data, provide concrete numbers and trends
4. Suggest follow-up questions or actions when appropriate
5. Keep responses conversational but professional
6. If you cannot find specific data, acknowledge it and provide general guidance\n\n`;
    
    return prompt;
  }

  /**
   * Get category-specific instructions
   */
  getCategorySpecificInstructions(category) {
    const instructions = {
      optimization: `
For optimization queries:
- Explain optimization results in terms of trade-offs between objectives
- Provide specific recommendations for schedule improvements
- Explain technical concepts (NSGA-II, Pareto front) in simple terms
- Include objective values and performance metrics
`,
      maintenance: `
For maintenance queries:
- Prioritize safety and operational reliability
- Provide specific maintenance schedules and requirements
- Explain health status indicators and their implications
- Recommend preventive maintenance strategies
`,
      analytics: `
For analytics queries:
- Provide specific metrics and performance indicators
- Identify trends and patterns in the data
- Compare current performance against historical data
- Generate actionable insights for improvement
`,
      general: `
For general queries:
- Provide comprehensive information about fleet operations
- Include relevant data points and status information
- Offer navigation to more specific categories if needed
- Give an overview before diving into details
`
    };
    
    return instructions[category] || instructions.general;
  }

  /**
   * Enhance response with additional context and suggestions
   */
  async enhanceResponse(response, category, relevantData) {
    const enhanced = {
      response,
      suggestions: [],
      analysisData: null,
      confidence: 0.8 // Default confidence score
    };
    
    // Generate follow-up suggestions based on category
    enhanced.suggestions = this.generateFollowUpSuggestions(category, response);
    
    // Add analysis data for visualization if relevant
    if (category === 'analytics' && relevantData.performanceMetrics) {
      enhanced.analysisData = {
        type: 'performance',
        data: relevantData.performanceMetrics,
        charts: ['efficiency_trend', 'punctuality_score']
      };
    }
    
    // Adjust confidence based on data availability
    if (relevantData.error) {
      enhanced.confidence = 0.4;
    } else if (Object.keys(relevantData).length > 2) {
      enhanced.confidence = 0.9;
    }
    
    return enhanced;
  }

  /**
   * Generate follow-up suggestions
   */
  generateFollowUpSuggestions(category, response) {
    const baseSuggestions = {
      optimization: [
        "Show me the latest optimization results",
        "How can I improve schedule efficiency?",
        "Explain the trade-offs in the current solution",
        "What constraints are affecting optimization?"
      ],
      maintenance: [
        "Which trainsets need maintenance this week?",
        "Show me the maintenance schedule",
        "What are the critical maintenance priorities?",
        "How is overall fleet health?"
      ],
      analytics: [
        "Show me performance trends",
        "Generate a weekly report",
        "Compare with last month's metrics",
        "What are the key performance indicators?"
      ],
      general: [
        "Tell me about fleet status",
        "How are operations performing today?",
        "What optimization options are available?",
        "Show me recent analytics"
      ]
    };
    
    // Return 3 random suggestions from the category
    const categorySupports = baseSuggestions[category] || baseSuggestions.general;
    return categorySupports.slice(0, 3);
  }

  /**
   * Generate fallback response when AI fails
   */
  generateFallbackResponse(category) {
    const fallbacks = {
      optimization: "I'm having trouble processing your optimization query right now. You can check the optimization history page or try asking about specific trainset schedules.",
      maintenance: "I'm unable to access maintenance data at the moment. Please check the maintenance dashboard or contact your supervisor for current status.",
      analytics: "Analytics services are temporarily unavailable. You can view the dashboard for basic metrics or try again in a few minutes.",
      general: "I'm experiencing some technical difficulties. Please try rephrasing your question or check the relevant dashboard section."
    };
    
    return fallbacks[category] || fallbacks.general;
  }

  /**
   * Update conversation context in memory
   */
  updateConversationContext(conversationId, messageData) {
    const context = this.conversationContexts.get(conversationId) || [];
    context.push(messageData);
    
    // Keep only last 10 messages in memory
    if (context.length > 10) {
      context.shift();
    }
    
    this.conversationContexts.set(conversationId, context);
  }

  /**
   * Data retrieval methods
   */
  async getFleetSummary() {
    try {
      const trainsets = await dbOperations.getAll('trainsets');
      return {
        total_trainsets: trainsets.length,
        operational: trainsets.filter(t => t.status === 'operational').length,
        maintenance: trainsets.filter(t => t.status === 'maintenance').length,
        out_of_service: trainsets.filter(t => t.status === 'out_of_service').length
      };
    } catch (error) {
      return { error: 'Fleet summary unavailable' };
    }
  }

  async getRecentOptimizations(limit = 5) {
    try {
      return await dbOperations.query('optimization_history', [], ['createdAt', 'desc'], limit);
    } catch (error) {
      return [];
    }
  }

  async getMaintenanceStatus() {
    try {
      const maintenance = await dbOperations.getAll('health_and_maintenance');
      return {
        total_items: maintenance.length,
        due: maintenance.filter(m => m.status === 'due').length,
        in_progress: maintenance.filter(m => m.status === 'in_progress').length,
        completed: maintenance.filter(m => m.status === 'completed').length
      };
    } catch (error) {
      return { error: 'Maintenance data unavailable' };
    }
  }

  async getPerformanceMetrics() {
    try {
      // This would typically come from a performance tracking system
      // For now, return mock performance data
      return {
        efficiency: 0.85,
        punctuality: 0.92,
        availability: 0.88,
        last_updated: new Date().toISOString()
      };
    } catch (error) {
      return { error: 'Performance metrics unavailable' };
    }
  }

  async getTrainsetStatus() {
    try {
      const trainsets = await dbOperations.getAll('trainsets');
      return trainsets.map(t => ({
        id: t.id,
        status: t.status,
        location: t.current_location,
        last_maintenance: t.last_maintenance_date
      }));
    } catch (error) {
      return [];
    }
  }

  extractTrainsetIds(message) {
    // Extract trainset IDs like TS001, TS-001, etc.
    const regex = /TS[-_]?(\d{1,3})/gi;
    const matches = [];
    let match;
    
    while ((match = regex.exec(message)) !== null) {
      matches.push(match[0].toUpperCase());
    }
    
    return matches;
  }

  async getSpecificTrainsets(trainsetIds) {
    try {
      const trainsets = [];
      for (const id of trainsetIds) {
        const trainset = await dbOperations.query('trainsets', [['trainset_id', '==', id]]);
        if (trainset.length > 0) {
          trainsets.push(trainset[0]);
        }
      }
      return trainsets;
    } catch (error) {
      return [];
    }
  }

  /**
   * Additional service methods
   */
  async generateSuggestions(params) {
    const { context, category, userRole } = params;
    
    // Return contextual suggestions based on category and user role
    const suggestions = {
      fleet: [
        "What's the current status of all trainsets?",
        "Which trainsets are due for maintenance?",
        "How is fleet performance trending?",
        "Show me today's operational schedule"
      ],
      optimization: [
        "Run optimization for tomorrow's schedule",
        "Explain the latest optimization results",
        "What are the key constraints affecting scheduling?",
        "How can I improve mileage efficiency?"
      ],
      maintenance: [
        "Which trainsets need immediate maintenance?",
        "Show me the maintenance calendar",
        "What are the critical maintenance priorities?",
        "How is overall fleet health status?"
      ],
      analytics: [
        "Generate this week's performance report",
        "Show me efficiency trends",
        "Compare current vs target metrics",
        "What are the top operational insights?"
      ]
    };
    
    return suggestions[category] || suggestions.fleet;
  }

  async analyzeData(params) {
    const { query, dataType, filters, timeRange } = params;
    
    // This is a simplified version - in a real implementation,
    // you would fetch and analyze the specific data type
    try {
      let data;
      switch (dataType) {
        case 'trainsets':
          data = await dbOperations.getAll('trainsets');
          break;
        case 'maintenance':
          data = await dbOperations.getAll('health_and_maintenance');
          break;
        case 'optimization':
          data = await dbOperations.getAll('optimization_history');
          break;
        default:
          throw new Error('Invalid data type');
      }
      
      // Generate AI analysis
      const analysisPrompt = `
Analyze the following ${dataType} data based on this query: "${query}"

Data: ${JSON.stringify(data.slice(0, 100), null, 2)}

Provide a structured analysis including:
1. Key findings
2. Trends and patterns
3. Recommendations
4. Data quality assessment
`;
      
      const analysis = await this.model.generateContent(analysisPrompt);
      
      return {
        query,
        dataType,
        analysis: analysis.response.text(),
        dataPoints: data.length,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      throw new Error(`Data analysis failed: ${error.message}`);
    }
  }

  groupConversationHistory(history) {
    const conversations = {};
    
    history.forEach(message => {
      if (!conversations[message.conversationId]) {
        conversations[message.conversationId] = [];
      }
      conversations[message.conversationId].push(message);
    });
    
    return Object.entries(conversations).map(([id, messages]) => ({
      conversationId: id,
      messageCount: messages.length,
      lastMessage: messages[0], // Most recent due to desc order
      startTime: messages[messages.length - 1].timestamp
    }));
  }

  async getChatbotAnalytics() {
    try {
      const [chatHistory, feedback] = await Promise.all([
        dbOperations.getAll('chat_history'),
        dbOperations.getAll('chatbot_feedback')
      ]);
      
      return {
        totalMessages: chatHistory.length,
        totalConversations: new Set(chatHistory.map(m => m.conversationId)).size,
        averageRating: feedback.length > 0 
          ? feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length 
          : 0,
        messagesByCategory: this.groupMessagesByCategory(chatHistory),
        responseTimeStats: this.calculateResponseTimeStats(chatHistory),
        topQueries: this.getTopQueries(chatHistory)
      };
    } catch (error) {
      throw new Error(`Analytics generation failed: ${error.message}`);
    }
  }

  groupMessagesByCategory(messages) {
    const categories = {};
    messages.forEach(msg => {
      const category = this.determineMessageCategory(msg.userMessage);
      categories[category] = (categories[category] || 0) + 1;
    });
    return categories;
  }

  calculateResponseTimeStats(messages) {
    const responseTimes = messages
      .filter(m => m.responseTime)
      .map(m => parseInt(m.responseTime.replace('ms', '')));
    
    if (responseTimes.length === 0) return { average: 0, min: 0, max: 0 };
    
    return {
      average: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
      min: Math.min(...responseTimes),
      max: Math.max(...responseTimes)
    };
  }

  getTopQueries(messages) {
    const queryCount = {};
    messages.forEach(msg => {
      const query = msg.userMessage.toLowerCase().substring(0, 50);
      queryCount[query] = (queryCount[query] || 0) + 1;
    });
    
    return Object.entries(queryCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));
  }
}

module.exports = new ChatbotService();
