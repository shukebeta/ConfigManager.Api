const Redis = require('ioredis');

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect(redisUrl = process.env.REDIS_URL || 'redis://localhost:6379') {
    try {
      this.client = new Redis(redisUrl, {
        retryDelayOnFailover: 100,
        retryDelayOnClusterDown: 300,
        maxRetriesPerRequest: 3,
        lazyConnect: true
      });

      // Connection event listeners
      this.client.on('connect', () => {
        console.log('Redis connected');
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        console.error('Redis connection error:', err);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        console.log('Redis connection closed');
        this.isConnected = false;
      });

      // Actively connect
      await this.client.connect();
      
      return this.client;
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
      this.isConnected = false;
    }
  }

  getClient() {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis client not connected');
    }
    return this.client;
  }

  // Basic operation methods
  async get(key) {
    const client = this.getClient();
    return await client.get(key);
  }

  async set(key, value) {
    const client = this.getClient();
    return await client.set(key, value);
  }

  async publish(channel, message) {
    const client = this.getClient();
    return await client.publish(channel, message);
  }

  async keys(pattern) {
    const client = this.getClient();
    return await client.keys(pattern);
  }

  // Configuration specific method: atomic SET + PUBLISH
  async setAndPublish(key, value) {
    const client = this.getClient();
    
    // Use pipeline to ensure atomicity
    const pipeline = client.pipeline();
    pipeline.set(key, value);
    pipeline.publish(key, value);
    
    const results = await pipeline.exec();
    
    // Check if all operations succeeded
    for (const [err, result] of results) {
      if (err) {
        throw new Error(`Pipeline operation failed: ${err.message}`);
      }
    }
    
    return {
      set: results[0][1],
      published: results[1][1]
    };
  }
}

// Singleton pattern
const redisService = new RedisService();

module.exports = redisService;