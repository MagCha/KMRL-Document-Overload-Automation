const request = require('supertest');
const app = require('../server');

describe('KMRL Fleet Management API', () => {
  beforeAll(async () => {
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    // Close server connections
    if (app.close) {
      await app.close();
    }
  });

  describe('Health Endpoints', () => {
    test('GET /health - should return server health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });

    test('GET /api/v1/health - should return API health status', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('services');
    });
  });

  describe('Authentication Endpoints', () => {
    test('POST /api/v1/auth/register - should register new user', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@kmrl.com',
        password: 'TestPassword123!',
        firstName: 'Test',
        lastName: 'User',
        role: 'operator'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user).toHaveProperty('email', userData.email);
    });

    test('POST /api/v1/auth/login - should login existing user', async () => {
      const loginData = {
        email: 'test@kmrl.com',
        password: 'TestPassword123!'
      };

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user).toHaveProperty('email', loginData.email);
    });
  });

  describe('Fleet Endpoints', () => {
    let authToken;

    beforeAll(async () => {
      // Get auth token for protected routes
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@kmrl.com',
          password: 'TestPassword123!'
        });
      
      authToken = loginResponse.body.data.token;
    });

    test('GET /api/v1/fleet/trainsets - should get trainsets list', async () => {
      const response = await request(app)
        .get('/api/v1/fleet/trainsets')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body.data).toHaveProperty('trainsets');
      expect(Array.isArray(response.body.data.trainsets)).toBe(true);
    });

    test('GET /api/v1/fleet/status - should get fleet status', async () => {
      const response = await request(app)
        .get('/api/v1/fleet/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body.data).toHaveProperty('overview');
    });
  });

  describe('Optimization Endpoints', () => {
    let authToken;

    beforeAll(async () => {
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@kmrl.com',
          password: 'TestPassword123!'
        });
      
      authToken = loginResponse.body.data.token;
    });

    test('POST /api/v1/optimization/validate - should validate optimization parameters', async () => {
      const optimizationData = {
        date: '2025-01-20',
        mode: 'balanced',
        constraints: {},
        preferences: {}
      };

      const response = await request(app)
        .post('/api/v1/optimization/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(optimizationData)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body.data).toHaveProperty('valid', true);
    });
  });

  describe('Chatbot Endpoints', () => {
    let authToken;

    beforeAll(async () => {
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@kmrl.com',
          password: 'TestPassword123!'
        });
      
      authToken = loginResponse.body.data.token;
    });

    test('POST /api/v1/chatbot/chat - should handle chat message', async () => {
      const chatData = {
        message: 'Hello, what can you help me with?',
        context: { type: 'general' }
      };

      const response = await request(app)
        .post('/api/v1/chatbot/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send(chatData)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body.data).toHaveProperty('response');
      expect(response.body.data).toHaveProperty('conversationId');
    });
  });

  describe('Error Handling', () => {
    test('GET /api/v1/nonexistent - should return 404', async () => {
      const response = await request(app)
        .get('/api/v1/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message');
    });

    test('Protected route without token - should return 401', async () => {
      const response = await request(app)
        .get('/api/v1/fleet/trainsets')
        .expect(401);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message');
    });
  });
});
