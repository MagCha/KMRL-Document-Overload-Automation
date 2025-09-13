# KMRL Fleet Management System - Quick Start Guide

## 🚀 Getting Started (5 Minutes Setup)

### Prerequisites Checklist
- [ ] Node.js 18+ installed (`node --version`)
- [ ] Python 3.8+ installed (`python --version`)
- [ ] Firebase project setup (k-m-r-lchronos-hn2nri)
- [ ] Google Gemini AI API key

### 1. Installation
```bash
# Navigate to project directory
cd "e:\Rohith\Hackathon\SIH Prelims 2025\KMRL-Document-Overload-Automation\kmrl-web-app"

# Dependencies are already installed, but if needed:
npm install

# Run setup script to create directories and files
node scripts/setup.js
```

### 2. Configuration
```bash
# Copy environment template
copy .env.example .env

# Edit .env file with your credentials
notepad .env
```

**Required Configuration:**
```env
FIREBASE_PROJECT_ID=k-m-r-lchronos-hn2nri
GEMINI_API_KEY=your_gemini_api_key_here
JWT_SECRET=change_this_to_a_secure_random_string
```

### 3. Firebase Setup
1. Download Firebase service account key from Firebase Console
2. Save as `src\config\firebase-service-account.json`

### 4. Start Application
```bash
# Option 1: Use the startup script (Windows)
start.bat

# Option 2: Use npm command
npm run dev

# Option 3: Production mode
npm start
```

### 5. Access the Application
- **Server**: http://localhost:3000
- **API Docs**: http://localhost:3000/api/v1/docs
- **Health Check**: http://localhost:3000/health

## 🔧 Quick Testing

### Test API Endpoints
```bash
# Health check
curl http://localhost:3000/health

# Test authentication (after setup)
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@kmrl.com","password":"Test123!","role":"operator"}'
```

### Test WebSocket Connection
```javascript
// Open browser console and run:
const socket = io('http://localhost:3000');
socket.on('connected', (data) => console.log('Connected:', data));
socket.emit('subscribe_fleet_status');
```

### Test Optimization Engine
```bash
# This will test if Python optimization engine is working
curl -X POST http://localhost:3000/api/v1/optimization/validate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"date":"2025-01-20","mode":"balanced"}'
```

## 📊 Demo Data Available

The system connects to your existing Firebase project with these collections:
- **users**: User accounts and authentication
- **trainsets**: 25 trainsets (TS001-TS025) 
- **health_and_maintenance**: Maintenance records
- **branding_priorities**: Sponsor branding data
- **stabling_bays**: 25 stabling locations
- **cleaning_slots**: Daily cleaning schedules

## 🤖 AI Chatbot Demo

Once running, you can test the AI chatbot:
```bash
curl -X POST http://localhost:3000/api/v1/chatbot/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"message":"What is the current status of trainset TS001?"}'
```

## 🚨 Common Issues & Solutions

### Issue: "Firebase service account not found"
**Solution:** Download your Firebase service account key and save it to `src/config/firebase-service-account.json`

### Issue: "Python optimization failed"
**Solution:** Install Python dependencies:
```bash
pip install pandas numpy pymoo matplotlib firebase-admin python-dotenv
```

### Issue: "Gemini AI not responding"
**Solution:** Check your GEMINI_API_KEY in .env file

### Issue: "JWT token invalid"
**Solution:** Change JWT_SECRET in .env to a long, random string

### Issue: "CORS errors"
**Solution:** Update CORS_ORIGIN in .env to match your frontend URL

## 📱 Frontend Integration

The Node.js backend is ready for frontend integration. Key endpoints:

```javascript
// Authentication
POST /api/v1/auth/login
POST /api/v1/auth/register

// Fleet Management  
GET  /api/v1/fleet/trainsets
GET  /api/v1/fleet/status

// Optimization
POST /api/v1/optimization/schedule

// Chatbot
POST /api/v1/chatbot/chat

// WebSocket Events
socket.on('fleet_status_update', handleFleetUpdate);
socket.on('optimization_update', handleOptimizationProgress);
```

## 🎯 Next Steps

1. **Frontend Development**: Build React frontend to consume the APIs
2. **Real-time Dashboard**: Implement real-time fleet monitoring
3. **Mobile App**: Create mobile application using the same APIs
4. **Advanced Analytics**: Add more sophisticated analytics
5. **Machine Learning**: Enhance optimization with ML predictions

## 📞 Support

- **API Documentation**: http://localhost:3000/api/v1/docs
- **System Health**: http://localhost:3000/health
- **Logs**: Check `logs/` directory for debugging
- **Configuration**: Review `.env` file for settings

---

**Ready to revolutionize KMRL fleet management!** 🚄✨
