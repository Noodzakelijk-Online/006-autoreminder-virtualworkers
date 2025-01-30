require("dotenv").config();

module.exports = {
  TRELLO_API_KEY: process.env.TRELLO_API_KEY,
  TRELLO_TOKEN: process.env.TRELLO_TOKEN,
  TRELLO_BASE_URL: process.env.TRELLO_BASE_URL,
  FRESHDESK_API_KEY: process.env.FRESHDESK_API_KEY,
  FRESHDESK_BASE_URL: process.env.FRESHDESK_BASE_URL,
  TWILIO_SID: process.env.TWILIO_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
  PHONE_NUMBER: process.env.PHONE_NUMBER,
  timezone: process.env.TIMEZONE,
  cronTimes: {
    commentTime: process.env.COMMENT_TIME,
    emailTime: process.env.EMAIL_TIME,
    smsTime: process.env.SMS_TIME,
  },
  PORT: process.env.PORT
};
