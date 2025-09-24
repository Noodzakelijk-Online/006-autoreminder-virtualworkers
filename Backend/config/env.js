require("dotenv").config();

// module.exports = {
//   TRELLO_API_KEY: process.env.TRELLO_API_KEY,
//   TRELLO_TOKEN: process.env.TRELLO_TOKEN,
//   TRELLO_BASE_URL: process.env.TRELLO_BASE_URL,
//   FRESHDESK_API_KEY: process.env.FRESHDESK_API_KEY,
//   FRESHDESK_BASE_URL: process.env.FRESHDESK_BASE_URL,
//   TWILIO_SID: process.env.TWILIO_SID,
//   TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
//   SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
//   PHONE_NUMBER: process.env.PHONE_NUMBER,
//   timezone: process.env.TIMEZONE,
//   cronTimes: {
//     commentTime: process.env.COMMENT_TIME,
//     emailTime: process.env.EMAIL_TIME,
//     smsTime: process.env.SMS_TIME,
//   },
//   PORT: process.env.PORT
// };

module.exports = {
  TRELLO_API_KEY: process.env.trello_api_key || process.env.TRELLO_API_KEY,
  TRELLO_TOKEN: process.env.trello_token || process.env.TRELLO_TOKEN,
  TRELLO_BASE_URL: process.env.trello_base_url || process.env.TRELLO_BASE_URL,
  FRESHDESK_API_KEY: process.env.freshdesk_api_key || process.env.FRESHDESK_API_KEY,
  FRESHDESK_BASE_URL: process.env.freshdesk_base_url || process.env.FRESHDESK_BASE_URL,
  TWILIO_SID: process.env.twilio_sid || process.env.TWILIO_SID,
  TWILIO_AUTH_TOKEN: process.env.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN,
  SENDGRID_API_KEY: process.env.sendgrid_api_key || process.env.SENDGRID_API_KEY,
  PHONE_NUMBER: process.env.phone_number || process.env.PHONE_NUMBER,
  TIMEZONE: process.env.timezone || process.env.TIMEZONE || 'UTC',
  CRON_TIMES: {
    COMMENT_TIME: process.env.reminder_time_day0 || process.env.REMINDER_TIME_DAY0,
    EMAIL_TIME: process.env.reminder_time_day1 || process.env.REMINDER_TIME_DAY1,
    SMS_TIME: process.env.reminder_time_day2 || process.env.REMINDER_TIME_DAY2,
    DAILY_REPORT_TIME: process.env.daily_report_time || process.env.DAILY_REPORT_TIME || '0 0 * * *',
    WEEKLY_REPORT_TIME: process.env.weekly_report_time || process.env.WEEKLY_REPORT_TIME || '0 0 * * 1',
  },
  // Legacy support for index.js
  timezone: process.env.timezone || process.env.TIMEZONE || 'UTC',
  cronTimes: {
    commentTime: process.env.reminder_time_day0 || process.env.REMINDER_TIME_DAY0,
    emailTime: process.env.reminder_time_day1 || process.env.REMINDER_TIME_DAY1,
    smsTime: process.env.reminder_time_day2 || process.env.REMINDER_TIME_DAY2,
  },
  PORT: process.env.port || process.env.PORT
};
