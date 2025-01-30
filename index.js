const express = require('express');
const app = express();
const { getCardDetails, getOrganizations, getBoards, getCardsFromBoard, getCardsFromList, getMember, getLastComment, postComment } = require("./services/trello");
const { createEmailTicket, createSmsTicket, sendSmsMessage, sendBulkEmails, getPhoneNumber } = require("./services/notifications");
const { log } = require("./utils/logger");
const cron = require("cron");
const { cronTimes, timezone, PORT } = require("./config/env");
const port = process.env.PORT || 8080;

const day0CommentJob = new cron.CronJob(
  cronTimes.commentTime,
  async () => {
    try {
      const boards = await getBoards();
      let cards = [];
      (Array.isArray(boards) && boards.length) && boards.forEach(async e => {
        let card = await getCardsFromList(e.id);
        cards.push(card);
      });
      cards.forEach(async (card) => {
        const cardId = card.id;
        let lastComment = await getLastComment(cardId);
        let cuurentDate = new Date();
        let lastCommentDate = new Date(lastComment.date)
        const normalizedCuurentDate = new Date(cuurentDate.getFullYear(), cuurentDate.getMonth(), cuurentDate.getDate());
        const normalizedLastCommentDate = new Date(lastCommentDate.getFullYear(), lastCommentDate.getMonth(), lastCommentDate.getDate());
        const timeDifference = normalizedCuurentDate - normalizedLastCommentDate;
        const dayDifference = timeDifference / (1000 * 60 * 60 * 24);
        let commentText = lastComment.data.text;
        let lastChars = commentText.slice(-25);

        if (lastComment === null || (lastChars !== "Please provide an update." && lastComment.idMemberCreator === "59b3208fbd9a6b2be8b0a436")) {
          const cardMembers = card.idMembers;
          let cardWorkerIds = [];

          (Array.isArray(cardMembers) && cardMembers.length) && cardMembers.forEach(e => {
            if (e !== "59b3208fbd9a6b2be8b0a436") {
              cardWorkerIds.push(e)
            }
          });

          let memberDatas = [];
          (Array.isArray(cardWorkerIds) && cardWorkerIds.length) && cardWorkerIds.forEach(async (e) => {
            const memberData = await getMember(e);
            memberDatas.push(memberData);
          });
          await postComment(cardId, memberDatas);
          log("Posting day 0 comment...");
        }
      });
    } catch (err) {
      log(`Error in day 0 comment job: ${err.message}`);
    }
  },
  null,
  true,
  timezone
);

const day1EmailJob = new cron.CronJob(
  cronTimes.commentTime,
  async () => {
    try {
      const boards = await getBoards();
      let cards = [];
      (Array.isArray(boards) && boards.length) && boards.forEach(async e => {
        let card = await getCardsFromList(e.id);
        cards.push(card);
      });
      cards.forEach(async (card) => {
        let cardId = card.id;
        let lastComment = await getLastComment(cardId);
        let cardData = await getCardDetails(cardId);
        let cardUrl = cardData.url;
        let cardName = cardData.name;
        let cuurentDate = new Date();
        let lastCommentDate = new Date(lastComment.date)
        const normalizedCuurentDate = new Date(cuurentDate.getFullYear(), cuurentDate.getMonth(), cuurentDate.getDate());
        const normalizedLastCommentDate = new Date(lastCommentDate.getFullYear(), lastCommentDate.getMonth(), lastCommentDate.getDate());
        const timeDifference = normalizedCuurentDate - normalizedLastCommentDate;
        const dayDifference = timeDifference / (1000 * 60 * 60 * 24);
        let commentText = lastComment.data.text;
        let lastChars = commentText.slice(-25);

        if ((7 > dayDifference > 0) && lastChars === "Please provide an update.") {
          const cardMembers = card.idMembers;
          let cardWorkerIds = [];

          (Array.isArray(cardMembers) && cardMembers.length) && cardMembers.forEach(e => {
            if (e !== "59b3208fbd9a6b2be8b0a436") {
              cardWorkerIds.push(e)
            }
          });

          let memberDatas = [];
          (Array.isArray(cardWorkerIds) && cardWorkerIds.length) && cardWorkerIds.forEach(async (e) => {
            const memberData = await getMember(e);
            memberDatas.push(memberData, cardId);
          });
          await sendBulkEmails(memberDatas, cardUrl, cardName);
          memberDatas.forEach(async (member) => {
            const subject = `Update trello card: ${cardName}`;
            const description = `Hi ${member.username},\n\nPlease provide an update to ${cardUrl} as soon as you see this message. Thank you.\n\n~ Noodzakelijk Online`;
            await createEmailTicket(subject, description, email);
          })
          log("Posting day 1 sent emails...");
        }
      });
    } catch (err) {
      log(`Error in day 1 email job: ${err.message}`);
    }
  },
  null,
  true,
  timezone
);


const day2SmsJob = new cron.CronJob(
  cronTimes.smsTime,
  async () => {
    try {
      const boards = await getBoards();
      let cards = [];
      (Array.isArray(boards) && boards.length) && boards.forEach(async e => {
        let card = await getCardsFromList(e.id);
        cards.push(card);
      });
      cards.forEach(async (card) => {
        let cardId = card.id;
        let lastComment = await getLastComment(cardId);
        let cardData = await getCardDetails(cardId);
        let cardUrl = cardData.url;
        let cardName = cardData.name;
        let cuurentDate = new Date();
        let lastCommentDate = new Date(lastComment.date)
        const normalizedCuurentDate = new Date(cuurentDate.getFullYear(), cuurentDate.getMonth(), cuurentDate.getDate());
        const normalizedLastCommentDate = new Date(lastCommentDate.getFullYear(), lastCommentDate.getMonth(), lastCommentDate.getDate());
        const timeDifference = normalizedCuurentDate - normalizedLastCommentDate;
        const dayDifference = timeDifference / (1000 * 60 * 60 * 24);
        let commentText = lastComment.data.text;
        let lastChars = commentText.slice(-25);
        if ((7 > dayDifference > 1) && lastChars === "Please provide an update.") {
          const cardMembers = card.idMembers;
          let cardWorkerIds = [];

          (Array.isArray(cardMembers) && cardMembers.length) && cardMembers.forEach(e => {
            if (e !== "59b3208fbd9a6b2be8b0a436") {
              cardWorkerIds.push(e);
            }
          });

          let memberDatas = [];
          (Array.isArray(cardWorkerIds) && cardWorkerIds.length) && cardWorkerIds.forEach(async (e) => {
            const memberData = await getMember(e);
            memberDatas.push(memberData);
          });
          await sendBulkEmails(memberDatas, cardUrl, cardName);
          memberDatas.forEach(async (member) => {
            const subject = `Update trello card: ${cardName}`;
            const description = `Hi ${member.username},\n\nPlease provide an update to ${cardUrl} as soon as you see this message. Thank you.\n\n~ Noodzakelijk Online`;
            const email = member.email;
            const phone = getPhoneNumber(email);
            phone && await sendSmsMessage(phone, description);
            await createEmailTicket(subject, description, email);
            phone && await createSmsTicket(subject, description, phone);
          });
          log("Posting day 2 sent messages...");
        }
      });
    } catch (err) {
      log(`Error in day 2 messages job: ${err.message}`);
    }
  },
  null,
  true,
  timezone
);

log("Starting cron jobs...");
day0CommentJob.start();
day1EmailJob.start();
day2SmsJob.start();


app.get('/', (req, res) => {
  res.send('Hello from Google Cloud Run!');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});