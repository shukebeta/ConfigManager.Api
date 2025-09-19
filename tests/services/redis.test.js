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
    // Set some test data
    await redisService.set('test:config:app1:setting1', 'value1');
    await redisService.set('test:config:app1:setting2', 'value2');
    await redisService.set('test:config:app2:setting1', 'value3');
    await redisService.set('test:other:data', 'value4');

    // Search pattern
    const configKeys = await redisService.keys('test:config:*');
    expect(configKeys).toHaveLength(3);
    expect(configKeys).toEqual(expect.arrayContaining([
      'test:config:app1:setting1',
      'test:config:app1:setting2', 
      'test:config:app2:setting1'
    ]));

    // More specific pattern
    const app1Keys = await redisService.keys('test:config:app1:*');
    expect(app1Keys).toHaveLength(2);
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