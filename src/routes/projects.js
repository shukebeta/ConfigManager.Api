const express = require('express');
const redisService = require('../services/redis');

const router = express.Router();

// GET /projects - Get all active projects
router.get('/', async (req, res, next) => {
  try {
    // Auto-migrate existing projects if the set is empty
    let projects = await redisService.getProjects();
    
    if (projects.length === 0) {
      // Attempt migration from existing keys
      const migrationResult = await redisService.migrateExistingProjects();
      projects = migrationResult.projects;
      
      if (migrationResult.migrated > 0) {
        console.log(`Migrated ${migrationResult.migrated} projects to registry:`, migrationResult.projects);
      }
    }
    
    res.json({
      projects,
      count: projects.length,
      source: projects.length > 0 ? 'registry' : 'empty'
    });
  } catch (error) {
    next(error);
  }
});



// Handle missing project parameter (/projects/configs instead of /projects/:project/configs)
router.get('/configs', (req, res) => {
  res.status(400).json({ 
    error: 'Bad Request',
    message: 'Project parameter is required'
  });
});
// GET /projects/:project/configs - Get all configs for a specific project
router.get('/:project/configs', async (req, res, next) => {
  try {
    const { project } = req.params;
    console.log('Project param received:', JSON.stringify(project), 'length:', project.length);
    
    // Basic validation
    if (!project || project.trim() === '') {
      const error = new Error('Project parameter is required');
      error.type = 'validation';
      throw error;
    }
    
    // Sanitize project name (alphanumeric, hyphens, dots, underscores, colons only)
    if (!/^[a-zA-Z0-9._:-]+$/.test(project)) {
      const error = new Error('Invalid project name format');
      error.type = 'validation';
      throw error;
    }
    
    const configs = await redisService.getProjectConfigs(project);
    const configCount = Object.values(configs).reduce((sum, category) => sum + Object.keys(category).length, 0);
    
    res.json({
      project,
      configs,
      categories: Object.keys(configs).sort(),
      totalConfigs: configCount
    });
  } catch (error) {
    next(error);
  }
});


module.exports = router;
