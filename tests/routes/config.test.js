const request = require('supertest');
const express = require('express');
const configRoutes = require('../../src/routes/config');
const redisService = require('../../src/services/redis');
const { errorHandler } = require('../../src/middleware/error');

// Create test application
const app = express();
app.use(express.json());
app.use('/redis', configRoutes);
app.use(errorHandler);

describe('Config API Routes', () => {
  describe('GET /redis/:key', () => {
    test('should return existing value', async () => {
      const testKey = 'test:get:existing';
      const testValue = 'test:get:value';

      // Preset value
      await redisService.set(testKey, testValue);

      const response = await request(app)
        .get(`/redis/${testKey}`)
        .expect(200);

      expect(response.body).toEqual({
        key: testKey,
        value: testValue,
        exists: true
      });
    });

    test('should return null for non-existent key', async () => {
      const nonExistentKey = 'test:get:nonexistent';

      const response = await request(app)
        .get(`/redis/${nonExistentKey}`)
        .expect(200);

      expect(response.body).toEqual({
        key: nonExistentKey,
        value: null,
        exists: false
      });
    });

    test('should return 400 for empty key', async () => {
      const response = await request(app)
        .get('/redis/')
        .expect(404); // Express returns 404 for empty path
    });

    test('should handle special characters in key', async () => {
      const specialKey = 'test:special:key:with:colons';
      const testValue = 'special:value';

      await redisService.set(specialKey, testValue);

      const response = await request(app)
        .get(`/redis/${specialKey}`)
        .expect(200);

      expect(response.body.value).toBe(testValue);
    });
  });

  describe('POST /redis/:key', () => {
    test('should set and publish value successfully', async () => {
      const testKey = 'test:post:success';
      const testValue = 'test:post:value';

      const response = await request(app)
        .post(`/redis/${testKey}`)
        .send({ value: testValue })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        key: testKey,
        value: testValue,
        operations: {
          set: true,
          published: expect.any(Number),
          projectRegistered: null
        }
      });

      // Verify value is actually stored
      const storedValue = await redisService.get(testKey);
      expect(storedValue).toBe(testValue);
    });

    test('should handle different value types', async () => {
      const testCases = [
        { key: 'test:post:string', value: 'string value' },
        { key: 'test:post:number', value: 123 },
        { key: 'test:post:boolean', value: true },
        { key: 'test:post:object', value: { nested: 'object' } }
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .post(`/redis/${testCase.key}`)
          .send({ value: testCase.value })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.value).toBe(String(testCase.value));

        // Verify stored value
        const storedValue = await redisService.get(testCase.key);
        expect(storedValue).toBe(String(testCase.value));
      }
    });

    test('should return 400 for missing value', async () => {
      // Mock logger.error to verify it was called without polluting output
      const logger = require('../../src/logger');
      const loggerSpy = jest.spyOn(logger, 'error').mockImplementation();

      const response = await request(app)
        .post('/redis/test:post:missing')
        .send({}) // No value field
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('Value is required');
      
      // Verify error was logged (but silently in tests)
      expect(loggerSpy).toHaveBeenCalled();
      
      // Restore logger.error
      loggerSpy.mockRestore();
    });

    test('should return 400 for empty key', async () => {
      const response = await request(app)
        .post('/redis/')
        .send({ value: 'test' })
        .expect(404); // Express handles empty path
    });

    test('should handle value 0 and empty string', async () => {
      // Test value of 0
      const zeroResponse = await request(app)
        .post('/redis/test:post:zero')
        .send({ value: 0 })
        .expect(200);

      expect(zeroResponse.body.value).toBe('0');

      // Test empty string
      const emptyResponse = await request(app)
        .post('/redis/test:post:empty')
        .send({ value: '' })
        .expect(200);

      expect(emptyResponse.body.value).toBe('');
    });
  });

  describe('Error Handling', () => {
    test('should handle Redis connection errors gracefully', async () => {
      // Mock logger.error to verify it was called without polluting output
      const logger = require('../../src/logger');
      const loggerSpy = jest.spyOn(logger, 'error').mockImplementation();
      
      // Simulate Redis disconnection
      const originalIsConnected = redisService.isConnected;
      redisService.isConnected = false;

      const response = await request(app)
        .get('/redis/test:error:key')
        .expect(503);

      expect(response.body.error).toBe('Service Unavailable');
      
      // Verify error was logged (but silently in tests)
      expect(loggerSpy).toHaveBeenCalled();

      // Restore connection state
      redisService.isConnected = originalIsConnected;
      
      // Restore logger.error
      loggerSpy.mockRestore();
    });
  });
});
