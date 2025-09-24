const axios = require('axios');
const Log = require('../models/Log');
const Card = require('../models/Card');

class TrelloService {
  constructor() {
    this.baseURL = 'https://api.trello.com/1';
    this.apiKey = process.env.TRELLO_API_KEY;
    this.token = process.env.TRELLO_TOKEN;
    this.excludedMemberId = process.env.TRELLO_EXCLUDED_MEMBER_ID || '59b3208fbd9a6b2be8b0a436';
    
    // Create axios instance with default config
    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      params: {
        key: this.apiKey,
        token: this.token
      }
    });

    // Add request/response interceptors for logging
    this.setupInterceptors();
  }

  setupInterceptors() {
    // Request interceptor
    this.api.interceptors.request.use(
      (config) => {
        console.log(`Trello API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('Trello API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.api.interceptors.response.use(
      (response) => {
        console.log(`Trello API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('Trello API Response Error:', error.response?.status, error.response?.data);
        
        // Log API errors
        Log.logError(error, {
          action: 'trello_api_call',
          metadata: {
            url: error.config?.url,
            method: error.config?.method,
            status: error.response?.status,
            data: error.response?.data
          }
        }).catch(logErr => console.error('Failed to log Trello API error:', logErr));

        return Promise.reject(error);
      }
    );
  }

  // Validate API credentials
  async validateCredentials() {
    try {
      const response = await this.api.get('/members/me');
      return {
        valid: true,
        member: response.data
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  // Get all organizations
  async getOrganizations() {
    try {
      const response = await this.api.get('/members/me/organizations');
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get organizations: ${error.message}`);
    }
  }

  // Get all boards for the authenticated user
  async getBoards(organizationId = null) {
    try {
      let url = '/members/me/boards';
      const params = {
        filter: 'open',
        fields: 'id,name,desc,url,dateLastActivity,prefs'
      };

      if (organizationId) {
        url = `/organizations/${organizationId}/boards`;
      }

      const response = await this.api.get(url, { params });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get boards: ${error.message}`);
    }
  }

  // Get board details
  async getBoardDetails(boardId) {
    try {
      const response = await this.api.get(`/boards/${boardId}`, {
        params: {
          fields: 'id,name,desc,url,dateLastActivity,prefs',
          lists: 'open',
          members: 'all',
          member_fields: 'id,username,fullName,email'
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get board details: ${error.message}`);
    }
  }

  // Get lists on a board
  async getBoardLists(boardId) {
    try {
      const response = await this.api.get(`/boards/${boardId}/lists`, {
        params: {
          filter: 'open',
          fields: 'id,name,pos'
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get board lists: ${error.message}`);
    }
  }

  // Get cards from a board
  async getCardsFromBoard(boardId) {
    try {
      const response = await this.api.get(`/boards/${boardId}/cards`, {
        params: {
          filter: 'open',
          fields: 'id,name,desc,url,shortUrl,due,dateLastActivity,idList,idMembers,labels',
          members: true,
          member_fields: 'id,username,fullName,email'
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get cards from board: ${error.message}`);
    }
  }

  // Get cards from a specific list
  async getCardsFromList(listId) {
    try {
      const response = await this.api.get(`/lists/${listId}/cards`, {
        params: {
          filter: 'open',
          fields: 'id,name,desc,url,shortUrl,due,dateLastActivity,idList,idMembers,labels',
          members: true,
          member_fields: 'id,username,fullName,email'
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get cards from list: ${error.message}`);
    }
  }

  // Get card details
  async getCardDetails(cardId) {
    try {
      const response = await this.api.get(`/cards/${cardId}`, {
        params: {
          fields: 'id,name,desc,url,shortUrl,due,dateLastActivity,idList,idBoard,idMembers,labels',
          members: true,
          member_fields: 'id,username,fullName,email',
          board: true,
          board_fields: 'id,name',
          list: true,
          list_fields: 'id,name'
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get card details: ${error.message}`);
    }
  }

  // Get member details
  async getMember(memberId) {
    try {
      const response = await this.api.get(`/members/${memberId}`, {
        params: {
          fields: 'id,username,fullName,email,avatarUrl'
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get member details: ${error.message}`);
    }
  }

  // Get card comments/actions
  async getCardComments(cardId, limit = 50) {
    try {
      const response = await this.api.get(`/cards/${cardId}/actions`, {
        params: {
          filter: 'commentCard',
          limit: limit,
          fields: 'id,type,date,data,idMemberCreator',
          member: true,
          member_fields: 'id,username,fullName'
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get card comments: ${error.message}`);
    }
  }

  // Get last comment on a card
  async getLastComment(cardId) {
    try {
      const comments = await this.getCardComments(cardId, 1);
      return comments.length > 0 ? comments[0] : null;
    } catch (error) {
      throw new Error(`Failed to get last comment: ${error.message}`);
    }
  }

  // Post a comment on a card
  async postComment(cardId, text, memberIds = []) {
    try {
      // Create mentions for members
      let commentText = text;
      if (memberIds.length > 0) {
        const mentions = memberIds.map(id => `@member:${id}`).join(' ');
        commentText = `${mentions} ${text}`;
      }

      const response = await this.api.post(`/cards/${cardId}/actions/comments`, {
        text: commentText
      });

      // Log the comment
      await Log.logActivity({
        cardId: cardId,
        action: 'post_trello_comment',
        message: `Posted comment on Trello card: ${text}`,
        metadata: {
          commentId: response.data.id,
          mentionedMembers: memberIds
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to post comment: ${error.message}`);
    }
  }

  // Check if card has recent activity (comments, updates, etc.)
  async hasRecentActivity(cardId, hoursThreshold = 24) {
    try {
      const response = await this.api.get(`/cards/${cardId}/actions`, {
        params: {
          filter: 'commentCard,updateCard',
          limit: 10,
          since: new Date(Date.now() - hoursThreshold * 60 * 60 * 1000).toISOString()
        }
      });

      return response.data.length > 0;
    } catch (error) {
      throw new Error(`Failed to check recent activity: ${error.message}`);
    }
  }

  // Get card activity since a specific date
  async getCardActivitySince(cardId, sinceDate) {
    try {
      const response = await this.api.get(`/cards/${cardId}/actions`, {
        params: {
          filter: 'commentCard,updateCard,addMemberToCard,removeMemberFromCard',
          since: sinceDate.toISOString(),
          member: true,
          member_fields: 'id,username,fullName'
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get card activity: ${error.message}`);
    }
  }

  // Sync card data to database
  async syncCardToDatabase(trelloCard) {
    try {
      // Transform Trello card data to our Card model format
      const cardData = {
        trelloId: trelloCard.id,
        name: trelloCard.name,
        url: trelloCard.url,
        shortUrl: trelloCard.shortUrl,
        description: trelloCard.desc,
        boardId: trelloCard.idBoard,
        boardName: trelloCard.board?.name,
        listId: trelloCard.idList,
        listName: trelloCard.list?.name,
        dueDate: trelloCard.due ? new Date(trelloCard.due) : null,
        dateLastActivity: trelloCard.dateLastActivity ? new Date(trelloCard.dateLastActivity) : null,
        assignedUsers: [],
        labels: trelloCard.labels || [],
        lastSyncDate: new Date()
      };

      // Process assigned members (exclude the excluded member)
      if (trelloCard.members && trelloCard.members.length > 0) {
        cardData.assignedUsers = trelloCard.members
          .filter(member => member.id !== this.excludedMemberId)
          .map(member => ({
            trelloId: member.id,
            username: member.username,
            email: member.email,
            fullName: member.fullName
          }));
      }

      // Find existing card or create new one
      let card = await Card.findOne({ trelloId: trelloCard.id });
      
      if (card) {
        // Update existing card
        Object.assign(card, cardData);
        
        // Check if there's new activity since last reminder
        if (card.reminderStatus.lastReminderDate) {
          const hasNewActivity = await this.hasRecentActivity(
            trelloCard.id, 
            Math.ceil((Date.now() - card.reminderStatus.lastReminderDate) / (1000 * 60 * 60))
          );
          
          if (hasNewActivity) {
            card.resetReminderStatus();
          }
        }
      } else {
        // Create new card
        card = new Card(cardData);
      }

      await card.save();
      return card;
    } catch (error) {
      throw new Error(`Failed to sync card to database: ${error.message}`);
    }
  }

  // Sync all cards from specified boards
  async syncAllCards(boardIds = []) {
    try {
      const syncResults = {
        totalCards: 0,
        newCards: 0,
        updatedCards: 0,
        errors: []
      };

      // If no board IDs specified, get all boards
      if (boardIds.length === 0) {
        const boards = await this.getBoards();
        boardIds = boards.map(board => board.id);
      }

      for (const boardId of boardIds) {
        try {
          console.log(`Syncing cards from board: ${boardId}`);
          const cards = await this.getCardsFromBoard(boardId);
          
          for (const trelloCard of cards) {
            try {
              const existingCard = await Card.findOne({ trelloId: trelloCard.id });
              const syncedCard = await this.syncCardToDatabase(trelloCard);
              
              syncResults.totalCards++;
              if (existingCard) {
                syncResults.updatedCards++;
              } else {
                syncResults.newCards++;
              }
            } catch (cardError) {
              console.error(`Error syncing card ${trelloCard.id}:`, cardError);
              syncResults.errors.push({
                cardId: trelloCard.id,
                error: cardError.message
              });
            }
          }
        } catch (boardError) {
          console.error(`Error syncing board ${boardId}:`, boardError);
          syncResults.errors.push({
            boardId: boardId,
            error: boardError.message
          });
        }
      }

      // Log sync results
      await Log.logSystem({
        action: 'trello_sync_completed',
        message: `Synced ${syncResults.totalCards} cards (${syncResults.newCards} new, ${syncResults.updatedCards} updated)`,
        metadata: syncResults
      });

      return syncResults;
    } catch (error) {
      throw new Error(`Failed to sync cards: ${error.message}`);
    }
  }

  // Get cards that need reminders
  async getCardsNeedingReminders(config) {
    try {
      // First sync recent data
      await this.syncAllCards();
      
      // Then get cards from database that need reminders
      const cards = await Card.findCardsNeedingReminders(config);
      
      // Verify each card still needs a reminder by checking recent activity
      const cardsNeedingReminders = [];
      
      for (const card of cards) {
        try {
          // Check if there's been recent activity since last check
          const hasActivity = await this.hasRecentActivity(card.trelloId, 2); // Check last 2 hours
          
          if (!hasActivity && card.needsReminder(config)) {
            cardsNeedingReminders.push(card);
          } else if (hasActivity) {
            // Reset reminder status if there's new activity
            await card.resetReminderStatus();
          }
        } catch (error) {
          console.error(`Error checking activity for card ${card.trelloId}:`, error);
          // Include card anyway if we can't check activity
          if (card.needsReminder(config)) {
            cardsNeedingReminders.push(card);
          }
        }
      }

      return cardsNeedingReminders;
    } catch (error) {
      throw new Error(`Failed to get cards needing reminders: ${error.message}`);
    }
  }

  // Create reminder comment template
  createReminderComment(card, template = null) {
    const defaultTemplate = "Please provide an update on this card.";
    
    if (template) {
      return template.render({
        cardName: card.name,
        cardUrl: card.url,
        username: '{{username}}', // Will be replaced per user
        currentDate: new Date().toLocaleDateString(),
        daysSinceLastUpdate: card.daysSinceLastActivity || 0
      });
    }
    
    return defaultTemplate;
  }

  // Send reminder comment to card
  async sendReminderComment(card, template = null) {
    try {
      const commentText = this.createReminderComment(card, template);
      const memberIds = card.assignedUsers.map(user => user.trelloId);
      
      const comment = await this.postComment(card.trelloId, commentText, memberIds);
      
      // Record reminder sent
      await card.recordReminderSent('trello', template?.id);
      
      // Log the reminder
      await Log.logNotification({
        cardId: card.trelloId,
        cardName: card.name,
        cardUrl: card.url,
        channel: 'trello',
        status: 'success',
        message: `Trello reminder comment posted`,
        templateId: template?.id,
        templateName: template?.name,
        recipient: memberIds.join(', '),
        deliveryId: comment.id
      });

      return comment;
    } catch (error) {
      // Log failed reminder
      await Log.logNotification({
        cardId: card.trelloId,
        cardName: card.name,
        cardUrl: card.url,
        channel: 'trello',
        status: 'failure',
        message: `Failed to post Trello reminder: ${error.message}`,
        templateId: template?.id,
        templateName: template?.name
      });

      throw error;
    }
  }
}

module.exports = new TrelloService();

