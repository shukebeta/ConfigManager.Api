const redisService = require('../../src/services/redis');

describe('RedisService', () => {
  test('should connect to Redis successfully', async () => {
    expect(redisService.isConnected).toBe(true);
    expect(redisService.getClient()).toBeTruthy();
  });

  test('should get and set values', async () => {
    const testKey = 'test:simple:key';
    const testValue = 'test:simple:value';

    // Set value
    const setResult = await redisService.set(testKey, testValue);
    expect(setResult).toBe('OK');

    // Get value
    const getValue = await redisService.get(testKey);
    expect(getValue).toBe(testValue);
  });

  test('should return null for non-existent key', async () => {
    const nonExistentKey = 'test:nonexistent:key';
    const value = await redisService.get(nonExistentKey);
    expect(value).toBeNull();
  });

  test('should set and publish atomically', async () => {
    const testKey = 'test:atomic:key';
    const testValue = 'test:atomic:value';

    const result = await redisService.setAndPublish(testKey, testValue);

    // Verify return result
    expect(result.set).toBe('OK');
    expect(result.published).toBeGreaterThanOrEqual(0); // Publish success, even without subscribers

    // Verify value is actually set
    const storedValue = await redisService.get(testKey);
    expect(storedValue).toBe(testValue);
  });

  test('should handle Redis keys pattern search', async () => {
    // Set some test data with new format: project:keyname
    await redisService.set('test:mysql:host', 'localhost');
    await redisService.set('test:mysql:port', '3306');
    await redisService.set('test:redis:url', 'redis://localhost');
    await redisService.set('test:other:data', 'value4');

    // Search pattern for project configs
    const configKeys = await redisService.keys('test:*');
    expect(configKeys).toHaveLength(4);
    expect(configKeys).toEqual(expect.arrayContaining([
      'test:mysql:host',
      'test:mysql:port', 
      'test:redis:url',
      'test:other:data'
    ]));

    // More specific pattern
    const mysqlKeys = await redisService.keys('test:mysql:*');
    expect(mysqlKeys).toHaveLength(2);
  });

  test('should throw error when not connected', async () => {
    // Temporarily disconnect
    const originalConnected = redisService.isConnected;
    redisService.isConnected = false;

    await expect(redisService.get('test:key')).rejects.toThrow('Redis client not connected');

    // Restore connection state
    redisService.isConnected = originalConnected;
  });
});