// Global error handling middleware
function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  // Redis connection errors
  if (err.message.includes('Redis client not connected')) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Redis connection not available'
    });
  }

  // Redis operation errors
  if (err.code === 'ECONNREFUSED' || err.message.includes('Redis')) {
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

  // Default server errors
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
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