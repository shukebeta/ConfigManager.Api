const redisService = require('../../src/services/redis');

describe('Redis Service - Project Discovery', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  async function cleanupTestData() {
    // Clear test data including projects set and all test keys
    const client = redisService.getClient();
    const testKeys = await client.keys('test*');
    const projectsSet = ['config:projects'];
    
    // Clear test keys
    if (testKeys.length > 0) {
      await client.del(...testKeys);
    }
    
    // Clear projects set completely
    await client.del(...projectsSet);
  }

  describe('setConfigAndPublish', () => {
    test('should set, publish, and auto-register project for config keys', async () => {
      const key = 'testnewapp:config:nlog:level';
      const value = 'Debug';

      const result = await redisService.setConfigAndPublish(key, value);

      // Verify return result
      expect(result.set).toBe('OK');
      expect(result.published).toBeGreaterThanOrEqual(0);
      expect(result.projectRegistered).toBeGreaterThanOrEqual(0);

      // Verify value was set
      const storedValue = await redisService.get(key);
      expect(storedValue).toBe(value);

      // Verify project was registered
      const projects = await redisService.getProjects();
      expect(projects).toContain('testnewapp');
    });

    test('should not register project for non-config keys', async () => {
      const key = 'testnewapp:data:something';
      const value = 'data';

      const result = await redisService.setConfigAndPublish(key, value);

      expect(result.set).toBe('OK');
      expect(result.published).toBeGreaterThanOrEqual(0);
      expect(result.projectRegistered).toBeNull();

      // Verify project was not registered
      const projects = await redisService.getProjects();
      expect(projects).not.toContain('testnewapp');
    });

    test('should handle existing project registration', async () => {
      const project = 'testexistingapp';
      
      // Pre-register project
      await redisService.sadd('config:projects', project);
      
      const key = `${project}:config:new:setting`;
      const result = await redisService.setConfigAndPublish(key, 'value');

      // Should still succeed but indicate project was already registered
      expect(result.projectRegistered).toBe(0); // SADD returns 0 when member already exists
    });
  });

  describe('getProjects', () => {
    test('should return empty array when no projects registered', async () => {
      const projects = await redisService.getProjects();
      expect(projects).toEqual([]);
    });

    test('should return sorted list of registered projects', async () => {
      await redisService.sadd('config:projects', 'zebra.api', 'alpha.api', 'beta.api');

      const projects = await redisService.getProjects();
      expect(projects).toEqual(['alpha.api', 'beta.api', 'zebra.api']);
    });
  });

  describe('getProjectConfigs', () => {
    test('should return grouped configurations for project', async () => {
      const project = 'testconfigapp';
      
      // Set up test configurations
      await redisService.set(`${project}:config:nlog:minlevel`, 'Debug');
      await redisService.set(`${project}:config:nlog:maxlevel`, 'Fatal');
      await redisService.set(`${project}:config:llm:timeout`, '30000');
      await redisService.set(`${project}:config:llm:retries`, '3');
      await redisService.set(`${project}:config:feature:newui`, 'true');
      await redisService.set(`${project}:config:database:connection:string`, 'postgresql://localhost');

      const configs = await redisService.getProjectConfigs(project);

      // Check structure
      expect(configs.nlog).toBeDefined();
      expect(configs.llm).toBeDefined();
      expect(configs.feature).toBeDefined();
      expect(configs.database).toBeDefined();

      // Check nlog category
      expect(configs.nlog.minlevel).toEqual({
        key: `${project}:config:nlog:minlevel`,
        value: 'Debug',
        type: 'loglevel'
      });

      expect(configs.nlog.maxlevel).toEqual({
        key: `${project}:config:nlog:maxlevel`,
        value: 'Fatal',
        type: 'loglevel'
      });

      // Check llm category
      expect(configs.llm.timeout).toEqual({
        key: `${project}:config:llm:timeout`,
        value: '30000',
        type: 'integer'
      });

      // Check complex key with colons
      expect(configs.database['connection:string']).toEqual({
        key: `${project}:config:database:connection:string`,
        value: 'postgresql://localhost',
        type: 'string'
      });
    });

    test('should return empty object for project with no configs', async () => {
      const configs = await redisService.getProjectConfigs('test:nonexistent');
      expect(configs).toEqual({});
    });
  });

  describe('migrateExistingProjects', () => {
    test('should discover and register projects from existing config keys', async () => {
      // Create config keys for multiple projects
      await redisService.set('testapp1:config:setting1', 'value1');
      await redisService.set('testapp1:config:setting2', 'value2');
      await redisService.set('testapp2:config:setting1', 'value3');
      await redisService.set('testother:config:setting1', 'value4');

      const result = await redisService.migrateExistingProjects();

      expect(result.migrated).toBe(3);
      expect(result.projects).toEqual(['testapp1', 'testapp2', 'testother']);

      // Verify projects were added to set
      const projects = await redisService.getProjects();
      expect(projects).toEqual(['testapp1', 'testapp2', 'testother']);
    });

    test('should handle empty Redis instance', async () => {
      const result = await redisService.migrateExistingProjects();

      expect(result.migrated).toBe(0);
      expect(result.projects).toEqual([]);
    });

    test('should ignore non-config keys', async () => {
      await redisService.set('testapp1:data:something', 'value1');
      await redisService.set('testapp2:cache:key', 'value2');
      await redisService.set('testapp3:config:setting', 'value3'); // Only this should be found

      const result = await redisService.migrateExistingProjects();

      expect(result.migrated).toBe(1);
      expect(result.projects).toEqual(['testapp3']);
    });
  });

  describe('_inferConfigType', () => {
    test('should correctly infer configuration value types', async () => {
      const testCases = [
        ['123', 'integer'],
        ['123.45', 'float'],
        ['true', 'boolean'],
        ['false', 'boolean'],
        ['Debug', 'loglevel'],
        ['INFO', 'loglevel'],
        ['warn', 'loglevel'],
        ['ERROR', 'loglevel'],
        ['fatal', 'loglevel'],
        ['{"key": "value"}', 'object'],
        ['[1, 2, 3]', 'array'],
        ['regular string', 'string'],
        ['', 'string'],
        [null, 'null'],
        [undefined, 'null']
      ];

      for (const [value, expectedType] of testCases) {
        const actualType = redisService._inferConfigType(value);
        expect(actualType).toBe(expectedType);
      }
    });
  });

  describe('Set operations', () => {
    test('should handle Redis set operations correctly', async () => {
      const setKey = 'test:myset';
      
      // Add members
      const added1 = await redisService.sadd(setKey, 'member1');
      const added2 = await redisService.sadd(setKey, 'member2');
      const added3 = await redisService.sadd(setKey, 'member1'); // duplicate

      expect(added1).toBe(1); // new member
      expect(added2).toBe(1); // new member  
      expect(added3).toBe(0); // existing member

      // Get all members
      const members = await redisService.smembers(setKey);
      expect(members.sort()).toEqual(['member1', 'member2']);

      // Remove member
      const removed = await redisService.srem(setKey, 'member1');
      expect(removed).toBe(1);

      const remainingMembers = await redisService.smembers(setKey);
      expect(remainingMembers).toEqual(['member2']);
    });
  });
});
