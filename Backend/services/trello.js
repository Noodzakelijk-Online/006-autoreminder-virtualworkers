const axios = require("axios");
const { TRELLO_API_KEY, TRELLO_TOKEN, TRELLO_BASE_URL } = require("../config/env");

const getCardDetails = async (cardId) => {
  const url = `${TRELLO_BASE_URL}/cards/${cardId}?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`;
  try {
    const response = await axios.get(url);
    const cardData = response.data;
    return cardData;
  } catch (error) {
    throw new Error(`Error fetching Trello card details: ${error.message}`);
  }
};

const getOrganizations = async () => {
  const url = `${TRELLO_BASE_URL}/members/me/organizations?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`;
  try {
    const response = await axios.get(url);
    const organizationData = response.data;
    console.log(organizationData);
    return organizationData;
  } catch (error) {
    throw new Error(`Error fetching organization Id array: ${error.message}`);
  }
};

const getBoards = async () => {
  const url = `${TRELLO_BASE_URL}/members/me/boards?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`;
  try {
    const response = await axios.get(url);
    const borderData = response.data;
    console.log(borderData);
    return borderData;
  } catch (error) {
    throw new Error(`Error fetching Trello card details: ${error.message}`);
  }
};

const getCardsFromBoard = async (boardId) => {
  const url = `${TRELLO_BASE_URL}/boards/${boardId}/cards?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`;
  try {
    const response = await axios.get(url);
    const borderData = response.data;
    console.log(borderData);
    return borderData;
  } catch (error) {
    throw new Error(`Error fetching Trello card details: ${error.message}`);
  }
};

const getCardsFromList = async (boardId) => {
  try {
    // Step 1: Get all lists on the board
    const listsResponse = await axios.get(`https://api.trello.com/1/boards/${boardId}/lists`, {
      params: { key: API_KEY, token: API_TOKEN },
    });

    // Step 2: Find the list Id for the "Doing" list
    const doingList = listsResponse.data.find((list) => list.name === "Doing");
    // if (!list) {
    //   console.error(`List with name "Doing" not found.`);
    //   return;
    // }

    // Step 3: Get all cards in the "Doing" list
    const doingCardsResponse = await axios.get(`https://api.trello.com/1/lists/${doingList.id}/cards`, {
      params: { key: API_KEY, token: API_TOKEN },
    });

    // Step 3: Find the list Id for the "On-Hold" list
    const onHoldList = listsResponse.data.find((list) => list.name === "On-Hold");
    // if (!list) {
    //   console.error(`List with name "Doing" not found.`);
    //   return;
    // }

    // Step 4: Get all cards in the "On-Hold" list
    const onHoldCardsResponse = await axios.get(`https://api.trello.com/1/lists/${onHoldList.id}/cards`, {
      params: { key: API_KEY, token: API_TOKEN },
    });

    const reminderCards = [...doingCardsResponse.data, ...onHoldCardsResponse.data];    

    console.log(`Cards in "Doing" and "On-Hold" lists:`, reminderCards);
    return reminderCards;
  } catch (error) {
    console.error('Error fetching cards:', error.response ? error.response.data : error.message);
  }
};

const getMember = async (memberId) => {
  try {
    const memberResponse = await axios.get(`https://api.trello.com/1/members/${memberId}`, {
      params: { key: API_KEY, token: API_TOKEN },
    });
    const member = memberResponse.data;
    return member;
  } catch (error) {
    throw new Error(`Error fetching member details: ${error.message}`);
  }
};

const getLastComment = async (cardId) => {
  try {
    const comments = await axios.get(`https://api.trello.com/1/cards/${cardId}/actions`, {
      params: { key: API_KEY, token: API_TOKEN },
    });
    return (comments.length > 0) ? comments[0] : null;
  } catch (error) {
    throw new Error(`Error fetching member details: ${error.message}`);
  }
};

const postComment = async (cardId, memberDatas) => {
  try {
    const url = `${TRELLO_BASE_URL}/cards/${cardId}/actions/comments?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`;

    let usernames = "";
    memberDatas.forEach((member) => {
      usernames = usernames + "@" + member.username + " ";
    })
    let comment = usernames + "Please provide an update."

    await axios.post(url, { text: comment });
    console.log(`Comment posted on card ${cardId}: ${comment}`);
  } catch (error) {
    throw new Error(`Error posting comment: ${error.message}`);
  }

};

module.exports = { getCardDetails, getOrganizations, getBoards, getCardsFromBoard, getCardsFromList, getMember, getLastComment, postComment };
