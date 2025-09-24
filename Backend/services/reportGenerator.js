/**
 * Report Generator Service
 * Generates daily progress reports from VA comments and activities
 */

const ProgressReport = require('../models/ProgressReport');
const ReportConfiguration = require('../models/ReportConfiguration');
const Handlebars = require('handlebars');
const logger = require('../utils/logger');
const notificationService = require('./notifications');

class ReportGeneratorService {
  constructor() {
    this.scheduledJobs = {};
    this.isInitialized = false;
  }

  /**
   * Initialize the report generator service
   */
  async initialize() {
    if (this.isInitialized) {
      logger.info('Report generator service is already initialized');
      return;
    }

    logger.info('Initializing report generator service');
    
    try {
      // Register Handlebars helpers
      this.registerHandlebarsHelpers();
      
      // Schedule all active report configurations
      await this.scheduleAllReports();
      
      this.isInitialized = true;
      logger.info('Report generator service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize report generator service:', error);
      throw error;
    }
  }

  /**
   * Register custom Handlebars helpers for report templates
   */
  registerHandlebarsHelpers() {
    Handlebars.registerHelper('formatDate', function(date) {
      return new Date(date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    });
    
    Handlebars.registerHelper('ifCond', function(v1, operator, v2, options) {
      switch (operator) {
        case '==':
          return (v1 == v2) ? options.fn(this) : options.inverse(this);
        case '===':
          return (v1 === v2) ? options.fn(this) : options.inverse(this);
        case '!=':
          return (v1 != v2) ? options.fn(this) : options.inverse(this);
        case '!==':
          return (v1 !== v2) ? options.fn(this) : options.inverse(this);
        case '<':
          return (v1 < v2) ? options.fn(this) : options.inverse(this);
        case '<=':
          return (v1 <= v2) ? options.fn(this) : options.inverse(this);
        case '>':
          return (v1 > v2) ? options.fn(this) : options.inverse(this);
        case '>=':
          return (v1 >= v2) ? options.fn(this) : options.inverse(this);
        case '&&':
          return (v1 && v2) ? options.fn(this) : options.inverse(this);
        case '||':
          return (v1 || v2) ? options.fn(this) : options.inverse(this);
        default:
          return options.inverse(this);
      }
    });
  }

  /**
   * Schedule all active report configurations
   */
  async scheduleAllReports() {
    try {
      // Clear any existing scheduled jobs
      Object.keys(this.scheduledJobs).forEach(jobId => {
        clearTimeout(this.scheduledJobs[jobId]);
        delete this.scheduledJobs[jobId];
      });
      
      // Get all active configurations
      const configurations = await ReportConfiguration.findActive();
      
      if (configurations.length === 0) {
        logger.info('No active report configurations found to schedule');
        return;
      }
      
      // Schedule each configuration
      configurations.forEach(config => {
        this.scheduleReport(config);
      });
      
      logger.info(`Scheduled ${configurations.length} report configurations`);
    } catch (error) {
      logger.error('Error scheduling reports:', error);
      throw error;
    }
  }

  /**
   * Schedule a single report configuration
   * @param {Object} config - Report configuration
   */
  scheduleReport(config) {
    try {
      if (!config.enabled) {
        logger.info(`Skipping disabled report configuration: ${config.name}`);
        return;
      }
      
      // Parse schedule time
      const [hours, minutes] = config.scheduleTime.split(':').map(Number);
      
      // Calculate next run time
      const now = new Date();
      const nextRun = new Date();
      nextRun.setHours(hours, minutes, 0, 0);
      
      // If the time has already passed today, schedule for tomorrow
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      
      // Check if it's a weekend and weekend delivery is disabled
      if (!config.weekendDelivery) {
        const day = nextRun.getDay();
        if (day === 0 || day === 6) { // 0 = Sunday, 6 = Saturday
          // Skip to Monday if it's a weekend
          const daysToAdd = day === 0 ? 1 : 2;
          nextRun.setDate(nextRun.getDate() + daysToAdd);
          nextRun.setHours(hours, minutes, 0, 0);
        }
      }
      
      // Calculate delay in milliseconds
      const delay = nextRun.getTime() - now.getTime();
      
      // Schedule the job
      this.scheduledJobs[config._id] = setTimeout(() => {
        this.generateAndSendReports(config)
          .then(() => {
            // Reschedule for the next day
            this.scheduleReport(config);
          })
          .catch(error => {
            logger.error(`Error generating reports for ${config.name}:`, error);
            // Reschedule despite error
            this.scheduleReport(config);
          });
      }, delay);
      
      logger.info(`Scheduled report "${config.name}" to run at ${nextRun.toLocaleString()}`);
    } catch (error) {
      logger.error(`Error scheduling report "${config.name}":`, error);
    }
  }

  /**
   * Generate and send reports for a configuration
   * @param {Object} config - Report configuration
   */
  async generateAndSendReports(config) {
    try {
      logger.info(`Generating reports for configuration: ${config.name}`);
      
      // Get today's date (for report generation)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Find all draft reports for today that match this configuration
      const reports = await this.findReportsForConfiguration(config, today, tomorrow);
      
      if (reports.length === 0) {
        logger.info(`No reports found for configuration: ${config.name}`);
        return;
      }
      
      // Group reports by VA
      const reportsByVA = this.groupReportsByVA(reports);
      
      // Generate and send a report for each VA
      for (const [vaId, vaReports] of Object.entries(reportsByVA)) {
        await this.generateAndSendVAReport(vaId, vaReports, config);
      }
      
      logger.info(`Completed generating reports for configuration: ${config.name}`);
    } catch (error) {
      logger.error(`Error generating reports for ${config.name}:`, error);
      throw error;
    }
  }

  /**
   * Find reports that match a configuration
   * @param {Object} config - Report configuration
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Array} Matching reports
   */
  async findReportsForConfiguration(config, startDate, endDate) {
    const query = {
      date: {
        $gte: startDate,
        $lt: endDate
      },
      reportStatus: 'Draft'
    };
    
    // Filter by board IDs if specified
    if (config.boardIds && config.boardIds.length > 0) {
      query.boardId = { $in: config.boardIds };
    }
    
    // Filter by VA IDs if specified
    if (config.virtualAssistantIds && config.virtualAssistantIds.length > 0) {
      query.virtualAssistantId = { $in: config.virtualAssistantIds };
    }
    
    return await ProgressReport.find(query);
  }

  /**
   * Group reports by virtual assistant
   * @param {Array} reports - List of reports
   * @returns {Object} Reports grouped by VA ID
   */
  groupReportsByVA(reports) {
    const grouped = {};
    
    reports.forEach(report => {
      if (!grouped[report.virtualAssistantId]) {
        grouped[report.virtualAssistantId] = [];
      }
      
      grouped[report.virtualAssistantId].push(report);
    });
    
    return grouped;
  }

  /**
   * Generate and send a report for a single VA
   * @param {String} vaId - Virtual assistant ID
   * @param {Array} reports - List of reports for this VA
   * @param {Object} config - Report configuration
   */
  async generateAndSendVAReport(vaId, reports, config) {
    try {
      if (!reports || reports.length === 0) {
        return;
      }
      
      // Get VA name from the first report
      const vaName = reports[0].virtualAssistantName;
      
      // Prepare data for template
      const templateData = {
        date: new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        vaName: vaName,
        vaId: vaId,
        tasks: reports.map(report => ({
          cardId: report.cardId,
          cardName: report.cardName,
          boardName: report.boardName,
          taskStatus: report.taskStatus,
          completedItems: report.completedItems,
          blockers: report.blockers,
          additionalNotes: report.additionalNotes
        })),
        blockers: this.collectAllBlockers(reports),
        hasBlockers: this.hasBlockers(reports),
        additionalNotes: this.collectAllNotes(reports)
      };
      
      // Compile the template
      const template = Handlebars.compile(config.reportTemplate);
      const htmlContent = template(templateData);
      
      // Generate a plain text version
      const plainTextContent = this.htmlToPlainText(htmlContent);
      
      // Send the report
      const subject = `Daily Progress Report - ${vaName} - ${templateData.date}`;
      
      await notificationService.sendEmail({
        to: config.recipients,
        subject: subject,
        html: htmlContent,
        text: plainTextContent
      });
      
      // Mark reports as generated and delivered
      for (const report of reports) {
        report.reportStatus = 'Generated';
        report.generatedAt = new Date();
        report.deliveredAt = new Date();
        report.reportStatus = 'Delivered';
        await report.save();
      }
      
      logger.info(`Sent daily report for VA: ${vaName}`);
    } catch (error) {
      logger.error(`Error generating report for VA ${vaId}:`, error);
      
      // Mark reports as failed
      for (const report of reports) {
        report.reportStatus = 'Failed';
        await report.save();
      }
      
      throw error;
    }
  }

  /**
   * Collect all blockers from a list of reports
   * @param {Array} reports - List of reports
   * @returns {Array} All blockers
   */
  collectAllBlockers(reports) {
    const blockers = [];
    
    reports.forEach(report => {
      if (report.blockers && report.blockers.length > 0) {
        report.blockers.forEach(blocker => {
          if (blocker && !blockers.includes(blocker)) {
            blockers.push(blocker);
          }
        });
      }
    });
    
    return blockers;
  }

  /**
   * Check if any reports have blockers
   * @param {Array} reports - List of reports
   * @returns {Boolean} True if any report has blockers
   */
  hasBlockers(reports) {
    return reports.some(report => report.blockers && report.blockers.length > 0);
  }

  /**
   * Collect all additional notes from a list of reports
   * @param {Array} reports - List of reports
   * @returns {String} Combined notes
   */
  collectAllNotes(reports) {
    const notes = [];
    
    reports.forEach(report => {
      if (report.additionalNotes && report.additionalNotes.trim()) {
        notes.push(`${report.cardName}: ${report.additionalNotes}`);
      }
    });
    
    return notes.join('\n\n');
  }

  /**
   * Convert HTML to plain text
   * @param {String} html - HTML content
   * @returns {String} Plain text
   */
  htmlToPlainText(html) {
    // Simple HTML to plain text conversion
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<li>/gi, '- ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();
  }

  /**
   * Generate a report on demand
   * @param {String} configId - Configuration ID
   * @param {Date} date - Report date
   * @returns {Promise} Promise that resolves when the report is generated
   */
  async generateReportOnDemand(configId, date = new Date()) {
    try {
      // Get the configuration
      const config = await ReportConfiguration.findById(configId);
      
      if (!config) {
        throw new Error(`Report configuration not found: ${configId}`);
      }
      
      // Set date to start of day
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      
      // Find reports for this configuration
      const reports = await this.findReportsForConfiguration(config, startDate, endDate);
      
      if (reports.length === 0) {
        logger.info(`No reports found for on-demand generation: ${config.name}`);
        return {
          success: false,
          message: 'No reports found for the specified date'
        };
      }
      
      // Group reports by VA
      const reportsByVA = this.groupReportsByVA(reports);
      
      // Generate and send a report for each VA
      for (const [vaId, vaReports] of Object.entries(reportsByVA)) {
        await this.generateAndSendVAReport(vaId, vaReports, config);
      }
      
      return {
        success: true,
        message: `Generated and sent ${Object.keys(reportsByVA).length} reports`
      };
    } catch (error) {
      logger.error(`Error generating on-demand report:`, error);
      return {
        success: false,
        message: `Error: ${error.message}`
      };
    }
  }
}

module.exports = new ReportGeneratorService();
