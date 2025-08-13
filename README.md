# AutoReminder - Comprehensive Trello Reminder System

AutoReminder is a sophisticated automation tool that monitors Trello cards and sends intelligent reminders via multiple channels (Trello comments, email, SMS, WhatsApp) when team members haven't responded to assigned tasks.

## 🚀 Features

### Core Functionality
- **Trello Integration**: Seamless integration with Trello API for card monitoring
- **Multi-Channel Notifications**: Send reminders via Trello comments, email, SMS, and WhatsApp
- **Intelligent Response Detection**: Automatically detects when users respond to reminders
- **Escalation System**: Progressive reminder system (Day 0, Day 1, Day 2)
- **Weekend Pause**: Automatically pauses reminders during weekends
- **Template System**: Customizable message templates for different notification types

### Enhanced Error Handling
- **Comprehensive Error Processing**: Categorized error types with user-friendly messages
- **Automatic Retry Logic**: Exponential backoff for transient failures
- **User-Actionable vs Internal Errors**: Clear distinction between errors users can fix vs system issues
- **Detailed Logging**: Comprehensive error logging with context and metadata
- **Real-time Notifications**: Toast notifications and error banners for immediate feedback

### Dashboard & Management
- **Real-time Dashboard**: Live statistics and monitoring
- **Configuration Management**: Easy setup and testing of notification services
- **Template Management**: Create and manage notification templates
- **Reporting & Analytics**: Comprehensive reporting with data visualization
- **User Management**: Role-based access control and authentication

## 🏗️ Architecture

### Backend (Node.js/Express)
- **RESTful API**: Comprehensive API with proper error handling
- **MongoDB Integration**: Robust data persistence with Mongoose
- **Authentication**: JWT-based authentication with refresh tokens
- **Security**: Helmet, CORS, rate limiting, input validation
- **Services**: Modular service architecture for scalability

### Frontend (React)
- **Modern UI**: Material-UI components with responsive design
- **Error Handling**: Comprehensive error handling with retry logic
- **Real-time Updates**: Auto-refresh and live data updates
- **Form Validation**: Client-side and server-side validation
- **Accessibility**: WCAG compliant interface

### External Integrations
- **Trello API**: Full integration for card monitoring and commenting
- **SendGrid**: Email notifications with templates and tracking
- **Twilio**: SMS and WhatsApp messaging
- **MongoDB**: Document database for data persistence

## 📁 Project Structure

```
autoreminder-app/
├── backend/
│   ├── config/           # Configuration files
│   ├── controllers/      # Route controllers
│   ├── middleware/       # Express middleware
│   ├── models/          # MongoDB models
│   ├── routes/          # API routes
│   ├── services/        # Business logic services
│   ├── utils/           # Utility functions
│   ├── package.json     # Backend dependencies
│   └── server.js        # Main server file
├── frontend/
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── utils/       # Frontend utilities
│   │   └── ...
│   └── package.json     # Frontend dependencies
├── docs/                # Documentation
├── tests/               # Test files
└── README.md           # This file
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- Trello API credentials
- SendGrid API key (for email)
- Twilio credentials (for SMS/WhatsApp)

### Backend Setup

1. **Install Dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Environment Configuration**
   Create `.env` file in the backend directory:
   ```env
   # Server Configuration
   PORT=3001
   NODE_ENV=development
   
   # Database
   MONGODB_URI=mongodb://localhost:27017/autoreminder
   
   # JWT Configuration
   JWT_SECRET=your-super-secret-jwt-key
   JWT_REFRESH_SECRET=your-refresh-secret-key
   JWT_EXPIRES_IN=1h
   JWT_REFRESH_EXPIRES_IN=7d
   
   # Trello API
   TRELLO_API_KEY=your-trello-api-key
   TRELLO_TOKEN=your-trello-token
   
   # SendGrid (Email)
   SENDGRID_API_KEY=your-sendgrid-api-key
   
   # Twilio (SMS/WhatsApp)
   TWILIO_ACCOUNT_SID=your-twilio-account-sid
   TWILIO_AUTH_TOKEN=your-twilio-auth-token
   TWILIO_PHONE_NUMBER=your-twilio-phone-number
   TWILIO_WHATSAPP_NUMBER=whatsapp:+your-whatsapp-number
   
   # Monitoring
   MONITORING_INTERVAL_MINUTES=30
   ```

3. **Start the Backend**
   ```bash
   npm start
   ```

### Frontend Setup

1. **Install Dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Environment Configuration**
   Create `.env` file in the frontend directory:
   ```env
   REACT_APP_API_URL=http://localhost:3001/api
   ```

3. **Start the Frontend**
   ```bash
   npm start
   ```

## 🔧 Configuration

### Trello Setup
1. Get your Trello API key from: https://trello.com/app-key
2. Generate a token with read/write permissions
3. Add the credentials to your `.env` file

### Email Setup (SendGrid)
1. Create a SendGrid account
2. Generate an API key with mail send permissions
3. Verify your sender email address
4. Add the API key to your `.env` file

### SMS/WhatsApp Setup (Twilio)
1. Create a Twilio account
2. Get your Account SID and Auth Token
3. Purchase a phone number for SMS
4. Set up WhatsApp sandbox or get approved number
5. Add credentials to your `.env` file

## 🚀 Usage

### Initial Setup
1. Access the application at `http://localhost:3000`
2. Create an admin account
3. Configure Trello integration in Settings
4. Set up notification channels (email, SMS, WhatsApp)
5. Create notification templates
6. Start monitoring your Trello boards

### Dashboard Features
- **Overview**: Real-time statistics and system status
- **Card Management**: View and manage monitored cards
- **Manual Actions**: Send immediate reminders or pause cards
- **System Health**: Monitor service status and connectivity

### Settings Configuration
- **Trello Integration**: API credentials and board selection
- **Notification Channels**: Configure and test email, SMS, WhatsApp
- **Templates**: Create custom message templates
- **Monitoring**: Set intervals and automation preferences

## 🧪 Testing

### Backend Testing
```bash
cd backend
npm test
```

### Frontend Testing
```bash
cd frontend
npm test
```

### Integration Testing
1. Configure test environment variables
2. Run end-to-end tests
3. Verify Trello integration
4. Test notification services

## 📊 Error Handling & Monitoring

### Error Categories
- **Validation Errors**: User input validation failures
- **Authentication Errors**: Login and token issues
- **Authorization Errors**: Permission denied scenarios
- **Rate Limit Errors**: API rate limiting
- **External Service Errors**: Trello, SendGrid, Twilio failures
- **Database Errors**: MongoDB connection and query issues
- **Network Errors**: Connection timeouts and failures
- **Internal Server Errors**: Unexpected system errors

### Error Recovery
- **Automatic Retry**: Exponential backoff for retryable errors
- **User Notifications**: Clear, actionable error messages
- **Fallback Mechanisms**: Graceful degradation when services fail
- **Comprehensive Logging**: Detailed error logs with context

### Monitoring Features
- **Health Checks**: Service status monitoring
- **Error Analytics**: Error tracking and statistics
- **Performance Metrics**: Response times and throughput
- **Alert System**: Notifications for critical issues

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Security**: Bcrypt hashing with salt
- **Input Validation**: Comprehensive input sanitization
- **Rate Limiting**: API endpoint protection
- **CORS Configuration**: Cross-origin request security
- **Helmet Integration**: Security headers and protection
- **Environment Variables**: Secure credential management

## 📈 Performance Optimization

- **Database Indexing**: Optimized MongoDB queries
- **Caching**: Redis integration for session management
- **Compression**: Gzip compression for responses
- **Connection Pooling**: Efficient database connections
- **Error Boundaries**: React error boundary components
- **Lazy Loading**: Component-based code splitting

## 🚀 Deployment

### Production Environment
1. Set up production MongoDB instance
2. Configure environment variables for production
3. Build frontend for production
4. Deploy backend to cloud platform (AWS, Heroku, etc.)
5. Set up reverse proxy (Nginx)
6. Configure SSL certificates
7. Set up monitoring and logging

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d
```

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/refresh` - Token refresh
- `POST /api/auth/logout` - User logout

### Trello Integration
- `GET /api/trello/boards` - Get user boards
- `GET /api/trello/cards` - Get monitored cards
- `POST /api/trello/sync` - Sync board data
- `POST /api/trello/cards/:id/reminder` - Send manual reminder

### Configuration
- `GET /api/config` - Get configuration
- `PUT /api/config` - Update configuration
- `GET /api/config/validate` - Validate settings

### Notifications
- `POST /api/notifications/test` - Test notification service
- `GET /api/notifications/stats` - Get notification statistics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Check the documentation in the `docs/` folder
- Review the troubleshooting guide
- Create an issue on GitHub
- Contact the development team

## 🔄 Version History

### v1.0.0 (Current)
- Initial release with core functionality
- Trello integration and multi-channel notifications
- Enhanced error handling and monitoring
- React dashboard with Material-UI
- Comprehensive API with authentication
- Production-ready deployment configuration

---

**AutoReminder** - Intelligent Trello task management and reminder automation system.
