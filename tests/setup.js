const redisService = require('../src/services/redis');

// Connect to Redis before tests.
// Default to a dedicated scratch DB index (15) on localhost so the suite is
// fully isolated and reproducible — never the shared live host. CI overrides
// TEST_REDIS_URL to point at its throwaway redis:7-alpine service container.
beforeAll(async () => {
  const testRedisUrl = process.env.TEST_REDIS_URL || 'redis://127.0.0.1:6379/15';
  await redisService.connect(testRedisUrl);
});

// Flush the scratch DB before each test. Safe because the suite owns the
// configured DB index entirely. This replaces the old test:*-only deletion,
// which (a) never cleared config:projects and (b) raced across parallel jest
// workers sharing one DB. The suite runs serially (--runInBand) so workers
// don't contend on a single DB.
beforeEach(async () => {
  const client = redisService.getClient();
  await client.flushdb();
});

// Disconnect after tests
afterAll(async () => {
  await redisService.disconnect();
  // Brief delay to ensure connection is fully closed
  await new Promise(resolve => setTimeout(resolve, 50));
});