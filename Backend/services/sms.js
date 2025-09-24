const twilio = require('twilio');
const log = require('electron-log');
const Store = require('electron-store');

// Initialize store for SMS/WhatsApp configuration
const store = new Store();

/**
 * Get Twilio configuration from store
 * @returns {Object} Twilio configuration
 */
const getTwilioConfig = () => {
  return {
    accountSid: store.get('twilio.accountSid'),
    authToken: store.get('twilio.authToken'),
    phoneNumber: store.get('twilio.phoneNumber'),
    whatsappNumber: store.get('twilio.whatsappNumber')
  };
};

/**
 * Create Twilio client
 * @returns {Object} Twilio client
 */
const createTwilioClient = () => {
  const config = getTwilioConfig();
  
  if (!config.accountSid || !config.authToken) {
    throw new Error('Twilio configuration is incomplete');
  }
  
  return twilio(config.accountSid, config.authToken);
};

/**
 * Send SMS notification
 * @param {string} to - Recipient phone number
 * @param {string} message - SMS message
 * @returns {Promise<Object>} Send result
 */
const sendSMS = async (to, message) => {
  try {
    const config = getTwilioConfig();
    const client = createTwilioClient();
    
    if (!config.phoneNumber) {
      throw new Error('Twilio phone number not configured');
    }
    
    const result = await client.messages.create({
      body: message,
      from: config.phoneNumber,
      to
    });
    
    log.info(`SMS sent to ${to}: ${result.sid}`);
    
    return result;
  } catch (error) {
    log.error('Error sending SMS:', error);
    throw error;
  }
};

/**
 * Send WhatsApp notification
 * @param {string} to - Recipient phone number
 * @param {string} message - WhatsApp message
 * @returns {Promise<Object>} Send result
 */
const sendWhatsApp = async (to, message) => {
  try {
    const config = getTwilioConfig();
    const client = createTwilioClient();
    
    if (!config.whatsappNumber) {
      throw new Error('Twilio WhatsApp number not configured');
    }
    
    // Format WhatsApp number
    const from = `whatsapp:${config.whatsappNumber}`;
    const formattedTo = `whatsapp:${to}`;
    
    const result = await client.messages.create({
      body: message,
      from,
      to: formattedTo
    });
    
    log.info(`WhatsApp sent to ${to}: ${result.sid}`);
    
    return result;
  } catch (error) {
    log.error('Error sending WhatsApp:', error);
    throw error;
  }
};

/**
 * Test Twilio configuration
 * @returns {Promise<boolean>} Test result
 */
const testTwilioConfig = async () => {
  try {
    const client = createTwilioClient();
    
    // Fetch account info to verify credentials
    await client.api.accounts(client.accountSid).fetch();
    
    return true;
  } catch (error) {
    log.error('Twilio configuration test failed:', error);
    return false;
  }
};

/**
 * Save Twilio configuration
 * @param {Object} config - Twilio configuration
 * @returns {Promise<boolean>} Save result
 */
const saveTwilioConfig = async (config) => {
  try {
    store.set('twilio.accountSid', config.accountSid);
    store.set('twilio.authToken', config.authToken);
    store.set('twilio.phoneNumber', config.phoneNumber);
    store.set('twilio.whatsappNumber', config.whatsappNumber);
    
    // Test configuration
    const testResult = await testTwilioConfig();
    
    return testResult;
  } catch (error) {
    log.error('Error saving Twilio configuration:', error);
    throw error;
  }
};

module.exports = {
  sendSMS,
  sendWhatsApp,
  testTwilioConfig,
  saveTwilioConfig,
  getTwilioConfig
};
