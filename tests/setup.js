const redisService = require('../src/services/redis');

// Connect to Redis before tests
beforeAll(async () => {
  const testRedisUrl = process.env.TEST_REDIS_URL || 'redis://seq.shukebeta.eu.org:6379';
  await redisService.connect(testRedisUrl);
});

// Clear test data before each test
beforeEach(async () => {
  const client = redisService.getClient();
  // Only clear test-related keys to avoid affecting other data
  const testKeys = await client.keys('test:*');
  if (testKeys.length > 0) {
    await client.del(...testKeys);
  }
});

// Disconnect after tests
afterAll(async () => {
  await redisService.disconnect();
  // Brief delay to ensure connection is fully closed
  await new Promise(resolve => setTimeout(resolve, 50));
});