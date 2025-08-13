const { validationResult } = require('express-validator');
const Report = require('../models/Report');
const logger = require('../utils/logger');
const schedulerService = require('../services/scheduler');

/**
 * Report Controller - Handles reporting and analytics
 */
class ReportController {
  /**
   * Get all reports with pagination
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getReports(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      const reportType = req.query.type;
      
      // Build query
      const query = {};
      if (reportType) {
        query.reportType = reportType;
      }
      
      // Get reports with pagination
      const reports = await Report.find(query)
        .sort({ generatedAt: -1 })
        .skip(skip)
        .limit(limit);
        
      // Get total count for pagination
      const total = await Report.countDocuments(query);
      
      res.json({
        reports,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.log('error', `Get reports error: ${error.message}`);
      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * Get report by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getReportById(req, res) {
    try {
      const report = await Report.findById(req.params.id);
      if (!report) {
        return res.status(404).json({ message: 'Report not found' });
      }
      res.json(report);
    } catch (error) {
      logger.log('error', `Get report error: ${error.message}`);
      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * Generate a new report
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async generateReport(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { reportType, startDate, endDate } = req.body;
      
      // Validate dates
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: 'Invalid date format' });
      }
      
      if (start > end) {
        return res.status(400).json({ message: 'Start date must be before end date' });
      }
      
      // Generate report
      const report = await schedulerService.generateReport(reportType, start, end);
      
      logger.log('info', `Report generated: ${reportType}`);
      res.status(201).json(report);
    } catch (error) {
      logger.log('error', `Generate report error: ${error.message}`);
      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * Download report as CSV
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async downloadReport(req, res) {
    try {
      const report = await Report.findById(req.params.id);
      if (!report) {
        return res.status(404).json({ message: 'Report not found' });
      }
      
      // Generate CSV content
      let csv = 'Report Type,Start Date,End Date,Generated At\n';
      csv += `${report.reportType},${report.startDate.toISOString()},${report.endDate.toISOString()},${report.generatedAt.toISOString()}\n\n`;
      
      // Add metrics
      csv += 'Metrics\n';
      csv += 'Total Cards,Response Rate,Avg Response Time (ms)\n';
      csv += `${report.metrics.totalCards},${report.metrics.responseRate},${report.metrics.avgResponseTime}\n\n`;
      
      // Add notification counts
      csv += 'Notifications Sent\n';
      csv += 'Trello,Email,SMS,WhatsApp\n';
      csv += `${report.metrics.notificationsSent.trello},${report.metrics.notificationsSent.email},${report.metrics.notificationsSent.sms},${report.metrics.notificationsSent.whatsapp}\n\n`;
      
      // Add user metrics
      csv += 'User Metrics\n';
      csv += 'User ID,Username,Notifications Received,Response Rate\n';
      report.userMetrics.forEach(user => {
        csv += `${user.userId},${user.username},${user.notificationsReceived},${user.responseRate}\n`;
      });
      
      // Set headers for file download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=report-${report._id}.csv`);
      
      res.send(csv);
    } catch (error) {
      logger.log('error', `Download report error: ${error.message}`);
      res.status(500).json({ message: 'Server error' });
    }
  }
}

module.exports = new ReportController();
