const { validationResult } = require('express-validator');
const Configuration = require('../models/Configuration');
const logger = require('../utils/logger');

/**
 * Configuration Controller - Handles system configuration
 */
class ConfigController {
  /**
   * Get system configuration
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getConfig(req, res) {
    try {
      // Get configuration from database or create default
      let config = await Configuration.findOne({});
      if (!config) {
        config = await Configuration.create({});
        logger.log('info', 'Created default configuration');
      }

      res.json(config);
    } catch (error) {
      logger.log('error', `Get config error: ${error.message}`);
      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * Update system configuration
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateConfig(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        weekendDays,
        reminderTimes,
        maxReminderDays,
        timezone,
        allowUrgentOverride
      } = req.body;

      // Get configuration from database or create default
      let config = await Configuration.findOne({});
      if (!config) {
        config = new Configuration({});
      }

      // Update configuration fields
      if (weekendDays) config.weekendDays = weekendDays;
      if (reminderTimes) config.reminderTimes = reminderTimes;
      if (maxReminderDays) config.maxReminderDays = maxReminderDays;
      if (timezone) config.timezone = timezone;
      if (allowUrgentOverride !== undefined) config.allowUrgentOverride = allowUrgentOverride;

      // Save updated configuration
      await config.save();

      logger.log('info', 'Configuration updated');
      res.json(config);
    } catch (error) {
      logger.log('error', `Update config error: ${error.message}`);
      res.status(500).json({ message: 'Server error' });
    }
  }
}

module.exports = new ConfigController();
