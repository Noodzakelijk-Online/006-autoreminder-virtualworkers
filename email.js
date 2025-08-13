const nodemailer = require('nodemailer');
const log = require('electron-log');
const Store = require('electron-store');

// Initialize store for email configuration
const store = new Store();

/**
 * Get email configuration from store
 * @returns {Object} Email configuration
 */
const getEmailConfig = () => {
  return {
    host: store.get('email.host'),
    port: store.get('email.port'),
    secure: store.get('email.secure') || false,
    auth: {
      user: store.get('email.user'),
      pass: store.get('email.password')
    },
    from: store.get('email.from')
  };
};

/**
 * Create email transporter
 * @returns {Object} Nodemailer transporter
 */
const createTransporter = () => {
  const config = getEmailConfig();
  
  if (!config.host || !config.auth.user || !config.auth.pass) {
    throw new Error('Email configuration is incomplete');
  }
  
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.auth.user,
      pass: config.auth.pass
    }
  });
};

/**
 * Send email notification
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} text - Plain text content
 * @param {string} html - HTML content
 * @returns {Promise<Object>} Send result
 */
const sendEmail = async (to, subject, text, html) => {
  try {
    const config = getEmailConfig();
    const transporter = createTransporter();
    
    const mailOptions = {
      from: config.from || config.auth.user,
      to,
      subject,
      text,
      html
    };
    
    const result = await transporter.sendMail(mailOptions);
    log.info(`Email sent to ${to}: ${result.messageId}`);
    
    return result;
  } catch (error) {
    log.error('Error sending email:', error);
    throw error;
  }
};

/**
 * Test email configuration
 * @returns {Promise<boolean>} Test result
 */
const testEmailConfig = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    return true;
  } catch (error) {
    log.error('Email configuration test failed:', error);
    return false;
  }
};

/**
 * Save email configuration
 * @param {Object} config - Email configuration
 * @returns {Promise<boolean>} Save result
 */
const saveEmailConfig = async (config) => {
  try {
    store.set('email.host', config.host);
    store.set('email.port', config.port);
    store.set('email.secure', config.secure);
    store.set('email.user', config.auth.user);
    store.set('email.password', config.auth.pass);
    store.set('email.from', config.from);
    
    // Test configuration
    const testResult = await testEmailConfig();
    
    return testResult;
  } catch (error) {
    log.error('Error saving email configuration:', error);
    throw error;
  }
};

module.exports = {
  sendEmail,
  testEmailConfig,
  saveEmailConfig,
  getEmailConfig
};
