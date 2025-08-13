# AutoReminder Deployment Guide

## Overview

This guide provides instructions for deploying the AutoReminder application to Google Cloud Run. The deployment process includes setting up the database, configuring environment variables, and deploying both the backend API and frontend client.

## Prerequisites

Before deploying, ensure you have the following:

- Google Cloud Platform account with billing enabled
- Google Cloud SDK installed and configured
- Docker installed locally
- MongoDB Atlas account (or other MongoDB hosting)
- Trello API credentials
- SMTP server for email notifications
- Twilio account for SMS/WhatsApp notifications (optional)

## Environment Setup

### 1. Create MongoDB Database

1. Log in to MongoDB Atlas (or your preferred MongoDB hosting)
2. Create a new project (if needed)
3. Create a new cluster
4. Set up database access user with password
5. Configure network access (whitelist IP addresses or allow access from anywhere)
6. Get your MongoDB connection string

### 2. Set Up Trello API Access

1. Log in to your Trello account
2. Go to https://trello.com/app-key to get your API key
3. Generate a token for your account

### 3. Set Up Email Service

1. Configure your SMTP server or use a service like SendGrid
2. Note your SMTP credentials

### 4. Set Up Twilio (Optional)

1. Create a Twilio account
2. Get your Account SID and Auth Token
3. Set up a phone number for SMS
4. Set up WhatsApp Business API access (if needed)

## Backend Deployment

### 1. Configure Environment Variables

Create a `.env` file in the project root with the following variables:

```
# Server Configuration
PORT=8080
NODE_ENV=production
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRATION=24h

# MongoDB Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/autoreminder

# Trello API Configuration
TRELLO_API_KEY=your_trello_api_key
TRELLO_TOKEN=your_trello_token

# Email Configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
EMAIL_FROM=noreply@autoreminder.example.com

# SMS/WhatsApp Configuration (Optional)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
TWILIO_WHATSAPP_NUMBER=your_twilio_whatsapp_number

# Scheduler Configuration
TIMEZONE=Europe/Amsterdam
```

### 2. Build Docker Image

1. Create a `Dockerfile` in the project root:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 8080

CMD ["node", "index.js"]
```

2. Build the Docker image:

```bash
docker build -t autoreminder-api .
```

### 3. Deploy to Google Cloud Run

1. Tag your Docker image for Google Container Registry:

```bash
docker tag autoreminder-api gcr.io/your-project-id/autoreminder-api
```

2. Push the image to Google Container Registry:

```bash
docker push gcr.io/your-project-id/autoreminder-api
```

3. Deploy to Cloud Run:

```bash
gcloud run deploy autoreminder-api \
  --image gcr.io/your-project-id/autoreminder-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="$(cat .env | xargs)"
```

4. Note the service URL provided after deployment

## Frontend Deployment

### 1. Configure Environment Variables

Create a `.env` file in the `client` directory:

```
REACT_APP_API_URL=https://your-backend-service-url
```

### 2. Build the Frontend

```bash
cd client
npm install
npm run build
```

### 3. Deploy to Google Cloud Run

1. Create a `Dockerfile` in the `client` directory:

```dockerfile
FROM node:20-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

2. Create an `nginx.conf` file:

```
server {
    listen 80;
    
    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }
    
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
```

3. Build the Docker image:

```bash
docker build -t autoreminder-client .
```

4. Tag and push to Google Container Registry:

```bash
docker tag autoreminder-client gcr.io/your-project-id/autoreminder-client
docker push gcr.io/your-project-id/autoreminder-client
```

5. Deploy to Cloud Run:

```bash
gcloud run deploy autoreminder-client \
  --image gcr.io/your-project-id/autoreminder-client \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

6. Note the service URL provided after deployment

## Setting Up CI/CD Pipeline

### 1. Create a Cloud Build Configuration

Create a `cloudbuild.yaml` file in the project root:

```yaml
steps:
  # Build and push backend image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/autoreminder-api', '.']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/autoreminder-api']
  
  # Deploy backend to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'autoreminder-api'
      - '--image'
      - 'gcr.io/$PROJECT_ID/autoreminder-api'
      - '--platform'
      - 'managed'
      - '--region'
      - 'us-central1'
      - '--allow-unauthenticated'
      - '--set-env-vars'
      - 'NODE_ENV=production,PORT=8080,JWT_SECRET=${_JWT_SECRET},MONGODB_URI=${_MONGODB_URI},TRELLO_API_KEY=${_TRELLO_API_KEY},TRELLO_TOKEN=${_TRELLO_TOKEN},SMTP_HOST=${_SMTP_HOST},SMTP_PORT=${_SMTP_PORT},SMTP_USER=${_SMTP_USER},SMTP_PASS=${_SMTP_PASS},EMAIL_FROM=${_EMAIL_FROM}'
  
  # Build and push frontend image
  - name: 'gcr.io/cloud-builders/docker'
    dir: 'client'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/autoreminder-client', '.']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/autoreminder-client']
  
  # Deploy frontend to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'autoreminder-client'
      - '--image'
      - 'gcr.io/$PROJECT_ID/autoreminder-client'
      - '--platform'
      - 'managed'
      - '--region'
      - 'us-central1'
      - '--allow-unauthenticated'

images:
  - 'gcr.io/$PROJECT_ID/autoreminder-api'
  - 'gcr.io/$PROJECT_ID/autoreminder-client'
```

### 2. Set Up Cloud Build Trigger

1. Go to Cloud Build in Google Cloud Console
2. Create a new trigger
3. Connect to your GitHub or Bitbucket repository
4. Configure the trigger to use the `cloudbuild.yaml` file
5. Set up substitution variables for all environment variables

## Post-Deployment Steps

### 1. Create Initial Admin User

Use the API to create an initial admin user:

```bash
curl -X POST https://your-backend-service-url/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin User","email":"admin@example.com","password":"securepassword","role":"admin"}'
```

### 2. Configure Default Templates

Log in to the application and create default notification templates for each channel (Trello, Email, SMS, WhatsApp).

### 3. Set Up Scheduler

The application uses a built-in scheduler, but for more reliability, you can set up a Cloud Scheduler job to trigger the reminder process:

1. Go to Cloud Scheduler in Google Cloud Console
2. Create a new job
3. Set the frequency (e.g., `0 * * * *` for hourly)
4. Set the target as HTTP
5. Enter your backend service URL with the endpoint: `https://your-backend-service-url/api/scheduler/run`
6. Add an Authorization header with a token

## Monitoring and Maintenance

### 1. Set Up Logging

1. Go to Cloud Logging in Google Cloud Console
2. Create log-based metrics for important events
3. Set up alerts for error conditions

### 2. Set Up Monitoring

1. Go to Cloud Monitoring in Google Cloud Console
2. Create uptime checks for both frontend and backend services
3. Set up dashboards to monitor performance

### 3. Regular Maintenance

1. Regularly check logs for errors
2. Monitor database performance
3. Update dependencies as needed
4. Perform regular backups of the MongoDB database

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Check MongoDB connection string
   - Verify network access settings
   - Check for MongoDB service outages

2. **Trello API Issues**
   - Verify API key and token
   - Check Trello API status
   - Look for rate limiting issues

3. **Notification Failures**
   - Check SMTP settings for email
   - Verify Twilio credentials for SMS/WhatsApp
   - Check logs for specific error messages

4. **Cloud Run Deployment Issues**
   - Check build logs for errors
   - Verify environment variables
   - Check service account permissions

### Getting Help

If you encounter issues not covered in this guide, please:

1. Check the application logs in Cloud Logging
2. Review the error message and search for solutions
3. Contact the development team for assistance

## Conclusion

Your AutoReminder application should now be successfully deployed to Google Cloud Run. The application is scalable, reliable, and can be easily updated through the CI/CD pipeline.

For any additional questions or support, please contact the development team.
