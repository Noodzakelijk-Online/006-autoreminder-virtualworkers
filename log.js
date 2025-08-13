const { validationResult } = require('express-validator');
const Log = require('../models/Log');
const logger = require('../utils/logger');

/**
 * Log Controller - Handles activity logs
 */
class LogController {
  /**
   * Get all logs with pagination and filtering
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getLogs(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;
      
      // Build query from filters
      const query = {};
      
      // Filter by type
      if (req.query.type) {
        query.type = req.query.type;
      }
      
      // Filter by channel
      if (req.query.channel) {
        query.channel = req.query.channel;
      }
      
      // Filter by status
      if (req.query.status) {
        query.status = req.query.status;
      }
      
      // Filter by card ID
      if (req.query.cardId) {
        query.cardId = req.query.cardId;
      }
      
      // Filter by user ID
      if (req.query.userId) {
        query.userId = req.query.userId;
      }
      
      // Filter by date range
      if (req.query.startDate && req.query.endDate) {
        query.timestamp = {
          $gte: new Date(req.query.startDate),
          $lte: new Date(req.query.endDate)
        };
      } else if (req.query.startDate) {
        query.timestamp = { $gte: new Date(req.query.startDate) };
      } else if (req.query.endDate) {
        query.timestamp = { $lte: new Date(req.query.endDate) };
      }
      
      // Get logs with pagination
      const logs = await Log.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit);
        
      // Get total count for pagination
      const total = await Log.countDocuments(query);
      
      res.json({
        logs,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.log('error', `Get logs error: ${error.message}`);
      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * Get log statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getLogStats(req, res) {
    try {
      // Get date range from query params or default to last 7 days
      let startDate = req.query.startDate ? new Date(req.query.startDate) : new Date();
      let endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
      
      if (!req.query.startDate) {
        startDate.setDate(startDate.getDate() - 7);
      }
      
      // Count logs by type
      const typeStats = await Log.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 }
          }
        }
      ]);
      
      // Count logs by channel
      const channelStats = await Log.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate, $lte: endDate },
            channel: { $exists: true }
          }
        },
        {
          $group: {
            _id: '$channel',
            count: { $sum: 1 }
          }
        }
      ]);
      
      // Count logs by status
      const statusStats = await Log.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);
      
      // Count logs by day
      const dailyStats = await Log.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$timestamp' },
              month: { $month: '$timestamp' },
              day: { $dayOfMonth: '$timestamp' }
            },
            count: { $sum: 1 }
          }
        },
        {
          $sort: {
            '_id.year': 1,
            '_id.month': 1,
            '_id.day': 1
          }
        }
      ]);
      
      // Format daily stats for easier consumption
      const formattedDailyStats = dailyStats.map(stat => {
        const date = new Date(stat._id.year, stat._id.month - 1, stat._id.day);
        return {
          date: date.toISOString().split('T')[0],
          count: stat.count
        };
      });
      
      res.json({
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        byType: typeStats,
        byChannel: channelStats,
        byStatus: statusStats,
        byDay: formattedDailyStats
      });
    } catch (error) {
      logger.log('error', `Get log stats error: ${error.message}`);
      res.status(500).json({ message: 'Server error' });
    }
  }
}

module.exports = new LogController();
