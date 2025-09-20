const { errorHandler, notFoundHandler } = require('../../src/middleware/error');

describe('Error Handler Middleware Unit Tests', () => {
  let mockReq, mockRes, mockNext, consoleSpy;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
    
    // Mock console.error to keep tests clean
    consoleSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('errorHandler', () => {
    test('should handle Redis connection errors', () => {
      const mockError = { 
        message: 'Redis client not connected',
        code: 'REDIS_ERROR'
      };

      errorHandler(mockError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Service Unavailable',
        message: 'Redis connection not available'
      });
      expect(consoleSpy).toHaveBeenCalledWith('Error:', mockError);
    });

    test('should handle Redis operation errors with ECONNREFUSED', () => {
      const mockError = { 
        code: 'ECONNREFUSED',
        message: 'Connection refused'
      };

      errorHandler(mockError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Service Unavailable',
        message: 'Redis service unavailable'
      });
    });

    test('should handle JSON parsing errors', () => {
      const mockError = { 
        type: 'entity.parse.failed',
        status: 400,
        body: '{"invalid": json}'
      };

      errorHandler(mockError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Bad Request',
        message: 'Invalid JSON format'
      });
    });

    test('should handle validation errors', () => {
      const mockError = { 
        type: 'validation',
        message: 'Project parameter is required'
      };

      errorHandler(mockError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Bad Request',
        message: 'Project parameter is required'
      });
    });

    test('should handle generic errors in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const mockError = { 
        message: 'Something went wrong',
        stack: 'Error stack trace'
      };

      errorHandler(mockError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'Something went wrong'
      });

      process.env.NODE_ENV = originalEnv;
    });

    test('should handle generic errors in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const mockError = { 
        message: 'Internal error details',
        stack: 'Error stack trace'
      };

      errorHandler(mockError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'Something went wrong'
      });

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('notFoundHandler', () => {
    test('should handle 404 errors correctly', () => {
      mockReq.method = 'GET';
      mockReq.path = '/nonexistent/route';

      notFoundHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Not Found',
        message: 'Route GET /nonexistent/route not found'
      });
    });

    test('should handle POST 404 errors', () => {
      mockReq.method = 'POST';
      mockReq.path = '/api/missing';

      notFoundHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Not Found',
        message: 'Route POST /api/missing not found'
      });
    });
  });
});