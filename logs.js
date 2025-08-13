const log = require('electron-log');
const { v4: uuidv4 } = require('uuid');
const { getLocalDatabase } = require('./database');
const moment = require('moment');

/**
 * Get logs with pagination and filtering
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Number of logs per page
 * @param {Object} filters - Filter criteria
 * @returns {Object} Logs with pagination info
 */
const getLogs = (page = 1, limit = 20, filters = {}) => {
  try {
    const db = getLocalDatabase();
    
    // Build query
    let query = 'SELECT * FROM logs';
    const queryParams = [];
    
    // Apply filters
    const whereConditions = [];
    
    if (filters.type) {
      whereConditions.push('type = ?');
      queryParams.push(filters.type);
    }
    
    if (filters.channel) {
      whereConditions.push('channel = ?');
      queryParams.push(filters.channel);
    }
    
    if (filters.status) {
      whereConditions.push('status = ?');
      queryParams.push(filters.status);
    }
    
    if (filters.startDate) {
      const startTimestamp = moment(filters.startDate).startOf('day').valueOf();
      whereConditions.push('timestamp >= ?');
      queryParams.push(startTimestamp);
    }
    
    if (filters.endDate) {
      const endTimestamp = moment(filters.endDate).endOf('day').valueOf();
      whereConditions.push('timestamp <= ?');
      queryParams.push(endTimestamp);
    }
    
    if (filters.cardId) {
      whereConditions.push('card_id = ?');
      queryParams.push(filters.cardId);
    }
    
    if (filters.userId) {
      whereConditions.push('user_id = ?');
      queryParams.push(filters.userId);
    }
    
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    // Count total logs
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countStmt = db.prepare(countQuery);
    const { count } = countStmt.get(...queryParams);
    
    // Add order and pagination
    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    queryParams.push(limit);
    queryParams.push((page - 1) * limit);
    
    // Execute query
    const stmt = db.prepare(query);
    const logs = stmt.all(...queryParams);
    
    // Calculate pagination info
    const totalPages = Math.ceil(count / limit);
    
    return {
      logs,
      pagination: {
        total: count,
        page,
        limit,
        pages: totalPages
      }
    };
  } catch (error) {
    log.error('Error getting logs:', error);
    throw error;
  }
};

/**
 * Get log statistics
 * @param {Object} filters - Filter criteria
 * @returns {Object} Log statistics
 */
const getLogStats = (filters = {}) => {
  try {
    const db = getLocalDatabase();
    
    // Determine date range
    let startDate = filters.startDate ? moment(filters.startDate).startOf('day').valueOf() : moment().subtract(7, 'days').startOf('day').valueOf();
    let endDate = filters.endDate ? moment(filters.endDate).endOf('day').valueOf() : moment().endOf('day').valueOf();
    
    // Get stats by type
    const byType = db.prepare(`
      SELECT type as _id, COUNT(*) as count 
      FROM logs 
      WHERE timestamp >= ? AND timestamp <= ?
      GROUP BY type
      ORDER BY count DESC
    `).all(startDate, endDate);
    
    // Get stats by channel
    const byChannel = db.prepare(`
      SELECT channel as _id, COUNT(*) as count 
      FROM logs 
      WHERE timestamp >= ? AND timestamp <= ? AND channel IS NOT NULL
      GROUP BY channel
      ORDER BY count DESC
    `).all(startDate, endDate);
    
    // Get stats by status
    const byStatus = db.prepare(`
      SELECT status as _id, COUNT(*) as count 
      FROM logs 
      WHERE timestamp >= ? AND timestamp <= ?
      GROUP BY status
      ORDER BY count DESC
    `).all(startDate, endDate);
    
    // Get stats by day
    const byDay = [];
    let currentDate = moment(startDate);
    const endMoment = moment(endDate);
    
    while (currentDate.isSameOrBefore(endMoment, 'day')) {
      const dayStart = currentDate.startOf('day').valueOf();
      const dayEnd = currentDate.endOf('day').valueOf();
      
      const { count } = db.prepare(`
        SELECT COUNT(*) as count 
        FROM logs 
        WHERE timestamp >= ? AND timestamp <= ?
      `).get(dayStart, dayEnd);
      
      byDay.push({
        date: currentDate.format('YYYY-MM-DD'),
        count
      });
      
      currentDate.add(1, 'day');
    }
    
    return {
      dateRange: {
        startDate: moment(startDate).format('YYYY-MM-DD'),
        endDate: moment(endDate).format('YYYY-MM-DD')
      },
      byType,
      byChannel,
      byStatus,
      byDay
    };
  } catch (error) {
    log.error('Error getting log statistics:', error);
    throw error;
  }
};

/**
 * Add log entry
 * @param {Object} logData - Log data
 * @returns {string} Log ID
 */
const addLog = (logData) => {
  try {
    const db = getLocalDatabase();
    
    const now = Date.now();
    const id = uuidv4();
    
    const logEntry = {
      id,
      timestamp: now,
      type: logData.type,
      channel: logData.channel || null,
      message: logData.message,
      status: logData.status,
      user_id: logData.userId || null,
      card_id: logData.cardId || null,
      created_at: now
    };
    
    db.prepare(`
      INSERT INTO logs (
        id, timestamp, type, channel, message, status, user_id, card_id, created_at
      )
      VALUES (
        @id, @timestamp, @type, @channel, @message, @status, @user_id, @card_id, @created_at
      )
    `).run(logEntry);
    
    return id;
  } catch (error) {
    log.error('Error adding log entry:', error);
    throw error;
  }
};

/**
 * Clear old logs
 * @param {number} daysToKeep - Number of days to keep logs
 * @returns {number} Number of logs deleted
 */
const clearOldLogs = (daysToKeep = 30) => {
  try {
    const db = getLocalDatabase();
    
    const cutoffDate = moment().subtract(daysToKeep, 'days').valueOf();
    
    const result = db.prepare(`
      DELETE FROM logs
      WHERE timestamp < ?
    `).run(cutoffDate);
    
    log.info(`Cleared ${result.changes} logs older than ${daysToKeep} days`);
    
    return result.changes;
  } catch (error) {
    log.error('Error clearing old logs:', error);
    throw error;
  }
};

module.exports = {
  getLogs,
  getLogStats,
  addLog,
  clearOldLogs
};
