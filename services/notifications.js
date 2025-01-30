const axios = require("axios");
const twilio = require('twilio');
const sgMail = require('@sendgrid/mail');
const { FRESHDESK_API_KEY, FRESHDESK_BASE_URL, TWILIO_SID, TWILIO_AUTH_TOKEN, SENDGRID_API_KEY, PHONE_NUMBER } = require("../config/env");

sgMail.setApiKey(SENDGRID_API_KEY);

// Create a ticket in Freshdesk
async function createEmailTicket(subject, description, email) {
  try {
    const response = await axios.post(
      `https://${FRESHDESK_BASE_URL}/tickets`,
      {
        subject,
        description,
        email,
        priority: 1,
        status: 4,

      },
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(FRESHDESK_API_KEY + ':X').toString('base64')}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('Ticket created:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error creating ticket:', error.message);
  }
}

async function createSmsTicket(subject, description, phone) {
  try {
    const response = await axios.post(
      `https://${FRESHDESK_BASE_URL}/tickets`,
      {
        subject,
        description,
        phone,
        priority: 1,
        status: 4,

      },
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(FRESHDESK_API_KEY + ':X').toString('base64')}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('Ticket created:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error creating ticket:', error.message);
  }
}

async function getPhoneNumber(email) {
  try {
    const response = await axios.get(
      `https://${FRESHDESK_BASE_URL}/api/v2/contacts`,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(FRESHDESK_API_KEY + ':X').toString('base64')}`,
          'Content-Type': 'application/json',
        },
        params: {
          email: email,
        },
      }
    );

    console.log('Filtered Contacts:', response.data);
    const results = response.data.results;
    const phoneNumber = (Array.isArray(results) && results.length) ? results[0].phone : null;
    return phoneNumber;
  } catch (error) {
    console.error('Error fetching contacts:', error.message);
  }
}

// Send WhatsApp message using Twilio
async function sendSmsMessage(to, message) {
  const client = twilio(TWILIO_SID, TWILIO_AUTH_TOKEN);

  try {
    const response = await client.messages.create({
      body: message,
      from: PHONE_NUMBER,
      to: to
    });
    console.log('WhatsApp message sent:', response.sid);
  } catch (error) {
    console.error('Error sending WhatsApp message:', error.message);
  }
}


// Send bulk email using SendGrid
async function sendBulkEmails(memberDatas, cardUrl, cardName) {
  const emailSubject = `Update trello card: ${cardName}`;
  const messages = memberDatas.map((member) => ({
    to: member.email,
    from: 'noodzakelijkonline@gmail.com', // Replace with your verified email
    subject: emailSubject,
    text: `Hi ${member.username},\n\nPlease provide an update to ${cardUrl} as soon as you see this message. Thank you.\n\n~ Noodzakelijk Online`,
    html: `<p>Hi <b>${member.username}</b>,</p>
         <p>Please provide an update to <a href="${cardUrl}">${cardUrl}</a> as soon as you see this message. Thank you.</p>
         <p>~ Noodzakelijk Online</p>`,
  }));

  try {
    const response = await sgMail.send(messages);
    console.log('Emails sent:', response);
  } catch (error) {
    console.error('Error sending emails:', error.message);
  }
}


module.exports = { createEmailTicket, createSmsTicket, getPhoneNumber, sendSmsMessage, sendBulkEmails };
