# AutoReminder API Documentation

## Overview

The AutoReminder API provides programmatic access to the AutoReminder system, allowing developers to integrate with and extend the functionality of the application. This document outlines all available endpoints, request parameters, and response formats.

## Base URL

All API endpoints are relative to the base URL:

```
https://api.autoreminder.example.com/api
```

## Authentication

All API requests require authentication using JSON Web Tokens (JWT).

### Obtaining a Token

```
POST /auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "yourpassword"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "60d21b4667d0d8992e610c85",
    "name": "John Doe",
    "email": "user@example.com",
    "role": "admin"
  }
}
```

### Using the Token

Include the token in the Authorization header of all API requests:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## API Endpoints

### Authentication

#### Register User

```
POST /auth/register
```

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "user@example.com",
  "password": "yourpassword"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "60d21b4667d0d8992e610c85",
    "name": "John Doe",
    "email": "user@example.com",
    "role": "user"
  }
}
```

#### Get Current User

```
GET /auth/me
```

**Response:**
```json
{
  "id": "60d21b4667d0d8992e610c85",
  "name": "John Doe",
  "email": "user@example.com",
  "role": "admin"
}
```

### Configuration

#### Get Configuration

```
GET /config
```

**Response:**
```json
{
  "weekendDays": [0, 6],
  "reminderTimes": {
    "day0": "30 18 * * *",
    "day1": "0 18 * * *",
    "day2": "0 12 * * *"
  },
  "maxReminderDays": 7,
  "timezone": "Europe/Amsterdam",
  "allowUrgentOverride": true
}
```

#### Update Configuration

```
PUT /config
```

**Request Body:**
```json
{
  "weekendDays": [0, 6],
  "reminderTimes": {
    "day0": "30 18 * * *",
    "day1": "0 18 * * *",
    "day2": "0 12 * * *"
  },
  "maxReminderDays": 7,
  "timezone": "Europe/Amsterdam",
  "allowUrgentOverride": true
}
```

**Response:**
```json
{
  "weekendDays": [0, 6],
  "reminderTimes": {
    "day0": "30 18 * * *",
    "day1": "0 18 * * *",
    "day2": "0 12 * * *"
  },
  "maxReminderDays": 7,
  "timezone": "Europe/Amsterdam",
  "allowUrgentOverride": true
}
```

### Templates

#### Get All Templates

```
GET /templates
```

**Response:**
```json
[
  {
    "_id": "60d21b4667d0d8992e610c85",
    "name": "Email Reminder",
    "type": "email",
    "subject": "Task Reminder",
    "content": "Hello {{username}}, please update your card {{cardName}}.",
    "variables": ["username", "cardName"]
  },
  {
    "_id": "60d21b4667d0d8992e610c86",
    "name": "Trello Comment",
    "type": "trello",
    "content": "@{{username}} Please provide an update on this card.",
    "variables": ["username"]
  }
]
```

#### Get Template by ID

```
GET /templates/:id
```

**Response:**
```json
{
  "_id": "60d21b4667d0d8992e610c85",
  "name": "Email Reminder",
  "type": "email",
  "subject": "Task Reminder",
  "content": "Hello {{username}}, please update your card {{cardName}}.",
  "variables": ["username", "cardName"]
}
```

#### Create Template

```
POST /templates
```

**Request Body:**
```json
{
  "name": "SMS Reminder",
  "type": "sms",
  "content": "Hi {{username}}, your task '{{cardName}}' is due soon.",
  "variables": ["username", "cardName"]
}
```

**Response:**
```json
{
  "_id": "60d21b4667d0d8992e610c87",
  "name": "SMS Reminder",
  "type": "sms",
  "content": "Hi {{username}}, your task '{{cardName}}' is due soon.",
  "variables": ["username", "cardName"]
}
```

#### Update Template

```
PUT /templates/:id
```

**Request Body:**
```json
{
  "name": "SMS Reminder Updated",
  "type": "sms",
  "content": "Hi {{username}}, your task '{{cardName}}' is due soon. Please update.",
  "variables": ["username", "cardName"]
}
```

**Response:**
```json
{
  "_id": "60d21b4667d0d8992e610c87",
  "name": "SMS Reminder Updated",
  "type": "sms",
  "content": "Hi {{username}}, your task '{{cardName}}' is due soon. Please update.",
  "variables": ["username", "cardName"]
}
```

#### Delete Template

```
DELETE /templates/:id
```

**Response:**
```json
{
  "message": "Template deleted"
}
```

### Trello Integration

#### Get Boards

```
GET /trello/boards
```

**Response:**
```json
[
  {
    "id": "5f7c7e7e7e7e7e7e7e7e7e7e",
    "name": "Development Board"
  },
  {
    "id": "5f7c7e7e7e7e7e7e7e7e7e7f",
    "name": "Marketing Board"
  }
]
```

#### Get Cards

```
GET /trello/cards
```

**Query Parameters:**
- `boardId` (required): ID of the Trello board
- `listNames` (optional): Comma-separated list of list names to filter by

**Response:**
```json
[
  {
    "id": "5f7c7e7e7e7e7e7e7e7e7e80",
    "name": "Website Redesign",
    "due": "2025-04-22T18:00:00.000Z",
    "members": [
      {
        "id": "5f7c7e7e7e7e7e7e7e7e7e81",
        "fullName": "John Doe"
      }
    ],
    "url": "https://trello.com/c/abc123"
  },
  {
    "id": "5f7c7e7e7e7e7e7e7e7e7e82",
    "name": "Content Creation",
    "due": "2025-04-18T18:00:00.000Z",
    "members": [
      {
        "id": "5f7c7e7e7e7e7e7e7e7e7e83",
        "fullName": "Jane Smith"
      }
    ],
    "url": "https://trello.com/c/def456"
  }
]
```

#### Sync Cards

```
POST /trello/sync
```

**Response:**
```json
{
  "cards": [
    {
      "id": "5f7c7e7e7e7e7e7e7e7e7e80",
      "name": "Website Redesign",
      "due": "2025-04-22T18:00:00.000Z"
    },
    {
      "id": "5f7c7e7e7e7e7e7e7e7e7e82",
      "name": "Content Creation",
      "due": "2025-04-18T18:00:00.000Z"
    }
  ],
  "message": "Synced 2 cards from Trello"
}
```

#### Post Comment

```
POST /trello/comment/:cardId
```

**Request Body:**
```json
{
  "message": "Please provide an update on this task."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Comment posted successfully"
}
```

### Notifications

#### Get Notification Status

```
GET /notifications/status
```

**Response:**
```json
{
  "totalCards": 10,
  "cardsWithReminders": 5,
  "cardsWithResponses": 4,
  "responseRate": 0.4,
  "reminderCounts": [
    { "_id": 0, "count": 5 },
    { "_id": 1, "count": 3 },
    { "_id": 2, "count": 2 }
  ],
  "metrics": {
    "notificationsSent": {
      "trello": 8,
      "email": 5,
      "sms": 2,
      "whatsapp": 1
    }
  }
}
```

#### Send Notification

```
POST /notifications/send
```

**Request Body:**
```json
{
  "cardId": "5f7c7e7e7e7e7e7e7e7e7e80",
  "channels": ["email", "trello"],
  "message": "Please provide an update on your task."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notification sent successfully"
}
```

### Reports

#### Get All Reports

```
GET /reports
```

**Response:**
```json
{
  "reports": [
    {
      "_id": "60d21b4667d0d8992e610c88",
      "reportType": "weekly",
      "startDate": "2025-04-10T00:00:00.000Z",
      "endDate": "2025-04-17T00:00:00.000Z",
      "generatedAt": "2025-04-17T12:00:00.000Z"
    },
    {
      "_id": "60d21b4667d0d8992e610c89",
      "reportType": "daily",
      "startDate": "2025-04-18T00:00:00.000Z",
      "endDate": "2025-04-18T23:59:59.000Z",
      "generatedAt": "2025-04-19T00:05:00.000Z"
    }
  ]
}
```

#### Get Report by ID

```
GET /reports/:id
```

**Response:**
```json
{
  "_id": "60d21b4667d0d8992e610c88",
  "reportType": "weekly",
  "startDate": "2025-04-10T00:00:00.000Z",
  "endDate": "2025-04-17T00:00:00.000Z",
  "generatedAt": "2025-04-17T12:00:00.000Z",
  "metrics": {
    "totalCards": 15,
    "responseRate": 0.6,
    "avgResponseTime": 86400000,
    "notificationsSent": {
      "trello": 10,
      "email": 8,
      "sms": 3,
      "whatsapp": 2
    }
  },
  "userMetrics": [
    { "username": "john.doe", "notificationsReceived": 5, "responseRate": 0.8 },
    { "username": "jane.smith", "notificationsReceived": 4, "responseRate": 0.5 }
  ]
}
```

#### Generate Report

```
POST /reports/generate
```

**Request Body:**
```json
{
  "reportType": "weekly",
  "startDate": "2025-04-10",
  "endDate": "2025-04-17"
}
```

**Response:**
```json
{
  "_id": "60d21b4667d0d8992e610c88",
  "reportType": "weekly",
  "startDate": "2025-04-10T00:00:00.000Z",
  "endDate": "2025-04-17T00:00:00.000Z",
  "generatedAt": "2025-04-17T12:00:00.000Z",
  "metrics": {
    "totalCards": 15,
    "responseRate": 0.6,
    "avgResponseTime": 86400000,
    "notificationsSent": {
      "trello": 10,
      "email": 8,
      "sms": 3,
      "whatsapp": 2
    }
  }
}
```

#### Download Report

```
GET /reports/download/:id
```

**Response:**
A CSV file containing the report data.

### Logs

#### Get Logs

```
GET /logs
```

**Query Parameters:**
- `page` (optional): Page number, defaults to 1
- `limit` (optional): Number of logs per page, defaults to 20
- `type` (optional): Filter by log type (reminder, notification, system)
- `channel` (optional): Filter by channel (trello, email, sms, whatsapp)
- `status` (optional): Filter by status (success, error, warning)
- `startDate` (optional): Filter by start date
- `endDate` (optional): Filter by end date

**Response:**
```json
{
  "logs": [
    {
      "_id": "60d21b4667d0d8992e610c90",
      "timestamp": "2025-04-18T15:30:00.000Z",
      "type": "reminder",
      "channel": "email",
      "message": "Reminder sent to john.doe@example.com",
      "status": "success",
      "userId": "60d21b4667d0d8992e610c85",
      "cardId": "5f7c7e7e7e7e7e7e7e7e7e80"
    },
    {
      "_id": "60d21b4667d0d8992e610c91",
      "timestamp": "2025-04-18T14:45:00.000Z",
      "type": "notification",
      "channel": "trello",
      "message": "Comment posted on card \"Website Redesign\"",
      "status": "success",
      "cardId": "5f7c7e7e7e7e7e7e7e7e7e80"
    }
  ],
  "pagination": {
    "total": 25,
    "page": 1,
    "limit": 20,
    "pages": 2
  }
}
```

#### Get Log Statistics

```
GET /logs/stats
```

**Query Parameters:**
- `startDate` (optional): Filter by start date
- `endDate` (optional): Filter by end date

**Response:**
```json
{
  "dateRange": {
    "startDate": "2025-04-11T00:00:00.000Z",
    "endDate": "2025-04-18T23:59:59.000Z"
  },
  "byType": [
    { "_id": "reminder", "count": 15 },
    { "_id": "notification", "count": 8 },
    { "_id": "system", "count": 2 }
  ],
  "byChannel": [
    { "_id": "email", "count": 10 },
    { "_id": "trello", "count": 8 },
    { "_id": "sms", "count": 5 }
  ],
  "byStatus": [
    { "_id": "success", "count": 20 },
    { "_id": "error", "count": 5 }
  ],
  "byDay": [
    { "date": "2025-04-11", "count": 3 },
    { "date": "2025-04-12", "count": 2 },
    { "date": "2025-04-13", "count": 4 },
    { "date": "2025-04-14", "count": 5 },
    { "date": "2025-04-15", "count": 3 },
    { "date": "2025-04-16", "count": 2 },
    { "date": "2025-04-17", "count": 4 },
    { "date": "2025-04-18", "count": 2 }
  ]
}
```

## Error Handling

All API endpoints return appropriate HTTP status codes:

- `200 OK`: Request succeeded
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Authentication required or failed
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

Error responses include a message field:

```json
{
  "message": "Error message describing what went wrong"
}
```

## Rate Limiting

API requests are limited to 100 requests per minute per API key. If you exceed this limit, you'll receive a `429 Too Many Requests` response.

## Webhooks

The API supports webhooks for real-time notifications of events. Contact the system administrator to set up webhooks for your integration.
