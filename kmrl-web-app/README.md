# KMRL Fleet Management System - Node.js Web Application

🚄 **AI-driven fleet induction planning system for Kochi Metro Rail Limited**

A comprehensive Node.js web application that integrates NSGA-II multi-objective optimization, AI-powered chatbot, and real-time fleet management capabilities for optimal trainset scheduling and operations.

## 🌟 Features

### 🎯 **Core Functionality**
- **Multi-Objective Optimization**: NSGA-II algorithm for trainset scheduling
- **AI Chatbot**: Gemini AI-powered explainable assistant
- **Real-time Dashboard**: Live fleet status and performance monitoring
- **Maintenance Management**: Comprehensive maintenance tracking and alerts
- **Analytics & Reporting**: Advanced fleet analytics and insights
- **User Management**: Role-based authentication and authorization

### 🔧 **Technical Features**
- **RESTful API**: Comprehensive API with OpenAPI documentation
- **WebSocket Support**: Real-time communication and live updates
- **Firebase Integration**: Cloud-based data storage and synchronization
- **Python Integration**: Seamless integration with optimization engine
- **Security**: JWT authentication, rate limiting, and input validation
- **Logging**: Comprehensive logging with Winston
- **Error Handling**: Robust error handling and recovery

## 🏗️ Architecture

```
KMRL Fleet Management System
├── Backend (Node.js/Express)
│   ├── Authentication & Authorization
│   ├── RESTful API Endpoints
│   ├── WebSocket Real-time Communication
│   ├── Firebase Integration
│   └── Python Optimization Integration
├── AI Services
│   ├── Gemini AI Chatbot
│   ├── Explainable AI Features
│   └── Data Analysis Engine
├── Optimization Engine
│   ├── NSGA-II Multi-objective Optimization
│   ├── Constraint Handling
│   └── Solution Analysis
└── Data Layer
    ├── Firebase Firestore
    ├── Real-time Synchronization
    └── Data Validation
```

## 📋 Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Python** >= 3.8 (for optimization engine)
- **Firebase Account** with Firestore enabled
- **Google Gemini AI API Key**

## 🚀 Quick Start

### 1. Clone and Install

```bash
# Navigate to the project directory
cd "e:\Rohith\Hackathon\SIH Prelims 2025\KMRL-Document-Overload-Automation\kmrl-web-app"

# Install dependencies
npm install

# Install Python dependencies for optimization engine
pip install pandas numpy pymoo matplotlib firebase-admin python-dotenv
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your configuration
notepad .env
```

**Required Environment Variables:**
```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Firebase Configuration
FIREBASE_PROJECT_ID=k-m-r-lchronos-hn2nri
FIREBASE_SERVICE_ACCOUNT_PATH=./config/firebase-service-account.json

# AI Configuration
GEMINI_API_KEY=your_gemini_api_key_here

# Security
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production
```

### 3. Firebase Setup

1. **Download Firebase Service Account Key:**
   - Go to Firebase Console → Project Settings → Service Accounts
   - Generate new private key
   - Save as `./src/config/firebase-service-account.json`

2. **Firebase Collections:**
   Your Firebase project should have these collections:
   - `users`
   - `trainsets`
   - `health_and_maintenance`
   - `branding_priorities`
   - `stabling_bays`
   - `cleaning_slots`
   - `optimization_history`
   - `chat_history`

### 4. Start the Server

```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start
```

## 📖 API Documentation

### Authentication Endpoints
```
POST /api/v1/auth/login          - User login
POST /api/v1/auth/register       - User registration
POST /api/v1/auth/logout         - User logout
GET  /api/v1/auth/profile        - Get user profile
PUT  /api/v1/auth/profile        - Update user profile
POST /api/v1/auth/refresh        - Refresh JWT token
```

### Fleet Management Endpoints
```
GET  /api/v1/fleet/trainsets     - Get all trainsets
GET  /api/v1/fleet/trainsets/:id - Get specific trainset
PUT  /api/v1/fleet/trainsets/:id - Update trainset
GET  /api/v1/fleet/status        - Get fleet status overview
GET  /api/v1/fleet/maintenance   - Get maintenance information
```

### Optimization Endpoints
```
POST /api/v1/optimization/schedule    - Run optimization
GET  /api/v1/optimization/history     - Get optimization history
GET  /api/v1/optimization/results/:id - Get specific results
POST /api/v1/optimization/validate    - Validate parameters
```

### Chatbot Endpoints
```
POST /api/v1/chatbot/chat        - Send message to AI
GET  /api/v1/chatbot/history     - Get conversation history
POST /api/v1/chatbot/feedback    - Submit feedback
GET  /api/v1/chatbot/suggestions - Get suggestions
POST /api/v1/chatbot/analyze     - Analyze data with AI
```

### Analytics Endpoints
```
GET  /api/v1/analytics/dashboard   - Dashboard analytics
GET  /api/v1/analytics/performance - Performance metrics
GET  /api/v1/analytics/reports     - Available reports
```

## 🔌 WebSocket Events

### Client → Server Events
```javascript
// Authentication and Room Management
socket.emit('join_room', { room: 'fleet_status', context: {} });
socket.emit('leave_room', { room: 'fleet_status' });

// Subscriptions
socket.emit('subscribe_optimization', { optimizationId: 'opt_123' });
socket.emit('subscribe_fleet_status');
socket.emit('subscribe_maintenance_alerts');
socket.emit('subscribe_notifications');

// Chatbot Interaction
socket.emit('chatbot_message', {
  message: 'What is the current fleet status?',
  conversationId: 'conv_123',
  context: {}
});

// Health Check
socket.emit('ping');
```

### Server → Client Events
```javascript
// Connection Status
socket.on('connected', (data) => { /* Welcome message */ });
socket.on('room_joined', (data) => { /* Room joined confirmation */ });

// Real-time Updates
socket.on('fleet_status_update', (data) => { /* Fleet status changes */ });
socket.on('optimization_update', (data) => { /* Optimization progress */ });
socket.on('maintenance_alert', (data) => { /* Maintenance alerts */ });
socket.on('new_notification', (data) => { /* System notifications */ });

// Chatbot Responses
socket.on('chatbot_response', (data) => { /* AI response */ });
socket.on('chatbot_error', (data) => { /* Error handling */ });

// Health Check
socket.on('pong', (data) => { /* Connection health */ });
```

## 🤖 AI Chatbot Usage

### Basic Chat Interaction
```javascript
// Send message to AI chatbot
const response = await fetch('/api/v1/chatbot/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    message: 'Which trainsets need maintenance this week?',
    context: { type: 'maintenance' }
  })
});

const data = await response.json();
console.log(data.data.response); // AI response
console.log(data.data.suggestions); // Follow-up suggestions
```

### Data Analysis with AI
```javascript
// Analyze specific data with AI
const analysis = await fetch('/api/v1/chatbot/analyze', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    query: 'Show me efficiency trends for the past month',
    dataType: 'performance',
    timeRange: { days: 30 }
  })
});
```

## 🎯 Optimization Engine Integration

### Running Optimization
```javascript
// Run fleet optimization
const optimization = await fetch('/api/v1/optimization/schedule', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  },
  body: JSON.stringify({
    date: '2025-01-20',
    mode: 'balanced',
    constraints: {
      max_computation_time: 300
    },
    preferences: {
      prioritize_punctuality: true
    }
  })
});

const result = await optimization.json();
console.log(result.data.result); // Optimization results
```

### Monitoring Optimization Progress
```javascript
// Subscribe to optimization updates via WebSocket
socket.emit('subscribe_optimization', { 
  optimizationId: 'opt_12345' 
});

socket.on('optimization_update', (data) => {
  console.log(`Progress: ${data.progress}%`);
  console.log(`Phase: ${data.currentPhase}`);
  console.log(`ETA: ${data.estimatedTimeRemaining}ms`);
});
```

## 📊 Data Structures

### Trainset Object
```javascript
{
  "id": "doc_id",
  "trainset_id": "TS001",
  "status": "operational",
  "current_location": "Aluva",
  "capacity": 1000,
  "last_maintenance_date": "2025-01-15",
  "total_mileage": 45000,
  "maintenance": {
    "pending": 2,
    "in_progress": 0,
    "next_due": "2025-02-01"
  },
  "branding": {
    "sponsor": "Coca-Cola",
    "contract_end": "2025-12-31"
  }
}
```

### Optimization Result
```javascript
{
  "optimizationId": "opt_12345",
  "objectives": {
    "mileage_efficiency": 0.87,
    "punctuality_score": 0.92,
    "branding_coverage": 0.78
  },
  "solutions": [
    {
      "trainset_assignments": {
        "TS001": { "route": "Route1", "shift": "morning" },
        "TS002": { "route": "Route2", "shift": "evening" }
      },
      "objectives": { "mileage": 0.85, "punctuality": 0.90 }
    }
  ],
  "recommendations": [
    {
      "type": "schedule",
      "priority": "high",
      "title": "Recommended Schedule",
      "description": "Optimal trainset allocation"
    }
  ]
}
```

## 🔒 Security Features

### Authentication & Authorization
- **JWT Tokens**: Secure stateless authentication
- **Role-based Access**: operator, supervisor, admin roles
- **Permission System**: Granular permission control
- **Rate Limiting**: API and user-specific rate limits

### Input Validation
- **Schema Validation**: Joi-based input validation
- **SQL Injection Prevention**: Parameterized queries
- **XSS Protection**: Input sanitization
- **CSRF Protection**: Cross-site request forgery prevention

### Security Headers
- **Helmet.js**: Security headers configuration
- **CORS**: Cross-origin resource sharing control
- **HTTPS**: TLS encryption (production)

## 🔧 Development

### Project Structure
```
kmrl-web-app/
├── src/
│   ├── config/          # Configuration files
│   ├── middleware/      # Express middleware
│   ├── routes/          # API route handlers
│   ├── services/        # Business logic services
│   ├── utils/           # Utility functions
│   └── sockets/         # WebSocket handlers
├── logs/                # Application logs
├── temp/                # Temporary files
├── uploads/             # File uploads
├── package.json         # Dependencies
├── server.js           # Main server file
└── README.md           # This file
```

### Adding New Features

1. **API Endpoints**: Add routes in `src/routes/`
2. **Business Logic**: Add services in `src/services/`
3. **Real-time Features**: Add WebSocket handlers in `src/sockets/`
4. **Middleware**: Add middleware in `src/middleware/`

### Testing
```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format
```

## 📈 Monitoring & Logging

### Log Levels
- **Error**: System errors and exceptions
- **Warn**: Warning conditions
- **Info**: General information
- **Debug**: Detailed debug information

### Log Files
- `logs/error.log` - Error logs only
- `logs/combined.log` - All log levels
- `logs/optimization.log` - Optimization-specific logs
- `logs/exceptions.log` - Uncaught exceptions

### Performance Monitoring
```javascript
// Performance logging example
logger.performance('Optimization completed', duration, {
  solutionCount: 50,
  objectives: 3
});
```

## 🚀 Deployment

### Production Setup
```bash
# Set environment
export NODE_ENV=production

# Install production dependencies only
npm ci --only=production

# Start with PM2 (recommended)
pm2 start server.js --name kmrl-fleet-management

# Or start directly
npm start
```

### Environment Variables (Production)
```env
NODE_ENV=production
PORT=80
JWT_SECRET=your_very_secure_jwt_secret_here
FIREBASE_PROJECT_ID=your_firebase_project_id
GEMINI_API_KEY=your_production_gemini_key
```

### Health Checks
```bash
# Check server health
curl http://localhost:3000/health

# Check API health
curl http://localhost:3000/api/v1/health
```

## 🤝 Integration with Existing Components

### Python Optimization Engine
The Node.js application seamlessly integrates with your existing `optimization_engine_v3.py`:

```javascript
// The OptimizationService automatically calls your Python script
const result = await OptimizationService.runOptimization({
  date: '2025-01-20',
  constraints: {},
  preferences: {},
  mode: 'balanced'
});
```

### Firebase Data
Uses your existing Firebase project `k-m-r-lchronos-hn2nri` with the simplified collection structure.

### Chatbot AI
Integrates with Gemini AI using the patterns from your `Xplainable.ipynb` notebook for explainable fleet analytics.

## 📞 Support & Documentation

### API Documentation
- **Full API Docs**: `GET /api/v1/docs`
- **Health Check**: `GET /health`
- **API Stats**: `GET /api/v1/stats`

### Common Issues

1. **Firebase Connection**: Ensure service account key is properly configured
2. **Python Integration**: Verify Python path and script location
3. **JWT Errors**: Check JWT secret configuration
4. **CORS Issues**: Configure CORS origin properly

### Development Tips

1. **Hot Reload**: Use `npm run dev` for development
2. **Debug Mode**: Set `DEBUG_MODE=true` in environment
3. **Verbose Logging**: Set `VERBOSE_LOGGING=true`
4. **API Testing**: Use tools like Postman or Thunder Client

## 🌟 Key Advantages

1. **Complete Integration**: Seamlessly integrates optimization engine, AI chatbot, and Firebase data
2. **Real-time Updates**: WebSocket-based live updates for all fleet operations
3. **Scalable Architecture**: Modular design for easy expansion and maintenance
4. **Security First**: Comprehensive security features and best practices
5. **Production Ready**: Robust error handling, logging, and monitoring
6. **Developer Friendly**: Well-documented API and clear code structure

---

**Built for SIH 2025 Hackathon** 🏆  
*Transforming manual fleet planning into intelligent, automated decision-making*
