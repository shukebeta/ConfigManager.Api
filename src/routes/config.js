const express = require('express');
const redisService = require('../services/redis');

const router = express.Router();

// GET /redis/:key - Get configuration value
router.get('/:key', async (req, res, next) => {
  try {
    const { key } = req.params;
    
    // Basic validation
    if (!key || key.trim() === '') {
      const error = new Error('Key parameter is required');
      error.type = 'validation';
      throw error;
    }

    const value = await redisService.get(key);
    
    res.json({
      key,
      value: value || null,
      exists: value !== null
    });
  } catch (error) {
    next(error);
  }
});

// POST /redis/:key - Set configuration value (SET + PUBLISH)
router.post('/:key', async (req, res, next) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    // Basic validation
    if (!key || key.trim() === '') {
      const error = new Error('Key parameter is required');
      error.type = 'validation';
      throw error;
    }

    if (value === undefined) {
      const error = new Error('Value is required in request body');
      error.type = 'validation';
      throw error;
    }

    // Execute SET + PUBLISH + auto-register project
    const result = await redisService.setConfigAndPublish(key, String(value));
    
    res.json({
      success: true,
      key,
      value: String(value),
      operations: {
        set: result.set === 'OK',
        published: result.published, // publish returns number of clients that received the message
        projectRegistered: result.projectRegistered !== null ? result.projectRegistered >= 0 : null
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;