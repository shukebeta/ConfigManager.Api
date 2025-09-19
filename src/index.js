require('dotenv').config();

const express = require('express');
const redisService = require('./services/redis');
const corsMiddleware = require('./middleware/cors');
const { errorHandler, notFoundHandler } = require('./middleware/error');
const configRoutes = require('./routes/config');

const app = express();
const PORT = process.env.PORT || 3001;

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

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    // Connect to Redis
    console.log('Connecting to Redis...');
    await redisService.connect();
    console.log('Redis connected successfully');

    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`ConfigManager Redis Proxy running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await redisService.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');  
  await redisService.disconnect();
  process.exit(0);
});

// Uncaught exception handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();