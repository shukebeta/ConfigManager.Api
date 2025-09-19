const request = require('supertest');
const express = require('express');
const redisService = require('../../src/services/redis');
const corsMiddleware = require('../../src/middleware/cors');
const { errorHandler, notFoundHandler } = require('../../src/middleware/error');
const projectRoutes = require('../../src/routes/projects');

// Create test application
const app = express();
app.use(corsMiddleware);
app.use(express.json());
app.use('/projects', projectRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

describe('Project Discovery API Routes', () => {
  beforeEach(async () => {
    // Clear test data including projects set
    const client = redisService.getClient();
    const testKeys = await client.keys('test*');
    const projectsSet = ['config:projects'];
    
    // Clear test keys
    if (testKeys.length > 0) {
      await client.del(...testKeys);
    }
    
    // Clear projects set
    await client.del(...projectsSet);
  });

  describe('GET /projects', () => {
    test('should return empty projects list when no projects exist', async () => {
      const response = await request(app)
        .get('/projects')
        .expect(200);

      expect(response.body).toEqual({
        projects: [],
        count: 0,
        source: 'empty'
      });
    });

    test('should return projects from registry set', async () => {
      // Manually add projects to set
      await redisService.sadd('config:projects', 'newwords.api', 'happynotes.api');

      const response = await request(app)
        .get('/projects')
        .expect(200);

      expect(response.body).toEqual({
        projects: ['happynotes.api', 'newwords.api'], // sorted
        count: 2,
        source: 'registry'
      });
    });

    test('should auto-migrate projects from existing config keys', async () => {
      // Create config keys without registering projects
      await redisService.set('testtestapp1:config:nlog:level', 'Debug');
      await redisService.set('testtestapp2:config:llm:timeout', '30000');
      await redisService.set('testtestapp1:config:feature:newui', 'true');

      const response = await request(app)
        .get('/projects')
        .expect(200);

      expect(response.body.projects).toEqual(['testtestapp1', 'testtestapp2']);
      expect(response.body.count).toBe(2);
      expect(response.body.source).toBe('registry');

      // Verify projects were added to the set
      const projects = await redisService.getProjects();
      expect(projects).toEqual(['testtestapp1', 'testtestapp2']);
    });
  });

  describe('GET /projects/:project/configs', () => {
    test('should return configs grouped by category', async () => {
      const project = 'testmyapp';
      
      // Set up test data
      await redisService.set(`${project}:config:nlog:minlevel`, 'Debug');
      await redisService.set(`${project}:config:nlog:maxlevel`, 'Fatal');
      await redisService.set(`${project}:config:llm:timeout`, '30000');
      await redisService.set(`${project}:config:feature:newui`, 'true');

      const response = await request(app)
        .get(`/projects/${project}/configs`)
        .expect(200);

      expect(response.body.project).toBe(project);
      expect(response.body.categories).toEqual(['feature', 'llm', 'nlog']);
      expect(response.body.totalConfigs).toBe(4);

      // Check config structure
      expect(response.body.configs.nlog).toBeDefined();
      expect(response.body.configs.nlog.minlevel).toEqual({
        key: `${project}:config:nlog:minlevel`,
        value: 'Debug',
        type: 'loglevel'
      });

      expect(response.body.configs.llm.timeout).toEqual({
        key: `${project}:config:llm:timeout`,
        value: '30000',
        type: 'integer'
      });

      expect(response.body.configs.feature.newui).toEqual({
        key: `${project}:config:feature:newui`,
        value: 'true',
        type: 'boolean'
      });
    });

    test('should return empty configs for project with no configurations', async () => {
      const response = await request(app)
        .get('/projects/testnonexistent/configs')
        .expect(200);

      expect(response.body).toEqual({
        project: 'testnonexistent',
        configs: {},
        categories: [],
        totalConfigs: 0
      });
    });

    test('should validate project name format', async () => {
      await request(app)
        .get('/projects/invalid project name!/configs')
        .expect(400);

      await request(app)
        .get('/projects//configs')
        .expect(400);
    });

    test('should handle complex setting names with colons', async () => {
      const project = 'testcomplex';
      await redisService.set(`${project}:config:database:connection:string`, 'postgresql://...');
      await redisService.set(`${project}:config:auth:jwt:secret:key`, 'secret123');

      const response = await request(app)
        .get(`/projects/${project}/configs`)
        .expect(200);

      expect(response.body.configs.database['connection:string']).toBeDefined();
      expect(response.body.configs.auth['jwt:secret:key']).toBeDefined();
    });
  });

  describe('POST /projects/:project/migrate', () => {
    test('should migrate project with existing config keys', async () => {
      const project = 'testmigrateapp';
      
      // Create config keys
      await redisService.set(`${project}:config:nlog:level`, 'Info');
      await redisService.set(`${project}:config:feature:enabled`, 'true');

      const response = await request(app)
        .post(`/projects/${project}/migrate`)
        .expect(200);

      expect(response.body).toEqual({
        project,
        migrated: true,
        alreadyRegistered: false,
        configKeys: [
          `${project}:config:feature:enabled`,
          `${project}:config:nlog:level`
        ],
        configCount: 2
      });

      // Verify project was added to set
      const projects = await redisService.getProjects();
      expect(projects).toContain(project);
    });

    test('should handle already registered project', async () => {
      const project = 'testexisting';
      
      // Pre-register project
      await redisService.sadd('config:projects', project);
      await redisService.set(`${project}:config:test:value`, '123');

      const response = await request(app)
        .post(`/projects/${project}/migrate`)
        .expect(200);

      expect(response.body.alreadyRegistered).toBe(true);
      expect(response.body.migrated).toBe(true);
    });

    test('should handle project with no config keys', async () => {
      const response = await request(app)
        .post('/projects/testempty/migrate')
        .expect(200);

      expect(response.body).toEqual({
        project: 'testempty',
        migrated: false,
        message: 'No configuration keys found for this project',
        configKeys: []
      });
    });

    test('should validate project name', async () => {
      await request(app)
        .post('/projects/invalid name!/migrate')
        .expect(400);
    });
  });

  describe('Error handling', () => {
    test('should handle Redis disconnection gracefully', async () => {
      // Simulate Redis disconnection
      const originalConnected = redisService.isConnected;
      redisService.isConnected = false;

      await request(app)
        .get('/projects')
        .expect(503);

      // Restore connection state
      redisService.isConnected = originalConnected;
    });
  });
});