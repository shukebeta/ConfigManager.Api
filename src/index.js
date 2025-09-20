require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const logger = require('./logger');
const redisService = require('./services/redis');
const corsMiddleware = require('./middleware/cors');
const { errorHandler, notFoundHandler } = require('./middleware/error');
const configRoutes = require('./routes/config');
const projectRoutes = require('./routes/projects');

const app = express();
const PORT = process.env.PORT || 3001;

// Request ID middleware for tracing
app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  next();
});

// Middleware
app.use(corsMiddleware);
app.use(express.json());

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const isRedisConnected = redisService.isConnected;
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        redis: isRedisConnected ? 'connected' : 'disconnected'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// API routes
app.use('/redis', configRoutes);
app.use('/projects', projectRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    // Connect to Redis
    logger.info('Connecting to Redis...');
    await redisService.connect();
    logger.info('Redis connected successfully');

    // Start HTTP server
    app.listen(PORT, () => {
      logger.info({
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        healthCheck: `http://localhost:${PORT}/health`
      }, 'ConfigManager Redis Proxy started');
    });
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await redisService.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');  
  await redisService.disconnect();
  process.exit(0);
});

// Uncaught exception handling
process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught Exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason, promise }, 'Unhandled Rejection');
  process.exit(1);
});

// Start the server
startServer();