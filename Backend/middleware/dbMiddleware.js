const { ensureConnection } = require('../utils/dbConnection');

/**
 * Middleware to ensure database connection before processing API requests
 * This is especially important for serverless environments where connections may be cold
 */
const ensureDbConnection = async (req, res, next) => {
  try {
    // Only apply to API routes
    if (req.path.startsWith('/api/')) {
      console.log(`[DB MIDDLEWARE] Ensuring connection for ${req.method} ${req.path}`);
      await ensureConnection();
    }
    next();
  } catch (error) {
    console.error('[DB MIDDLEWARE] Database connection failed:', error);
    
    // Return a proper error response
    return res.status(503).json({
      success: false,
      error: {
        message: 'Database connection unavailable. Please try again in a moment.',
        type: 'DATABASE_CONNECTION_ERROR'
      }
    });
  }
};

module.exports = {
  ensureDbConnection
};
