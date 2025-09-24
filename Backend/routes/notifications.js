const express = require('express');
const router = express.Router();
const { validationResult, body, query } = require('express-validator');
const { AppError, ValidationError } = require('../middleware/errorHandler');
const NotificationService = require('../services/notificationService');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');
const whatsappService = require('../services/whatsappService');

// GET /api/notifications/test - Test notification services
router.get('/test', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const serviceStatus = NotificationService.getServicesStatus();
    
    res.json({
      success: true,
      data: {
        services: serviceStatus,
        userId,
        timestamp: new Date().toISOString()
      },
      message: 'Notification services status retrieved'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/notifications/test/email - Test email notification
router.post('/test/email', [
  body('email').isEmail().normalizeEmail(),
  body('subject').optional().trim().isLength({ min: 1, max: 200 }),
  body('message').optional().trim().isLength({ min: 1, max: 1000 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid email test parameters', errors.array());
    }

    const { email, subject, message } = req.body;
    const testSubject = subject || 'AutoReminder Test Email';
    const testMessage = message || 'This is a test email from AutoReminder to verify your email configuration.';

    await emailService.sendEmail({
      to: email,
      subject: testSubject,
      text: testMessage,
      html: `<p>${testMessage}</p>`
    });

    res.json({
      success: true,
      message: 'Test email sent successfully',
      data: {
        email,
        subject: testSubject,
        sentAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(new AppError(`Failed to send test email: ${error.message}`, 400));
  }
});

// POST /api/notifications/test/sms - Test SMS notification
router.post('/test/sms', [
  body('phoneNumber').isMobilePhone(),
  body('message').optional().trim().isLength({ min: 1, max: 160 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid SMS test parameters', errors.array());
    }

    const { phoneNumber, message } = req.body;
    const testMessage = message || 'This is a test SMS from AutoReminder to verify your SMS configuration.';

    await smsService.sendSMS({
      to: phoneNumber,
      body: testMessage
    });

    res.json({
      success: true,
      message: 'Test SMS sent successfully',
      data: {
        phoneNumber,
        message: testMessage,
        sentAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(new AppError(`Failed to send test SMS: ${error.message}`, 400));
  }
});

// POST /api/notifications/test/whatsapp - Test WhatsApp notification
router.post('/test/whatsapp', [
  body('phoneNumber').isMobilePhone(),
  body('message').optional().trim().isLength({ min: 1, max: 1000 })
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid WhatsApp test parameters', errors.array());
    }

    const { phoneNumber, message } = req.body;
    const testMessage = message || 'This is a test WhatsApp message from AutoReminder to verify your WhatsApp configuration.';

    await whatsappService.sendWhatsApp({
      to: phoneNumber,
      body: testMessage
    });

    res.json({
      success: true,
      message: 'Test WhatsApp message sent successfully',
      data: {
        phoneNumber,
        message: testMessage,
        sentAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(new AppError(`Failed to send test WhatsApp message: ${error.message}`, 400));
  }
});

// POST /api/notifications/send - Send notification manually
router.post('/send', [
  body('type').isIn(['email', 'sms', 'whatsapp']),
  body('recipient').notEmpty().trim(),
  body('subject').optional().trim().isLength({ max: 200 }),
  body('message').notEmpty().trim().isLength({ min: 1, max: 2000 }),
  body('templateId').optional().isMongoId(),
  body('variables').optional().isObject()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid notification parameters', errors.array());
    }

    const { type, recipient, subject, message, templateId, variables } = req.body;
    const userId = req.user.id;

    let result;
    switch (type) {
      case 'email':
        result = await emailService.sendEmail({
          to: recipient,
          subject: subject || 'AutoReminder Notification',
          text: message,
          html: `<p>${message}</p>`
        });
        break;
      case 'sms':
        result = await smsService.sendSMS({
          to: recipient,
          body: message
        });
        break;
      case 'whatsapp':
        result = await whatsappService.sendWhatsApp({
          to: recipient,
          body: message
        });
        break;
    }

    res.json({
      success: true,
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} notification sent successfully`,
      data: {
        type,
        recipient,
        subject,
        message,
        result,
        sentAt: new Date().toISOString()
      }
    });
  } catch (error) {
    next(new AppError(`Failed to send ${req.body.type} notification: ${error.message}`, 400));
  }
});

// GET /api/notifications/history - Get notification history
router.get('/history', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('type').optional().isIn(['email', 'sms', 'whatsapp']),
  query('status').optional().isIn(['sent', 'failed', 'pending']),
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

    // This would typically query a NotificationHistory model
    // For now, return mock data structure
    const mockHistory = {
      notifications: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
      }
    };

    res.json({
      success: true,
      data: mockHistory,
      message: 'Notification history retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/notifications/stats - Get notification statistics
router.get('/stats', [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid query parameters', errors.array());
    }

    const userId = req.user.id;
    
    // Mock statistics - would typically aggregate from notification history
    const stats = {
      total: 0,
      byType: {
        email: 0,
        sms: 0,
        whatsapp: 0
      },
      byStatus: {
        sent: 0,
        failed: 0,
        pending: 0
      },
      recentActivity: [],
      serviceHealth: NotificationService.getServicesStatus()
    };

    res.json({
      success: true,
      data: stats,
      message: 'Notification statistics retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/notifications/settings - Update notification settings
router.put('/settings', [
  body('email.enabled').optional().isBoolean(),
  body('email.address').optional().isEmail(),
  body('sms.enabled').optional().isBoolean(),
  body('sms.phoneNumber').optional().isMobilePhone(),
  body('whatsapp.enabled').optional().isBoolean(),
  body('whatsapp.phoneNumber').optional().isMobilePhone(),
  body('preferences.frequency').optional().isIn(['immediate', 'hourly', 'daily']),
  body('preferences.quietHours.enabled').optional().isBoolean(),
  body('preferences.quietHours.start').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('preferences.quietHours.end').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid notification settings', errors.array());
    }

    const userId = req.user.id;
    const settings = req.body;

    // This would typically update the user's configuration
    // For now, just validate and return the settings
    res.json({
      success: true,
      data: settings,
      message: 'Notification settings updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
