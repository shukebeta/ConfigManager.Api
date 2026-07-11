const logger = require('../logger');

// Global error handling middleware
function errorHandler(err, req, res, next) {
  // Structured error logging with request context
  logger.error({ 
    err,
    req: {
      id: req.id,
      method: req.method,
      url: req.originalUrl || req.url,
      ip: req.ip || (req.connection && req.connection.remoteAddress) || 'unknown'
    }
  }, 'Request processing error');

  // Redis connection errors
  if (err.message && err.message.includes('Redis client not connected')) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Redis connection not available'
    });
  }

  // Redis operation errors
  if (err.code === 'ECONNREFUSED' || (err.message && err.message.includes('Redis'))) {
    return res.status(503).json({
      error: 'Service Unavailable', 
      message: 'Redis service unavailable'
    });
  }

  // JSON parsing errors
  if (err.type === 'entity.parse.failed' || err.status === 400) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid JSON format'
    });
  }

  // Parameter validation errors
  if (err.type === 'validation') {
    return res.status(400).json({
      error: 'Bad Request',
      message: err.message
    });
  }

  // Key already exists errors
  if (err.type === 'key_already_exists') {
    return res.status(400).json({
      error: 'key_already_exists',
      message: err.message,
      suggestion: err.suggestion
    });
  }

  // Naming conflict errors
  if (err.type === 'naming_conflict') {
    return res.status(400).json({
      error: 'naming_conflict',
      message: err.message,
      conflictType: err.conflictType,
      conflictingKey: err.conflictingKey,
      conflictingKeys: err.conflictingKeys,
      suggestion: err.suggestion
    });
  }

  // Default server errors
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message // Always show the actual error message for debugging
  });
}

// 404 handler middleware
function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};