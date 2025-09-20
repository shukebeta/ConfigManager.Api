const Redis = require('ioredis');
const logger = require('../logger');

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
        logger.info('Redis connected');
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        logger.error({ err }, 'Redis connection error');
        this.isConnected = false;
      });

      this.client.on('close', () => {
        logger.info('Redis connection closed');
        this.isConnected = false;
      });

      // Actively connect
      await this.client.connect();
      
      return this.client;
    } catch (error) {
      logger.error({ err: error }, 'Failed to connect to Redis');
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

  // Set operations
  async sadd(key, ...members) {
    const client = this.getClient();
    return await client.sadd(key, ...members);
  }

  async smembers(key) {
    const client = this.getClient();
    return await client.smembers(key);
  }

  async srem(key, member) {
    const client = this.getClient();
    return await client.srem(key, member);
  }

  // Configuration specific method: atomic SET + PUBLISH + register project
  async setConfigAndPublish(key, value) {
    const client = this.getClient();
    
    // Use pipeline to ensure atomicity
    const pipeline = client.pipeline();
    pipeline.set(key, value);
    pipeline.publish(key, value);
    
    // Auto-register project if this is a config key
    const [project, type, ...rest] = key.split(':');
    const isConfigKey = type === 'config' && rest.length > 0;
    if (isConfigKey) {
      pipeline.sadd('config:projects', project);
    }
    
    const results = await pipeline.exec();
    
    // Check if all operations succeeded
    for (const [err, result] of results) {
      if (err) {
        throw new Error(`Pipeline operation failed: ${err.message}`);
      }
    }
    
    return {
      set: results[0][1],
      published: results[1][1],
      projectRegistered: isConfigKey ? results[2][1] : null
    };
  }

  // Legacy method for backward compatibility
  async setAndPublish(key, value) {
    return await this.setConfigAndPublish(key, value);
  }

  // Project discovery methods
  async getProjects() {
    const client = this.getClient();
    const projects = await client.smembers('config:projects');
    return projects.sort();
  }

  async getProjectConfigs(project) {
    const client = this.getClient();
    const pattern = `${project}:config:*`;
    const keys = [];
    
    // Use SCAN instead of KEYS to avoid blocking Redis
    const stream = client.scanStream({ 
      match: pattern, 
      count: 100 // Process 100 keys per iteration
    });
    
    for await (const keysChunk of stream) {
      keys.push(...keysChunk);
    }
    
    if (keys.length === 0) {
      return {};
    }
    
    // Use pipeline for batch GET operations to improve performance
    const pipeline = client.pipeline();
    keys.forEach(key => pipeline.get(key));
    const results = await pipeline.exec();
    
    // Group by category
    const configs = {};
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const [error, value] = results[i];
      
      if (error) {
        logger.error({ err: error, key }, 'Error getting value for key');
        continue;
      }
      
      const [, , category, ...settingParts] = key.split(':');
      const setting = settingParts.join(':');
      
      if (!configs[category]) {
        configs[category] = {};
      }
      
      configs[category][setting] = {
        key,
        value,
        type: this._inferConfigType(value)
      };
    }
    
    return configs;
  }

  // Migration method: populate projects set from existing keys
  async migrateExistingProjects() {
    const client = this.getClient();
    const projects = new Set();
    
    // Use SCAN instead of KEYS to avoid blocking Redis
    const stream = client.scanStream({ 
      match: '*:config:*', 
      count: 100 // Process 100 keys per iteration
    });
    
    for await (const keys of stream) {
      for (const key of keys) {
        const [project] = key.split(':');
        projects.add(project);
      }
    }
    
    // Add all discovered projects to the set
    const projectArray = Array.from(projects);
    if (projectArray.length > 0) {
      await client.sadd('config:projects', ...projectArray);
    }
    
    return {
      migrated: projectArray.length,
      projects: projectArray.sort()
    };
  }

  // Helper method to infer configuration value type
  _inferConfigType(value) {
    if (value === null || value === undefined) {
      return 'null';
    }
    
    // Convert to string if not already
    const strValue = String(value);
    
    // Check for log levels first (before JSON parsing)
    if (/^(debug|info|warn|error|fatal)$/i.test(strValue)) {
      return 'loglevel';
    }
    
    // Check for simple patterns before JSON
    if (/^\d+$/.test(strValue)) return 'integer';
    if (/^\d+\.\d+$/.test(strValue)) return 'float';
    if (/^(true|false)$/i.test(strValue)) return 'boolean';
    
    // Try to parse as JSON for complex types
    try {
      const parsed = JSON.parse(strValue);
      if (Array.isArray(parsed)) return 'array';
      if (typeof parsed === 'object' && parsed !== null) return 'object';
      // Note: JSON.parse can also parse numbers and booleans, but we handle those above
    } catch (e) {
      // Not JSON, continue
    }
    
    return 'string';
  }
}

// Singleton pattern
const redisService = new RedisService();

module.exports = redisService;
