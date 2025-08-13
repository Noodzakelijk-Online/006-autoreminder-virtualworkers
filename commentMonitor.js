/**
 * Comment Monitor Service
 * Monitors Trello comments for VA progress updates and processes them
 */

const axios = require('axios');
const ProgressReport = require('../models/ProgressReport');
const ReportConfiguration = require('../models/ReportConfiguration');
const trelloService = require('./trello');
const logger = require('../utils/logger');

class CommentMonitorService {
  constructor() {
    this.pollingInterval = 15 * 60 * 1000; // 15 minutes in milliseconds
    this.pollingTimer = null;
    this.isPolling = false;
  }

  /**
   * Start monitoring comments on a schedule
   */
  startMonitoring() {
    if (this.isPolling) {
      logger.info('Comment monitoring is already active');
      return;
    }

    logger.info('Starting Trello comment monitoring service');
    this.isPolling = true;
    
    // Immediate first check
    this.checkForNewComments();
    
    // Set up recurring checks
    this.pollingTimer = setInterval(() => {
      this.checkForNewComments();
    }, this.pollingInterval);
  }

  /**
   * Stop monitoring comments
   */
  stopMonitoring() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      this.isPolling = false;
      logger.info('Stopped Trello comment monitoring service');
    }
  }

  /**
   * Check for new comments on monitored boards and cards
   */
  async checkForNewComments() {
    try {
      logger.info('Checking for new VA progress update comments');
      
      // Get active report configurations
      const configurations = await ReportConfiguration.findActive();
      
      if (configurations.length === 0) {
        logger.info('No active report configurations found');
        return;
      }
      
      // Process each configuration
      for (const config of configurations) {
        await this.processConfiguration(config);
      }
      
      logger.info('Completed checking for new VA progress update comments');
    } catch (error) {
      logger.error('Error checking for new comments:', error);
    }
  }

  /**
   * Process a single report configuration
   * @param {Object} config - Report configuration
   */
  async processConfiguration(config) {
    try {
      // Get all boards to monitor from this configuration
      for (const boardId of config.boardIds) {
        // Get all cards on this board
        const cards = await trelloService.getBoardCards(boardId);
        
        // Filter cards assigned to monitored VAs
        const filteredCards = this.filterCardsByVAs(cards, config.virtualAssistantIds);
        
        // Process each card
        for (const card of filteredCards) {
          await this.processCardComments(card, config);
        }
      }
    } catch (error) {
      logger.error(`Error processing configuration ${config.name}:`, error);
    }
  }

  /**
   * Filter cards by virtual assistant assignments
   * @param {Array} cards - List of Trello cards
   * @param {Array} vaIds - List of VA IDs to monitor
   * @returns {Array} Filtered cards
   */
  filterCardsByVAs(cards, vaIds) {
    // If no specific VAs are configured, monitor all cards
    if (!vaIds || vaIds.length === 0) {
      return cards;
    }
    
    // Filter cards that have at least one of the monitored VAs assigned
    return cards.filter(card => {
      if (!card.idMembers || card.idMembers.length === 0) {
        return false;
      }
      
      return card.idMembers.some(memberId => vaIds.includes(memberId));
    });
  }

  /**
   * Process comments on a single card
   * @param {Object} card - Trello card
   * @param {Object} config - Report configuration
   */
  async processCardComments(card, config) {
    try {
      // Get all comments on this card
      const actions = await trelloService.getCardActions(card.id, 'commentCard');
      
      if (!actions || actions.length === 0) {
        return;
      }
      
      // Get the last processed comment timestamp for this card
      const lastProcessed = await this.getLastProcessedTimestamp(card.id);
      
      // Filter for new comments only
      const newComments = actions.filter(action => {
        const commentDate = new Date(action.date);
        return !lastProcessed || commentDate > lastProcessed;
      });
      
      if (newComments.length === 0) {
        return;
      }
      
      // Process new comments
      for (const comment of newComments) {
        await this.processComment(comment, card, config);
      }
    } catch (error) {
      logger.error(`Error processing comments for card ${card.id}:`, error);
    }
  }

  /**
   * Get the timestamp of the last processed comment for a card
   * @param {String} cardId - Trello card ID
   * @returns {Date|null} Timestamp or null if no comments processed
   */
  async getLastProcessedTimestamp(cardId) {
    const latestReport = await ProgressReport.findOne({ cardId })
      .sort({ 'commentTimestamps': -1 })
      .limit(1);
      
    if (!latestReport || !latestReport.commentTimestamps || latestReport.commentTimestamps.length === 0) {
      return null;
    }
    
    return new Date(Math.max(...latestReport.commentTimestamps.map(date => date.getTime())));
  }

  /**
   * Process a single comment for progress update information
   * @param {Object} comment - Trello comment action
   * @param {Object} card - Trello card
   * @param {Object} config - Report configuration
   */
  async processComment(comment, card, config) {
    try {
      // Check if this is a VA comment
      if (!config.virtualAssistantIds.includes(comment.idMemberCreator)) {
        return;
      }
      
      // Parse the comment text for progress update information
      const parsedData = this.parseCommentText(comment.data.text, config.parsePatterns);
      
      // If no relevant data found, skip
      if (!parsedData.isProgressUpdate) {
        return;
      }
      
      // Get VA information
      const member = await trelloService.getMember(comment.idMemberCreator);
      
      // Create or update progress report
      await this.createOrUpdateProgressReport({
        virtualAssistantId: comment.idMemberCreator,
        virtualAssistantName: member ? member.fullName : 'Unknown VA',
        date: new Date(),
        cardId: card.id,
        cardName: card.name,
        boardId: card.idBoard,
        boardName: card.board ? card.board.name : 'Unknown Board',
        taskStatus: parsedData.taskStatus || 'In Progress',
        completedItems: parsedData.completedItems || [],
        blockers: parsedData.blockers || [],
        additionalNotes: parsedData.additionalNotes || '',
        commentIds: [comment.id],
        commentTexts: [comment.data.text],
        commentTimestamps: [new Date(comment.date)],
        recipients: config.recipients
      });
      
      logger.info(`Processed progress update from VA ${comment.idMemberCreator} for card ${card.id}`);
    } catch (error) {
      logger.error(`Error processing comment ${comment.id}:`, error);
    }
  }

  /**
   * Parse comment text for progress update information
   * @param {String} text - Comment text
   * @param {Array} patterns - Regex patterns to use
   * @returns {Object} Parsed data
   */
  parseCommentText(text, patterns) {
    const result = {
      isProgressUpdate: false,
      taskStatus: null,
      completedItems: [],
      blockers: [],
      additionalNotes: ''
    };
    
    // Default patterns if none provided
    const parsePatterns = patterns || [
      "status:([\\w\\s]+)",
      "completed:([\\w\\s,]+)",
      "blockers?:([\\w\\s,]+)",
      "notes?:([\\w\\s,]+)"
    ];
    
    // Check for status
    const statusMatch = text.match(new RegExp(parsePatterns[0], 'i'));
    if (statusMatch && statusMatch[1]) {
      result.taskStatus = statusMatch[1].trim();
      result.isProgressUpdate = true;
    }
    
    // Check for completed items
    const completedMatch = text.match(new RegExp(parsePatterns[1], 'i'));
    if (completedMatch && completedMatch[1]) {
      result.completedItems = completedMatch[1].split(',').map(item => item.trim());
      result.isProgressUpdate = true;
    }
    
    // Check for blockers
    const blockersMatch = text.match(new RegExp(parsePatterns[2], 'i'));
    if (blockersMatch && blockersMatch[1]) {
      result.blockers = blockersMatch[1].split(',').map(item => item.trim());
      result.isProgressUpdate = true;
    }
    
    // Check for additional notes
    const notesMatch = text.match(new RegExp(parsePatterns[3], 'i'));
    if (notesMatch && notesMatch[1]) {
      result.additionalNotes = notesMatch[1].trim();
      result.isProgressUpdate = true;
    }
    
    // If no structured data found, check for keywords that might indicate a progress update
    if (!result.isProgressUpdate) {
      const progressKeywords = ['progress', 'update', 'status', 'completed', 'done', 'blocker', 'issue'];
      result.isProgressUpdate = progressKeywords.some(keyword => text.toLowerCase().includes(keyword));
      
      // If it seems like a progress update but we couldn't parse structured data,
      // store the whole comment as additional notes
      if (result.isProgressUpdate) {
        result.additionalNotes = text;
      }
    }
    
    return result;
  }

  /**
   * Create or update a progress report
   * @param {Object} reportData - Report data
   */
  async createOrUpdateProgressReport(reportData) {
    try {
      // Check if we already have a report for this VA and card today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const existingReport = await ProgressReport.findOne({
        virtualAssistantId: reportData.virtualAssistantId,
        cardId: reportData.cardId,
        date: {
          $gte: today,
          $lt: tomorrow
        }
      });
      
      if (existingReport) {
        // Update existing report
        existingReport.taskStatus = reportData.taskStatus || existingReport.taskStatus;
        
        if (reportData.completedItems && reportData.completedItems.length > 0) {
          existingReport.completedItems = [...new Set([...existingReport.completedItems, ...reportData.completedItems])];
        }
        
        if (reportData.blockers && reportData.blockers.length > 0) {
          existingReport.blockers = [...new Set([...existingReport.blockers, ...reportData.blockers])];
        }
        
        if (reportData.additionalNotes) {
          existingReport.additionalNotes += '\n\n' + reportData.additionalNotes;
        }
        
        existingReport.commentIds.push(reportData.commentIds[0]);
        existingReport.commentTexts.push(reportData.commentTexts[0]);
        existingReport.commentTimestamps.push(reportData.commentTimestamps[0]);
        existingReport.reportStatus = 'Draft';
        
        await existingReport.save();
        return existingReport;
      } else {
        // Create new report
        const newReport = new ProgressReport(reportData);
        await newReport.save();
        return newReport;
      }
    } catch (error) {
      logger.error('Error creating/updating progress report:', error);
      throw error;
    }
  }
}

module.exports = new CommentMonitorService();
