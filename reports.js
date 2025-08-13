const log = require('electron-log');
const { v4: uuidv4 } = require('uuid');
const { getLocalDatabase } = require('./database');
const moment = require('moment');

/**
 * Get all reports
 * @returns {Array} List of reports
 */
const getReports = () => {
  try {
    const db = getLocalDatabase();
    
    const reports = db.prepare('SELECT * FROM reports ORDER BY generated_at DESC').all();
    
    return reports;
  } catch (error) {
    log.error('Error getting reports:', error);
    throw error;
  }
};

/**
 * Get report by ID
 * @param {string} id - Report ID
 * @returns {Object} Report data
 */
const getReport = (id) => {
  try {
    const db = getLocalDatabase();
    
    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
    
    if (!report) {
      throw new Error(`Report not found: ${id}`);
    }
    
    // Parse metrics
    if (report.metrics) {
      report.metrics = JSON.parse(report.metrics);
    }
    
    return report;
  } catch (error) {
    log.error(`Error getting report ${id}:`, error);
    throw error;
  }
};

/**
 * Generate report
 * @param {string} reportType - Report type (daily, weekly)
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Object} Generated report
 */
const generateReport = (reportType, startDate, endDate) => {
  try {
    const db = getLocalDatabase();
    
    // Parse dates
    const startTimestamp = moment(startDate).startOf('day').valueOf();
    const endTimestamp = moment(endDate).endOf('day').valueOf();
    
    // Generate report ID
    const id = uuidv4();
    const now = Date.now();
    
    // Calculate metrics
    const metrics = calculateReportMetrics(startTimestamp, endTimestamp);
    
    // Create report
    const report = {
      id,
      report_type: reportType,
      start_date: startTimestamp,
      end_date: endTimestamp,
      metrics: JSON.stringify(metrics),
      generated_at: now,
      created_at: now
    };
    
    // Save report
    db.prepare(`
      INSERT INTO reports (id, report_type, start_date, end_date, metrics, generated_at, created_at)
      VALUES (@id, @report_type, @start_date, @end_date, @metrics, @generated_at, @created_at)
    `).run(report);
    
    // Log report generation
    logAction({
      type: 'report',
      message: `Generated ${reportType} report for ${startDate} to ${endDate}`,
      status: 'success'
    });
    
    return getReport(id);
  } catch (error) {
    log.error('Error generating report:', error);
    
    // Log report generation failure
    logAction({
      type: 'report',
      message: `Failed to generate report: ${error.message}`,
      status: 'error'
    });
    
    throw error;
  }
};

/**
 * Calculate report metrics
 * @param {number} startTimestamp - Start timestamp
 * @param {number} endTimestamp - End timestamp
 * @returns {Object} Report metrics
 */
const calculateReportMetrics = (startTimestamp, endTimestamp) => {
  try {
    const db = getLocalDatabase();
    
    // Get total cards
    const totalCards = db.prepare(`
      SELECT COUNT(*) as count FROM cards
      WHERE created_at <= ? AND (updated_at >= ? OR updated_at >= ?)
    `).get(endTimestamp, startTimestamp, startTimestamp).count;
    
    // Get notifications sent
    const notifications = db.prepare(`
      SELECT channel, COUNT(*) as count FROM notifications
      WHERE sent_at >= ? AND sent_at <= ? AND status = 'success'
      GROUP BY channel
    `).all(startTimestamp, endTimestamp);
    
    // Format notification counts
    const notificationsSent = {};
    notifications.forEach(item => {
      notificationsSent[item.channel] = item.count;
    });
    
    // Calculate response rate (implementation depends on how responses are tracked)
    const responseRate = 0.6; // Placeholder
    
    // Calculate average response time (implementation depends on how responses are tracked)
    const avgResponseTime = 86400000; // Placeholder: 24 hours in milliseconds
    
    // Get user metrics
    const userMetrics = db.prepare(`
      SELECT 
        u.name as username,
        COUNT(n.id) as notifications_received,
        0.7 as response_rate
      FROM users u
      LEFT JOIN notifications n ON n.recipient LIKE '%' || u.email || '%'
      WHERE n.sent_at >= ? AND n.sent_at <= ?
      GROUP BY u.id
    `).all(startTimestamp, endTimestamp);
    
    return {
      totalCards,
      responseRate,
      avgResponseTime,
      notificationsSent,
      userMetrics
    };
  } catch (error) {
    log.error('Error calculating report metrics:', error);
    throw error;
  }
};

/**
 * Export report to CSV
 * @param {string} id - Report ID
 * @returns {string} CSV content
 */
const exportReportToCsv = (id) => {
  try {
    const report = getReport(id);
    
    if (!report) {
      throw new Error(`Report not found: ${id}`);
    }
    
    // Format dates
    const startDate = moment(report.start_date).format('YYYY-MM-DD');
    const endDate = moment(report.end_date).format('YYYY-MM-DD');
    const generatedDate = moment(report.generated_at).format('YYYY-MM-DD HH:mm:ss');
    
    // Build CSV content
    let csv = `AutoReminder ${report.report_type} Report\n`;
    csv += `Period: ${startDate} to ${endDate}\n`;
    csv += `Generated: ${generatedDate}\n\n`;
    
    // Add metrics
    const metrics = report.metrics;
    
    csv += `Total Cards,${metrics.totalCards}\n`;
    csv += `Response Rate,${(metrics.responseRate * 100).toFixed(2)}%\n`;
    csv += `Average Response Time,${moment.duration(metrics.avgResponseTime).humanize()}\n\n`;
    
    // Add notifications by channel
    csv += 'Notifications Sent By Channel\n';
    csv += 'Channel,Count\n';
    
    Object.entries(metrics.notificationsSent).forEach(([channel, count]) => {
      csv += `${channel},${count}\n`;
    });
    
    csv += '\n';
    
    // Add user metrics
    if (metrics.userMetrics && metrics.userMetrics.length > 0) {
      csv += 'User Metrics\n';
      csv += 'Username,Notifications Received,Response Rate\n';
      
      metrics.userMetrics.forEach(user => {
        csv += `${user.username},${user.notifications_received},${(user.response_rate * 100).toFixed(2)}%\n`;
      });
    }
    
    return csv;
  } catch (error) {
    log.error(`Error exporting report ${id} to CSV:`, error);
    throw error;
  }
};

/**
 * Log action
 * @param {Object} logData - Log data
 */
const logAction = (logData) => {
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
      user_id: logData.user_id || null,
      card_id: logData.card_id || null,
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
    
  } catch (error) {
    log.error('Error logging action:', error);
  }
};

module.exports = {
  getReports,
  getReport,
  generateReport,
  exportReportToCsv,
  logAction
};
