/**
 * WebSocket Handlers
 * 
 * This module handles real-time communication via WebSocket
 * for the KMRL fleet management system.
 */

const logger = require('../utils/logger');
const { extractToken } = require('../middleware/auth');
const { dbOperations } = require('../config/firebase');
const jwt = require('jsonwebtoken');

// Store active connections
const activeConnections = new Map();
const roomConnections = new Map();

/**
 * Initialize Socket.IO handlers
 */
function initializeSocketHandlers(io) {
  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }
      
      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await dbOperations.read('users', decoded.userId);
      
      if (!user || user.status !== 'active') {
        return next(new Error('User not found or inactive'));
      }
      
      // Attach user to socket
      socket.user = {
        id: user.id,
        userId: user.user_id,
        name: user.name,
        role: user.role,
        department: user.department
      };
      
      next();
    } catch (error) {
      logger.error('Socket authentication failed', { error: error.message });
      next(new Error('Authentication failed'));
    }
  });
  
  // Handle new connections
  io.on('connection', (socket) => {
    handleNewConnection(socket, io);
  });
  
  return io;
}

/**
 * Handle new socket connection
 */
function handleNewConnection(socket, io) {
  const user = socket.user;
  
  logger.info('User connected via WebSocket', {
    userId: user.id,
    socketId: socket.id,
    role: user.role
  });
  
  // Store connection
  activeConnections.set(socket.id, {
    socket,
    user,
    connectedAt: new Date(),
    rooms: new Set()
  });
  
  // Send welcome message
  socket.emit('connected', {
    message: 'Connected to KMRL Fleet Management System',
    user: {
      id: user.id,
      name: user.name,
      role: user.role
    },
    timestamp: new Date().toISOString()
  });
  
  // Set up event handlers
  setupEventHandlers(socket, io);
  
  // Handle disconnection
  socket.on('disconnect', () => {
    handleDisconnection(socket);
  });
}

/**
 * Set up event handlers for socket
 */
function setupEventHandlers(socket, io) {
  const user = socket.user;
  
  // Join specific rooms based on user role and interests
  socket.on('join_room', (data) => {
    handleJoinRoom(socket, data, io);
  });
  
  socket.on('leave_room', (data) => {
    handleLeaveRoom(socket, data);
  });
  
  // Real-time optimization status updates
  socket.on('subscribe_optimization', (data) => {
    handleOptimizationSubscription(socket, data);
  });
  
  // Fleet status updates
  socket.on('subscribe_fleet_status', () => {
    handleFleetStatusSubscription(socket);
  });
  
  // Chatbot interactions
  socket.on('chatbot_message', (data) => {
    handleChatbotMessage(socket, data, io);
  });
  
  // Maintenance alerts
  socket.on('subscribe_maintenance_alerts', () => {
    handleMaintenanceAlertsSubscription(socket);
  });
  
  // System notifications
  socket.on('subscribe_notifications', () => {
    handleNotificationsSubscription(socket);
  });
  
  // Ping/pong for connection health
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: new Date().toISOString() });
  });
}

/**
 * Handle room joining
 */
function handleJoinRoom(socket, data, io) {
  const { room, context } = data;
  const user = socket.user;
  
  // Validate room access based on user role
  if (!canAccessRoom(user, room)) {
    socket.emit('room_access_denied', {
      room,
      message: 'Insufficient permissions to join this room'
    });
    return;
  }
  
  socket.join(room);
  
  // Track room membership
  const connection = activeConnections.get(socket.id);
  if (connection) {
    connection.rooms.add(room);
  }
  
  // Track room connections
  if (!roomConnections.has(room)) {
    roomConnections.set(room, new Set());
  }
  roomConnections.get(room).add(socket.id);
  
  logger.info('User joined room', {
    userId: user.id,
    room,
    context
  });
  
  socket.emit('room_joined', {
    room,
    message: `Joined ${room} successfully`,
    members: roomConnections.get(room).size
  });
  
  // Send room-specific initial data
  sendRoomInitialData(socket, room, context);
}

/**
 * Handle room leaving
 */
function handleLeaveRoom(socket, data) {
  const { room } = data;
  const user = socket.user;
  
  socket.leave(room);
  
  // Update tracking
  const connection = activeConnections.get(socket.id);
  if (connection) {
    connection.rooms.delete(room);
  }
  
  if (roomConnections.has(room)) {
    roomConnections.get(room).delete(socket.id);
    if (roomConnections.get(room).size === 0) {
      roomConnections.delete(room);
    }
  }
  
  logger.info('User left room', {
    userId: user.id,
    room
  });
  
  socket.emit('room_left', {
    room,
    message: `Left ${room} successfully`
  });
}

/**
 * Handle optimization subscription
 */
function handleOptimizationSubscription(socket, data) {
  const { optimizationId } = data;
  const room = `optimization_${optimizationId}`;
  
  socket.join(room);
  
  socket.emit('optimization_subscribed', {
    optimizationId,
    message: 'Subscribed to optimization updates'
  });
  
  logger.info('User subscribed to optimization updates', {
    userId: socket.user.id,
    optimizationId
  });
}

/**
 * Handle fleet status subscription
 */
function handleFleetStatusSubscription(socket) {
  const room = 'fleet_status';
  
  socket.join(room);
  
  socket.emit('fleet_status_subscribed', {
    message: 'Subscribed to fleet status updates'
  });
  
  // Send current fleet status
  sendCurrentFleetStatus(socket);
  
  logger.info('User subscribed to fleet status', {
    userId: socket.user.id
  });
}

/**
 * Handle chatbot message
 */
async function handleChatbotMessage(socket, data, io) {
  const { message, conversationId, context } = data;
  const user = socket.user;
  
  try {
    // Import chatbot service
    const ChatbotService = require('../services/chatbotService');
    
    // Process message
    const response = await ChatbotService.processMessage({
      message,
      userId: user.id,
      conversationId,
      context,
      userRole: user.role
    });
    
    // Send response back to user
    socket.emit('chatbot_response', {
      conversationId: response.conversationId,
      response: response.response,
      suggestions: response.suggestions,
      analysisData: response.analysisData,
      responseTime: response.responseTime
    });
    
    logger.info('Chatbot message processed via WebSocket', {
      userId: user.id,
      conversationId: response.conversationId,
      responseTime: response.responseTime
    });
    
  } catch (error) {
    logger.error('WebSocket chatbot message failed', {
      userId: user.id,
      error: error.message
    });
    
    socket.emit('chatbot_error', {
      message: 'Failed to process message',
      error: error.message
    });
  }
}

/**
 * Handle maintenance alerts subscription
 */
function handleMaintenanceAlertsSubscription(socket) {
  const room = 'maintenance_alerts';
  
  socket.join(room);
  
  socket.emit('maintenance_alerts_subscribed', {
    message: 'Subscribed to maintenance alerts'
  });
  
  logger.info('User subscribed to maintenance alerts', {
    userId: socket.user.id
  });
}

/**
 * Handle notifications subscription
 */
function handleNotificationsSubscription(socket) {
  const room = `notifications_${socket.user.id}`;
  
  socket.join(room);
  
  socket.emit('notifications_subscribed', {
    message: 'Subscribed to notifications'
  });
  
  logger.info('User subscribed to notifications', {
    userId: socket.user.id
  });
}

/**
 * Handle disconnection
 */
function handleDisconnection(socket) {
  const user = socket.user;
  const connection = activeConnections.get(socket.id);
  
  if (connection) {
    // Clean up room connections
    connection.rooms.forEach(room => {
      if (roomConnections.has(room)) {
        roomConnections.get(room).delete(socket.id);
        if (roomConnections.get(room).size === 0) {
          roomConnections.delete(room);
        }
      }
    });
    
    activeConnections.delete(socket.id);
  }
  
  logger.info('User disconnected from WebSocket', {
    userId: user.id,
    socketId: socket.id,
    connectionDuration: connection ? Date.now() - connection.connectedAt.getTime() : 0
  });
}

/**
 * Utility functions
 */
function canAccessRoom(user, room) {
  // Define room access rules based on user role
  const roomAccess = {
    'admin_only': ['admin'],
    'fleet_status': ['operator', 'supervisor', 'admin'],
    'maintenance_alerts': ['maintenance', 'supervisor', 'admin'],
    'optimization_results': ['supervisor', 'admin'],
    'notifications': ['operator', 'supervisor', 'admin']
  };
  
  // Check if room has specific access rules
  for (const [roomPattern, allowedRoles] of Object.entries(roomAccess)) {
    if (room.includes(roomPattern)) {
      return allowedRoles.includes(user.role);
    }
  }
  
  // Default: allow access to most rooms for authenticated users
  return true;
}

async function sendRoomInitialData(socket, room, context) {
  try {
    let initialData = {};
    
    if (room === 'fleet_status') {
      initialData = await getCurrentFleetStatus();
    } else if (room.startsWith('optimization_')) {
      const optimizationId = room.replace('optimization_', '');
      initialData = await getOptimizationStatus(optimizationId);
    } else if (room === 'maintenance_alerts') {
      initialData = await getCurrentMaintenanceAlerts();
    }
    
    socket.emit('room_initial_data', {
      room,
      data: initialData
    });
    
  } catch (error) {
    logger.error('Failed to send room initial data', {
      room,
      error: error.message
    });
  }
}

async function sendCurrentFleetStatus(socket) {
  try {
    const fleetStatus = await getCurrentFleetStatus();
    socket.emit('fleet_status_update', fleetStatus);
  } catch (error) {
    logger.error('Failed to send fleet status', { error: error.message });
  }
}

async function getCurrentFleetStatus() {
  const trainsets = await dbOperations.getAll('trainsets');
  
  return {
    total: trainsets.length,
    operational: trainsets.filter(t => t.status === 'operational').length,
    maintenance: trainsets.filter(t => t.status === 'maintenance').length,
    out_of_service: trainsets.filter(t => t.status === 'out_of_service').length,
    last_updated: new Date().toISOString()
  };
}

async function getOptimizationStatus(optimizationId) {
  try {
    const optimization = await dbOperations.read('optimization_history', optimizationId);
    return optimization || { status: 'not_found' };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}

async function getCurrentMaintenanceAlerts() {
  try {
    const maintenance = await dbOperations.query('health_and_maintenance', [
      ['status', 'in', ['due', 'overdue']]
    ]);
    
    return {
      total_alerts: maintenance.length,
      critical: maintenance.filter(m => m.priority === 'critical').length,
      overdue: maintenance.filter(m => 
        new Date(m.due_date) < new Date() && m.status !== 'completed'
      ).length
    };
  } catch (error) {
    return { error: 'Failed to get maintenance alerts' };
  }
}

/**
 * Broadcast functions for use by other parts of the application
 */
function broadcastToRoom(io, room, event, data) {
  io.to(room).emit(event, {
    ...data,
    timestamp: new Date().toISOString()
  });
  
  logger.info('Broadcast sent to room', {
    room,
    event,
    memberCount: roomConnections.get(room)?.size || 0
  });
}

function broadcastFleetStatusUpdate(io, fleetStatus) {
  broadcastToRoom(io, 'fleet_status', 'fleet_status_update', fleetStatus);
}

function broadcastOptimizationUpdate(io, optimizationId, update) {
  broadcastToRoom(io, `optimization_${optimizationId}`, 'optimization_update', update);
}

function broadcastMaintenanceAlert(io, alert) {
  broadcastToRoom(io, 'maintenance_alerts', 'maintenance_alert', alert);
}

function broadcastNotification(io, userId, notification) {
  broadcastToRoom(io, `notifications_${userId}`, 'new_notification', notification);
}

function getConnectionStats() {
  return {
    total_connections: activeConnections.size,
    active_rooms: roomConnections.size,
    connections_by_role: Array.from(activeConnections.values()).reduce((acc, conn) => {
      acc[conn.user.role] = (acc[conn.user.role] || 0) + 1;
      return acc;
    }, {})
  };
}

module.exports = {
  initializeSocketHandlers,
  broadcastToRoom,
  broadcastFleetStatusUpdate,
  broadcastOptimizationUpdate,
  broadcastMaintenanceAlert,
  broadcastNotification,
  getConnectionStats
};
