# Product Architecture for AutoReminder

## System Architecture Overview

The AutoReminder system will follow a Model-View-Controller (MVC) architecture with a RESTful API backend and a React-based frontend. The system will be deployed on Google Cloud Run with a CI/CD pipeline for automated testing and deployment.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Web Interface  │◄────┤  REST API       │◄────┤  Database       │
│  (React)        │     │  (Express)      │     │  (MongoDB)      │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               ▲
                               │
                               ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Trello API     │◄────┤  Core Services  │────►│  Notification   │
│  Integration    │     │                 │     │  Services       │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               ▲
                               │
                               ▼
                        ┌─────────────────┐
                        │                 │
                        │  Scheduled      │
                        │  Jobs           │
                        │                 │
                        └─────────────────┘
```

## Core Components

### 1. Database Layer
- **Technology**: MongoDB
- **Purpose**: Store configuration, templates, logs, and reporting data
- **Collections**:
  - Users (administrators)
  - Templates (notification templates)
  - Configuration (system settings)
  - Logs (activity and notification logs)
  - Reports (aggregated reporting data)
  - Cards (cached Trello card data)

### 2. Backend API Layer
- **Technology**: Express.js
- **Purpose**: Provide RESTful API endpoints for frontend and handle business logic
- **Controllers**:
  - AuthController (user authentication)
  - ConfigController (system configuration)
  - TemplateController (template management)
  - ReportController (reporting and analytics)
  - LogController (activity logs)
  - TrelloController (Trello integration)
  - NotificationController (notification management)

### 3. Frontend Layer
- **Technology**: React.js
- **Purpose**: Provide user interface for configuration, monitoring, and reporting
- **Components**:
  - Dashboard (overview and statistics)
  - Template Manager (customize notification templates)
  - Configuration Panel (system settings)
  - User Management (administrator accounts)
  - Reports (data visualization and export)
  - Activity Logs (view and filter logs)
  - Manual Override (urgent task handling)

### 4. Core Services
- **TrelloService**: Handle Trello API integration
  - Retrieve card details
  - Get assigned users and email addresses
  - Post comments
  - Monitor activity
  
- **NotificationService**: Handle multi-channel notifications
  - Email notifications (SendGrid)
  - SMS notifications (Twilio)
  - WhatsApp notifications (Twilio)
  - Trello comments
  
- **SchedulerService**: Manage scheduled jobs
  - Day 0 comment job
  - Day 1 email job
  - Day 2 SMS/WhatsApp job
  - Weekend pause handling
  
- **ReportingService**: Generate reports and analytics
  - Response rate tracking
  - Notification statistics
  - User activity metrics
  
- **LoggingService**: Comprehensive logging
  - Activity logging
  - Error logging
  - Notification tracking

## Database Schema

### Users Collection
```json
{
  "_id": "ObjectId",
  "username": "String",
  "email": "String",
  "password": "String (hashed)",
  "role": "String (admin, user)",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### Templates Collection
```json
{
  "_id": "ObjectId",
  "name": "String",
  "type": "String (trello, email, sms, whatsapp)",
  "subject": "String (for email)",
  "content": "String",
  "variables": ["String"],
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### Configuration Collection
```json
{
  "_id": "ObjectId",
  "weekendDays": ["Number (0-6)"],
  "reminderTimes": {
    "day0": "String (cron format)",
    "day1": "String (cron format)",
    "day2": "String (cron format)"
  },
  "maxReminderDays": "Number",
  "timezone": "String",
  "allowUrgentOverride": "Boolean",
  "updatedAt": "Date"
}
```

### Logs Collection
```json
{
  "_id": "ObjectId",
  "type": "String (notification, activity, error)",
  "cardId": "String",
  "cardName": "String",
  "userId": "String",
  "username": "String",
  "action": "String",
  "channel": "String (trello, email, sms, whatsapp)",
  "status": "String (success, failure)",
  "message": "String",
  "timestamp": "Date"
}
```

### Reports Collection
```json
{
  "_id": "ObjectId",
  "reportType": "String (daily, weekly)",
  "startDate": "Date",
  "endDate": "Date",
  "metrics": {
    "totalCards": "Number",
    "responseRate": "Number",
    "avgResponseTime": "Number",
    "notificationsSent": {
      "trello": "Number",
      "email": "Number",
      "sms": "Number",
      "whatsapp": "Number"
    }
  },
  "userMetrics": [
    {
      "userId": "String",
      "username": "String",
      "notificationsReceived": "Number",
      "responseRate": "Number"
    }
  ],
  "generatedAt": "Date"
}
```

### Cards Collection
```json
{
  "_id": "ObjectId",
  "trelloId": "String",
  "name": "String",
  "url": "String",
  "dueDate": "Date",
  "assignedUsers": [
    {
      "trelloId": "String",
      "username": "String",
      "email": "String",
      "phone": "String"
    }
  ],
  "reminderStatus": {
    "lastReminderDate": "Date",
    "lastReminderType": "String (trello, email, sms, whatsapp)",
    "reminderCount": "Number",
    "hasResponse": "Boolean",
    "responseDate": "Date"
  },
  "updatedAt": "Date"
}
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/profile` - Get current user profile

### Configuration
- `GET /api/config` - Get system configuration
- `PUT /api/config` - Update system configuration

### Templates
- `GET /api/templates` - Get all templates
- `GET /api/templates/:id` - Get template by ID
- `POST /api/templates` - Create new template
- `PUT /api/templates/:id` - Update template
- `DELETE /api/templates/:id` - Delete template

### Reports
- `GET /api/reports` - Get all reports
- `GET /api/reports/:id` - Get report by ID
- `POST /api/reports/generate` - Generate new report
- `GET /api/reports/download/:id` - Download report as CSV

### Logs
- `GET /api/logs` - Get all logs with pagination
- `GET /api/logs/filter` - Filter logs by type, date, etc.

### Trello Integration
- `GET /api/trello/boards` - Get all Trello boards
- `GET /api/trello/cards` - Get cards from boards
- `POST /api/trello/comment/:cardId` - Post comment on card

### Notifications
- `POST /api/notifications/send` - Send manual notification
- `GET /api/notifications/status` - Get notification status

### Manual Override
- `POST /api/override/urgent/:cardId` - Override weekend pause for urgent tasks

## Scheduled Jobs

### Day 0 Comment Job
- **Time**: 18:30 Amsterdam Time
- **Action**: Post comment on Trello card tagging assigned user
- **Weekend Behavior**: Skip on configured weekend days

### Day 1 Email Job
- **Time**: 18:00 Amsterdam Time
- **Action**: Send email reminder if no response detected
- **Weekend Behavior**: Skip on configured weekend days

### Day 2 SMS/WhatsApp Job
- **Time**: 12:00 Amsterdam Time
- **Action**: Send email and SMS/WhatsApp reminder if no response detected
- **Weekend Behavior**: Skip on configured weekend days

### Daily Report Job
- **Time**: 00:00 Amsterdam Time
- **Action**: Generate daily report and store in database
- **Weekend Behavior**: Run every day

### Weekly Report Job
- **Time**: 00:00 Monday Amsterdam Time
- **Action**: Generate weekly report, store in database, and send email to administrators
- **Weekend Behavior**: Run regardless of weekend configuration

## Error Handling Strategy

1. **Retry Mechanism**
   - Implement exponential backoff for API calls
   - Maximum of 3 retries for failed operations

2. **Error Logging**
   - Log all errors with stack traces
   - Categorize errors by severity

3. **Administrator Notifications**
   - Send email alerts for critical errors
   - Display error notifications in admin dashboard

4. **Graceful Degradation**
   - Continue operation with reduced functionality when non-critical services fail
   - Provide clear user feedback on service status

## Deployment Architecture

### Google Cloud Run
- Containerized application deployment
- Automatic scaling based on load
- HTTPS endpoints with proper security

### MongoDB Atlas
- Cloud-hosted MongoDB database
- Automatic backups and scaling
- Secure connection with proper authentication

### CI/CD Pipeline
- GitHub Actions for automated testing and deployment
- Test, build, and deploy stages
- Environment-specific configuration

## Security Considerations

1. **Authentication and Authorization**
   - JWT-based authentication
   - Role-based access control
   - Secure password storage with bcrypt

2. **API Security**
   - HTTPS for all communications
   - API rate limiting
   - Input validation and sanitization

3. **Data Protection**
   - Encryption of sensitive data
   - Secure handling of API keys
   - Regular security audits
