const pino = require('pino');

/**
 * Create logger with automatic Seq detection
 * - If SEQ_URL is provided: Use structured logging to Seq
 * - If no SEQ_URL: Use pretty console logging (development-friendly)
 */
function createLogger() {
  const logLevel = process.env.LOG_LEVEL || 'info';
  const seqUrl = process.env.SEQ_URL;
  const isTestEnv = process.env.NODE_ENV === 'test';
  
  // In test environment, minimize logging output
  if (isTestEnv) {
    return pino({
      level: 'error', // Only show errors in tests
      transport: {
        target: 'pino/file',
        options: { destination: '/dev/null' } // Silent in tests
      }
    });
  }
  
  // Production/development logger configuration
  const baseConfig = {
    level: logLevel,
    timestamp: pino.stdTimeFunctions.isoTime,
  };
  
  if (seqUrl) {
    // Seq mode: Structured logging to Seq server
    const seqApiKey = process.env.SEQ_API_KEY;
    
    return pino(baseConfig, pino.transport({
      target: 'pino-seq',
      options: {
        serverUrl: seqUrl,
        apiKey: seqApiKey,
        onError: (err) => {
          // Fallback to console if Seq is unavailable
          console.error('Failed to send logs to Seq:', err.message);
        }
      }
    }));
  } else {
    // Console mode: Pretty formatted for development
    return pino(baseConfig, pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      }
    }));
  }
}

const logger = createLogger();

// Ensure logs are flushed on exit
const gracefulShutdown = () => {
  logger.flush();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = logger;