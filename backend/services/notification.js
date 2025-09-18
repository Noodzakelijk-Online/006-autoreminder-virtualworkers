const { validationResult } = require('express-validator');
const notificationService = require('../services/notifications');
const Card = require('../models/Card');
const logger = require('../utils/logger');

/**
 * Notification Controller - Handles notification management
 */
class NotificationController {
  /**
   * Send manual notification
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async sendNotification(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { cardId, channels, message } = req.body;
      
      // Get card from database
      const card = await Card.findOne({ trelloId: cardId });
      if (!card) {
        return res.status(404).json({ message: 'Card not found' });
      }
      
      // Validate channels
      const validChannels = ['email', 'sms', 'whatsapp', 'trello'];
      const selectedChannels = channels || ['email'];
      
      // Validate that all selected channels are valid
      if (!selectedChannels.every(channel => validChannels.includes(channel))) {
        return res.status(400).json({ message: 'Invalid channel selected' });
      }
      
      // Send notifications through selected channels
      const results = {
        email: [],
        sms: [],
        whatsapp: [],
        trello: null
      };
      
      // Process each user
      for (const user of card.assignedUsers) {
        // Send email if selected and user has email
        if (selectedChannels.includes('email') && user.email) {
          try {
            const result = await notificationService.sendEmail(user, card);
            results.email.push({ user: user.username, success: true });
          } catch (error) {
            results.email.push({ user: user.username, success: false, error: error.message });
          }
        }
        
        // Send SMS if selected and user has phone
        if (selectedChannels.includes('sms') && user.phone) {
          try {
            const result = await notificationService.sendSMS(user, card);
            results.sms.push({ user: user.username, success: true });
          } catch (error) {
            results.sms.push({ user: user.username, success: false, error: error.message });
          }
        }
        
        // Send WhatsApp if selected and user has phone
        if (selectedChannels.includes('whatsapp') && user.phone) {
          try {
            const result = await notificationService.sendWhatsApp(user, card);
            results.whatsapp.push({ user: user.username, success: true });
          } catch (error) {
            results.whatsapp.push({ user: user.username, success: false, error: error.message });
          }
        }
      }
      
      // Send Trello comment if selected
      if (selectedChannels.includes('trello')) {
        try {
          const trelloService = require('../services/trello');
          const result = await trelloService.postComment(cardId, card.assignedUsers, message || 'Please provide an update.');
          results.trello = { success: true };
        } catch (error) {
          results.trello = { success: false, error: error.message };
        }
      }
      
      logger.log('info', `Manual notifications sent for card ${card.name}`);
      res.json({ message: 'Notifications sent', results });
    } catch (error) {
      logger.log('error', `Send notification error: ${error.message}`);
      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * Get notification status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getNotificationStatus(req, res) {
    try {
      const { cardId } = req.query;
      
      // If card ID is provided, get status for specific card
      if (cardId) {
        const card = await Card.findOne({ trelloId: cardId });
        if (!card) {
          return res.status(404).json({ message: 'Card not found' });
        }
        
        return res.json({
          cardId: card.trelloId,
          cardName: card.name,
          reminderStatus: card.reminderStatus
        });
      }
      
      // Otherwise, get overall notification statistics
      const totalCards = await Card.countDocuments();
      const cardsWithReminders = await Card.countDocuments({ 'reminderStatus.reminderCount': { $gt: 0 } });
      const cardsWithResponses = await Card.countDocuments({ 'reminderStatus.hasResponse': true });
      
      // Get cards by reminder count
      const reminderCounts = await Card.aggregate([
        {
          $group: {
            _id: '$reminderStatus.reminderCount',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]);
      
      res.json({
        totalCards,
        cardsWithReminders,
        cardsWithResponses,
        responseRate: totalCards > 0 ? cardsWithResponses / totalCards : 0,
        reminderCounts
      });
    } catch (error) {
      logger.log('error', `Get notification status error: ${error.message}`);
      res.status(500).json({ message: 'Server error' });
    }
  }
}

module.exports = new NotificationController();
