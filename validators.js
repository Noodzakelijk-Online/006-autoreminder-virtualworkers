const { check } = require('express-validator');

/**
 * Validation middleware for user registration
 */
const validateRegister = [
  check('username', 'Username is required').not().isEmpty(),
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Password must be at least 6 characters').isLength({ min: 6 })
];

/**
 * Validation middleware for user login
 */
const validateLogin = [
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Password is required').exists()
];

/**
 * Validation middleware for template creation/update
 */
const validateTemplate = [
  check('name', 'Name is required').not().isEmpty(),
  check('type', 'Type must be one of: trello, email, sms, whatsapp').isIn(['trello', 'email', 'sms', 'whatsapp']),
  check('content', 'Content is required').not().isEmpty()
];

/**
 * Validation middleware for configuration update
 */
const validateConfig = [
  check('weekendDays', 'Weekend days must be an array of numbers between 0 and 6').optional().isArray(),
  check('weekendDays.*', 'Weekend day must be a number between 0 and 6').optional().isInt({ min: 0, max: 6 }),
  check('maxReminderDays', 'Max reminder days must be a number between 1 and 30').optional().isInt({ min: 1, max: 30 }),
  check('timezone', 'Timezone is required').optional().not().isEmpty(),
  check('allowUrgentOverride', 'Allow urgent override must be a boolean').optional().isBoolean()
];

/**
 * Validation middleware for report generation
 */
const validateReportGeneration = [
  check('reportType', 'Report type must be one of: daily, weekly').isIn(['daily', 'weekly']),
  check('startDate', 'Start date is required').not().isEmpty(),
  check('endDate', 'End date is required').not().isEmpty()
];

/**
 * Validation middleware for notification sending
 */
const validateNotification = [
  check('cardId', 'Card ID is required').not().isEmpty(),
  check('channels', 'Channels must be an array').optional().isArray(),
  check('channels.*', 'Channel must be one of: email, sms, whatsapp, trello').optional().isIn(['email', 'sms', 'whatsapp', 'trello'])
];

module.exports = {
  validateRegister,
  validateLogin,
  validateTemplate,
  validateConfig,
  validateReportGeneration,
  validateNotification
};
