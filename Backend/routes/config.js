const express = require('express');
const router = express.Router();
const Configuration = require('../models/Configuration');
const { validationResult, body } = require('express-validator');
const { AppError, ValidationError } = require('../middleware/errorHandler');

// GET /api/config - Get user configuration
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id;
    let config = await Configuration.getCurrent();
    
    // Configuration is handled by the static method getCurrent()
    
    res.json({
      success: true,
      data: config,
      message: 'Configuration retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/config - Update user configuration
router.put('/', [
  body('trello.apiKey').optional().isString().trim(),
  body('trello.token').optional().isString().trim(),
  body('trello.boardId').optional().isString().trim(),
  body('notifications.email.enabled').optional().isBoolean(),
  body('notifications.email.address').optional().isEmail(),
  body('notifications.sms.enabled').optional().isBoolean(),
  body('notifications.sms.phoneNumber').optional().isString().trim(),
  body('notifications.whatsapp.enabled').optional().isBoolean(),
  body('notifications.whatsapp.phoneNumber').optional().isString().trim(),
  body('reminders.dueDateOffset').optional().isInt({ min: 0, max: 168 }),
  body('reminders.overdueChecks').optional().isBoolean(),
  body('reminders.timezone').optional().isString().trim()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid configuration data', errors.array());
    }

    const userId = req.user.id;
    const updateData = req.body;

    let config = await Configuration.updateConfig(updateData, userId);

    res.json({
      success: true,
      data: config,
      message: 'Configuration updated successfully'
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      next(new ValidationError('Configuration validation failed', error.errors));
    } else {
      next(error);
    }
  }
});

// DELETE /api/config - Reset configuration to defaults
router.delete('/', async (req, res, next) => {
  try {
    const userId = req.user.id;
    await Configuration.deleteOne({});

    res.json({
      success: true,
      message: 'Configuration reset to defaults'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
