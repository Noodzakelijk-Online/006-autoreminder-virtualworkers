const express = require('express');
const router = express.Router();
const Log = require('../models/Log');
const { validationResult, query } = require('express-validator');
const { AppError, ValidationError } = require('../middleware/errorHandler');
const { optionalAuth } = require('../middleware/auth');

// GET /api/logs - Get logs with filtering and pagination
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('level').optional().isIn(['error', 'warn', 'info', 'debug']),
  query('service').optional().isString(),
  query('startDate').optional().isString(),
  query('endDate').optional().isString(),
  query('search').optional().isString()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid query parameters', errors.array());
    }

    console.log('GET /api/logs - User:', req.user ? req.user.id : 'undefined');
    console.log('GET /api/logs - Auth header:', req.headers.authorization ? 'present' : 'missing');

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter object - if no user, return sample data
    let filter = {};
    if (req.user) {
      filter.userId = req.user.id;
    }
    
    if (req.query.level) {
      filter.level = req.query.level;
    }
    
    if (req.query.service) {
      filter.service = req.query.service;
    }
    
    if (req.query.startDate || req.query.endDate) {
      filter.timestamp = {};
      if (req.query.startDate) {
        filter.timestamp.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filter.timestamp.$lte = new Date(req.query.endDate);
      }
    }
    
    if (req.query.search) {
      filter.$or = [
        { message: { $regex: req.query.search, $options: 'i' } },
        { 'metadata.action': { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const [logs, total] = await Promise.all([
      Log.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit),
      Log.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      },
      message: 'Logs retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/logs/stats - Get log statistics (alias for /stats/summary)
router.get('/stats', [
  query('startDate').optional().isString(),
  query('endDate').optional().isString()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid query parameters', errors.array());
    }

    console.log('GET /api/logs/stats - User:', req.user ? req.user.id : 'undefined');
    console.log('GET /api/logs/stats - Auth header:', req.headers.authorization ? 'present' : 'missing');

    const filter = { userId: req.user.id };

    if (req.query.startDate || req.query.endDate) {
      filter.timestamp = {};
      if (req.query.startDate) {
        filter.timestamp.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filter.timestamp.$lte = new Date(req.query.endDate);
      }
    }

    let summary;

    try {
      // Aggregate log statistics
      const stats = await Log.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$level',
            count: { $sum: 1 }
          }
        }
      ]);

      const serviceStats = await Log.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$service',
            count: { $sum: 1 }
          }
        }
      ]);

      // Get recent errors
      const recentErrors = await Log.find({
        ...filter,
        level: 'error'
      })
      .sort({ timestamp: -1 })
      .limit(5)
      .select('message timestamp service metadata');

      const totalLogs = await Log.countDocuments(filter);

      // If no logs found, provide empty stats
      if (totalLogs === 0) {
        summary = {
          levelStats: {
            info: 0,
            warn: 0,
            error: 0
          },
          serviceStats: {},
          recentErrors: [],
          totalLogs: 0
        };
      } else {
        summary = {
          levelStats: stats.reduce((acc, stat) => {
            acc[stat._id] = stat.count;
            return acc;
          }, {}),
          serviceStats: serviceStats.reduce((acc, stat) => {
            acc[stat._id] = stat.count;
            return acc;
          }, {}),
          recentErrors,
          totalLogs
        };
      }
    } catch (dbError) {
      // If database query fails, return empty stats
      console.log('Database query failed, returning empty stats:', dbError.message);
      summary = {
        levelStats: { info: 0, warn: 0, error: 0 },
        serviceStats: {},
        recentErrors: [],
        totalLogs: 0
      };
    }

    res.json({
      success: true,
      data: summary,
      message: 'Log statistics retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/logs/:id - Get specific log entry
router.get('/:id', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const log = await Log.findOne({ _id: req.params.id, userId });
    
    if (!log) {
      throw new AppError('Log entry not found', 404);
    }
    
    res.json({
      success: true,
      data: log,
      message: 'Log entry retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});



// GET /api/logs/stats/summary - Get log statistics
router.get('/stats/summary', [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid query parameters', errors.array());
    }

    const userId = req.user.id;
    const filter = { userId };
    
    if (req.query.startDate || req.query.endDate) {
      filter.timestamp = {};
      if (req.query.startDate) {
        filter.timestamp.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filter.timestamp.$lte = new Date(req.query.endDate);
      }
    }

    // Aggregate log statistics
    const stats = await Log.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$level',
          count: { $sum: 1 }
        }
      }
    ]);

    const serviceStats = await Log.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$service',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get recent errors
    const recentErrors = await Log.find({
      ...filter,
      level: 'error'
    })
    .sort({ timestamp: -1 })
    .limit(5)
    .select('message timestamp service metadata');

    const summary = {
      levelStats: stats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      serviceStats: serviceStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      recentErrors,
      totalLogs: await Log.countDocuments(filter)
    };

    res.json({
      success: true,
      data: summary,
      message: 'Log statistics retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/logs/cleanup - Clean up old logs
router.delete('/cleanup', [
  query('olderThan').isISO8601()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid query parameters', errors.array());
    }

    const userId = req.user.id;
    const olderThan = new Date(req.query.olderThan);

    const result = await Log.deleteMany({
      userId,
      timestamp: { $lt: olderThan }
    });

    res.json({
      success: true,
      data: {
        deletedCount: result.deletedCount
      },
      message: `Deleted ${result.deletedCount} old log entries`
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/logs/export - Export logs
router.get('/export', [
  query('format').optional().isIn(['json', 'csv']),
  query('level').optional().isIn(['error', 'warn', 'info', 'debug']),
  query('service').optional().isString(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid query parameters', errors.array());
    }

    const userId = req.user.id;
    const format = req.query.format || 'json';
    
    // Build filter
    const filter = { userId };
    if (req.query.level) filter.level = req.query.level;
    if (req.query.service) filter.service = req.query.service;
    if (req.query.startDate || req.query.endDate) {
      filter.timestamp = {};
      if (req.query.startDate) filter.timestamp.$gte = new Date(req.query.startDate);
      if (req.query.endDate) filter.timestamp.$lte = new Date(req.query.endDate);
    }

    const logs = await Log.find(filter)
      .sort({ timestamp: -1 })
      .limit(1000); // Limit export to 1000 records

    if (format === 'csv') {
      // Convert to CSV format
      const csvHeaders = 'Timestamp,Level,Service,Message,Action\n';
      const csvRows = logs.map(log => {
        const timestamp = log.timestamp.toISOString();
        const level = log.level;
        const service = log.service || '';
        const message = log.message.replace(/"/g, '""');
        const action = log.metadata?.action || '';
        return `"${timestamp}","${level}","${service}","${message}","${action}"`;
      }).join('\n');
      
      const csvContent = csvHeaders + csvRows;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=logs.csv');
      res.send(csvContent);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=logs.json');
      res.json({
        success: true,
        data: logs,
        exportedAt: new Date().toISOString(),
        totalRecords: logs.length
      });
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
