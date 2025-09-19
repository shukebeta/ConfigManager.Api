const request = require('supertest');
const express = require('express');
const redisService = require('../../src/services/redis');
const corsMiddleware = require('../../src/middleware/cors');
const { errorHandler, notFoundHandler } = require('../../src/middleware/error');
const configRoutes = require('../../src/routes/config');

// Create complete application instance (simulate real environment)
const app = express();
app.use(corsMiddleware);
app.use(express.json());

// Health check
app.get('/health', async (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      redis: redisService.isConnected ? 'connected' : 'disconnected'
    }
  });
});

app.use('/redis', configRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

describe('Integration Tests - Full API', () => {
  test('health check should work', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.services.redis).toBe('connected');
    expect(response.body.timestamp).toBeDefined();
  });

  test('complete config management workflow', async () => {
    const configKey = 'test:integration:nlog:minlevel';
    const initialValue = 'Info';
    const updatedValue = 'Debug';

    // 1. Set initial configuration
    const setResponse = await request(app)
      .post(`/redis/${configKey}`)
      .send({ value: initialValue })
      .expect(200);

    expect(setResponse.body.success).toBe(true);
    expect(setResponse.body.value).toBe(initialValue);
    expect(setResponse.body.operations.set).toBe(true);

    // 2. Get configuration for verification
    const getResponse = await request(app)
      .get(`/redis/${configKey}`)
      .expect(200);

    expect(getResponse.body.value).toBe(initialValue);
    expect(getResponse.body.exists).toBe(true);

    // 3. Update configuration
    const updateResponse = await request(app)
      .post(`/redis/${configKey}`)
      .send({ value: updatedValue })
      .expect(200);

    expect(updateResponse.body.value).toBe(updatedValue);

    // 4. Verify updated value
    const verifyResponse = await request(app)
      .get(`/redis/${configKey}`)
      .expect(200);

    expect(verifyResponse.body.value).toBe(updatedValue);
  });

  test('multi-project config simulation', async () => {
    const configs = [
      { key: 'test:newwords.api:config:nlog:minlevel', value: 'Debug' },
      { key: 'test:newwords.api:config:llm:timeout', value: '30000' },
      { key: 'test:happynotes.api:config:nlog:minlevel', value: 'Info' },
      { key: 'test:happynotes.api:config:feature:newui', value: 'true' }
    ];

    // Set configurations for multiple projects
    for (const config of configs) {
      await request(app)
        .post(`/redis/${config.key}`)
        .send({ value: config.value })
        .expect(200);
    }

    // Verify all configurations are set correctly
    for (const config of configs) {
      const response = await request(app)
        .get(`/redis/${config.key}`)
        .expect(200);

      expect(response.body.value).toBe(config.value);
      expect(response.body.exists).toBe(true);
    }

    // Verify projects can be discovered via Redis keys command
    const allTestKeys = await redisService.keys('test:*:config:*');
    expect(allTestKeys.length).toBeGreaterThanOrEqual(4);

    // Extract project prefixes
    const projects = [...new Set(allTestKeys.map(key => {
      const parts = key.split(':');
      return `${parts[1]}`; // 'newwords.api' or 'happynotes.api'
    }))];

    expect(projects).toEqual(expect.arrayContaining(['newwords.api', 'happynotes.api']));
  });

  test('JSON config handling', async () => {
    const jsonConfig = {
      providers: [
        { name: 'openai', models: ['gpt-4o-mini'], timeout: 30000 },
        { name: 'openrouter', models: ['deepseek/deepseek-chat'], timeout: 25000 }
      ],
      fallback: true
    };

    const configKey = 'test:integration:llm:agents';

    // Set JSON configuration
    const setResponse = await request(app)
      .post(`/redis/${configKey}`)
      .send({ value: JSON.stringify(jsonConfig) })
      .expect(200);

    expect(setResponse.body.value).toBe(JSON.stringify(jsonConfig));

    // Get and verify JSON configuration
    const getResponse = await request(app)
      .get(`/redis/${configKey}`)
      .expect(200);

    const parsedValue = JSON.parse(getResponse.body.value);
    expect(parsedValue).toEqual(jsonConfig);
  });

  test('error handling for invalid requests', async () => {
    // Test invalid JSON body
    const invalidJsonResponse = await request(app)
      .post('/redis/test:invalid')
      .set('Content-Type', 'application/json')
      .send('{"invalid": json}') // Invalid JSON
      .expect(400);

    // Test non-existent route
    const notFoundResponse = await request(app)
      .get('/nonexistent')
      .expect(404);

    expect(notFoundResponse.body.error).toBe('Not Found');
  });

  test('CORS headers should be present', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    // Verify CORS headers exist (specific values depend on configuration)
    expect(response.headers['access-control-allow-origin']).toBeDefined();
  });
});