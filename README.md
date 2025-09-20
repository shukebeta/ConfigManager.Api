# ConfigManager Redis Proxy

A lightweight REST API proxy for Redis configuration management.

## Features

- **GET /redis/:key** - Retrieve configuration values
- **POST /redis/:key** - Set configuration values (atomic SET + PUBLISH)
- **Health Check** - `/health` endpoint for service monitoring
- **Error Handling** - Comprehensive error responses
- **CORS Support** - Cross-origin requests enabled

## Quick Start

### Prerequisites
- Node.js 18+
- Redis server running (default: localhost:6379)

### Installation
```bash
cd src/ConfigManager.Web/redis-proxy
npm install
```

### Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit configuration (optional)
# Default values work for local development
```

### Development
```bash
# Start in development mode (with auto-reload)
npm run dev

# Or start normally
npm start
```

### Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## API Usage

### Health Check
```bash
curl http://localhost:3001/health
```

### Get Configuration
```bash
curl http://localhost:3001/redis/newwords.api:config:nlog:minlevel
```

### Set Configuration
```bash
curl -X POST http://localhost:3001/redis/newwords.api:config:nlog:minlevel \
  -H "Content-Type: application/json" \
  -d '{"value": "Debug"}'
```

## Testing with NewWords.Api

1. **Start Redis Proxy**:
   ```bash
   cd src/ConfigManager.Web/redis-proxy
   npm run dev
   ```

2. **Set a configuration**:
   ```bash
   curl -X POST http://localhost:3001/redis/newwords.api:config:nlog:minlevel \
     -H "Content-Type: application/json" \
     -d '{"value": "Debug"}'
   ```

3. **Verify in NewWords.Api logs** - You should see the configuration change take effect and DEBUG messages appear.

4. **Get current value**:
   ```bash
   curl http://localhost:3001/redis/newwords.api:config:nlog:minlevel
   ```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | HTTP server port |
| `REDIS_URL` | redis://localhost:6379 | Redis connection URL |
| `CORS_ORIGIN` | http://localhost:3000 | Allowed CORS origin |
| `NODE_ENV` | development | Environment mode |
| `LOG_LEVEL` | info | Logging level (error, warn, info, debug) |
| `SEQ_URL` | - | Optional: Seq server URL for structured logging |
| `SEQ_API_KEY` | - | Optional: Seq API key for authentication |

## Logging

ConfigManager supports two logging modes:

### Console Logging (Default)
When no `SEQ_URL` is provided, the service uses pretty-formatted console logging ideal for development:

```bash
[2025-09-20 16:28:20.301 +1200] INFO: ConfigManager Redis Proxy started
    port: "3001"
    environment: "development"
    healthCheck: "http://localhost:3001/health"
```

### Structured Logging to Seq
When `SEQ_URL` is configured, the service sends structured logs to your Seq server:

```bash
# Enable Seq logging
SEQ_URL=http://your-seq-server:5341
SEQ_API_KEY=your_optional_api_key
```

This provides powerful log analysis, searching, and alerting capabilities through Seq's web interface.

## API Response Format

### Success Response
```json
{
  "success": true,
  "key": "newwords.api:config:nlog:minlevel",
  "value": "Debug",
  "operations": {
    "set": true,
    "published": 1
  }
}
```

### Error Response
```json
{
  "error": "Bad Request",
  "message": "Value is required in request body"
}
```

## Development Notes

- Redis operations use pipeline for atomicity (SET + PUBLISH)
- Comprehensive test coverage with Jest
- Graceful shutdown handling
- Connection retry logic built-in
- All values stored as strings in Redis

## Next Steps

This is Phase 2.1 of the ConfigManager.Web project. Next phases will add:
- Project discovery (`GET /redis/projects`)
- Configuration categorization (`GET /redis/:project/configs`)  
- Configuration history and rollback features