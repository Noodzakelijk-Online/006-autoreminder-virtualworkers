const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const { validationResult, query, body } = require('express-validator');
const { AppError, ValidationError } = require('../middleware/errorHandler');

// GET /api/reports - Get reports with filtering and pagination
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('type').optional().isIn(['daily', 'weekly', 'monthly', 'custom']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid query parameters', errors.array());
    }

    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = { generatedBy: userId };
    if (req.query.type) {
      filter.reportType = req.query.type;
    }
    if (req.query.startDate || req.query.endDate) {
      filter.createdAt = {};
      if (req.query.startDate) {
        filter.createdAt.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filter.createdAt.$lte = new Date(req.query.endDate);
      }
    }

    const [reports, total] = await Promise.all([
      Report.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Report.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        reports,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      },
      message: 'Reports retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/:id - Get specific report
router.get('/:id', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const report = await Report.findOne({ _id: req.params.id, generatedBy: userId });
    
    if (!report) {
      throw new AppError('Report not found', 404);
    }
    
    res.json({
      success: true,
      data: report,
      message: 'Report retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/reports - Create/Submit new report
router.post('/', [
  body('title').optional().isString(),
  body('description').optional().isString(),
  body('reportType').optional().isIn(['daily', 'weekly', 'monthly', 'custom', 'manual']),
  body('startDate').optional().isString(),
  body('endDate').optional().isString(),
  body('metrics').optional().isObject(),
  body('status').optional().isIn(['pending', 'completed', 'failed'])
], async (req, res, next) => {
  try {
    // Log incoming request data for debugging
    console.log('POST /api/reports - Request body:', JSON.stringify(req.body, null, 2));
    console.log('POST /api/reports - Content-Type:', req.get('Content-Type'));
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', JSON.stringify(errors.array(), null, 2));
      throw new ValidationError('Invalid report data', errors.array());
    }

    const userId = req.user.id;
    const {
      title,
      description,
      reportType = 'manual',
      startDate,
      endDate,
      metrics,
      status = 'completed'
    } = req.body;

    // Auto-generate title if not provided
    const reportTitle = title || `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`;
    
    // Create report data
    const reportData = {
      generatedBy: userId,
      title: reportTitle,
      description: description || `Auto-generated ${reportType} report`,
      reportType,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : new Date(),
      metrics: metrics || {
        totalCards: 0,
        activeCards: 0,
        cardsWithResponse: 0,
        responseRate: 0,
        avgResponseTime: 0,
        overdueCards: 0,
        totalUsers: 0,
        activeUsers: 0,
        notificationsSent: {
          trello: 0,
          email: 0,
          sms: 0,
          whatsapp: 0
        },
        notificationsDelivered: {
          trello: 0,
          email: 0,
          sms: 0,
          whatsapp: 0
        },
        notificationsFailed: {
          trello: 0,
          email: 0,
          sms: 0,
          whatsapp: 0
        },
        systemErrors: 0,
        systemUptime: 100
      },
      status,
      generatedAt: new Date()
    };

    const report = new Report(reportData);
    await report.save();

    res.status(201).json({
      success: true,
      data: report,
      message: 'Report created successfully'
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      next(new ValidationError('Report creation failed', error.errors));
    } else {
      next(error);
    }
  }
});

// POST /api/reports/generate - Generate new report
router.post('/generate', [
  query('type').isIn(['daily', 'weekly', 'monthly', 'custom']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid report parameters', errors.array());
    }

    const userId = req.user.id;
    const { type, startDate, endDate } = req.query;

    // Calculate date range based on type
    let dateRange = {};
    const now = new Date();
    
    switch (type) {
      case 'daily':
        dateRange.startDate = new Date(now.setHours(0, 0, 0, 0));
        dateRange.endDate = new Date(now.setHours(23, 59, 59, 999));
        break;
      case 'weekly':
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        dateRange = { startDate: weekStart, endDate: weekEnd };
        break;
      case 'monthly':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        dateRange = { startDate: monthStart, endDate: monthEnd };
        break;
      case 'custom':
        if (!startDate || !endDate) {
          throw new ValidationError('Start date and end date are required for custom reports');
        }
        dateRange = {
          startDate: new Date(startDate),
          endDate: new Date(endDate)
        };
        break;
    }

    // Create report (this would typically involve aggregating data from logs, cards, etc.)
    const reportData = {
      generatedBy: userId,
      reportType: type,
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} Report`,
      description: `Auto-generated ${type} report for ${dateRange.startDate.toDateString()} to ${dateRange.endDate.toDateString()}`,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      metrics: {
        totalCards: 0,
        activeCards: 0,
        cardsWithResponse: 0,
        responseRate: 0,
        avgResponseTime: 0,
        overdueCards: 0,
        totalUsers: 0,
        activeUsers: 0,
        notificationsSent: {
          trello: 0,
          email: 0,
          sms: 0,
          whatsapp: 0
        },
        notificationsDelivered: {
          trello: 0,
          email: 0,
          sms: 0,
          whatsapp: 0
        },
        notificationsFailed: {
          trello: 0,
          email: 0,
          sms: 0,
          whatsapp: 0
        },
        systemErrors: 0,
        systemUptime: 100
      },
      status: 'completed',
      generatedAt: new Date()
    };

    const report = new Report(reportData);
    await report.save();

    res.status(201).json({
      success: true,
      data: report,
      message: 'Report generated successfully'
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      next(new ValidationError('Report generation failed', error.errors));
    } else {
      next(error);
    }
  }
});

// DELETE /api/reports/:id - Delete report
router.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const report = await Report.findOneAndDelete({ _id: req.params.id, generatedBy: userId });

    if (!report) {
      throw new AppError('Report not found', 404);
    }

    res.json({
      success: true,
      message: 'Report deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/analytics/summary - Get analytics summary
router.get('/analytics/summary', async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // This would typically aggregate data from various collections
    const summary = {
      totalReports: await Report.countDocuments({ generatedBy: userId }),
      recentActivity: {
        // Add recent activity data
      },
      trends: {
        // Add trend analysis
      }
    };

    res.json({
      success: true,
      data: summary,
      message: 'Analytics summary retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
