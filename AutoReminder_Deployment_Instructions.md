# AutoReminder Deployment Instructions

This file contains instructions for deploying the AutoReminder application using the provided deployment infrastructure.

## Local Development Setup

To run the application locally for development:

1. Clone the repository
2. Navigate to the project root directory
3. Run the following command:

```bash
docker-compose up
```

This will start the MongoDB database, backend API, and frontend client in development mode.

- Backend API will be available at: http://localhost:8080
- Frontend client will be available at: http://localhost:3000

## Production Deployment

For production deployment, follow these steps:

1. Set up a GitHub repository for the project
2. Push the code to the repository
3. Configure the following secrets in your GitHub repository:
   - GCP_PROJECT_ID: Your Google Cloud Platform project ID
   - GCP_SA_KEY: Your Google Cloud service account key (JSON format)
   - JWT_SECRET: Secret key for JWT token generation
   - MONGODB_URI: MongoDB connection string
   - TRELLO_API_KEY: Your Trello API key
   - TRELLO_TOKEN: Your Trello token
   - SMTP_HOST: SMTP server hostname
   - SMTP_PORT: SMTP server port
   - SMTP_USER: SMTP username
   - SMTP_PASS: SMTP password
   - EMAIL_FROM: Email sender address
   - TIMEZONE: Default timezone (e.g., Europe/Amsterdam)

4. Push to the main branch to trigger the CI/CD pipeline

The CI/CD pipeline will:
- Run tests for both backend and frontend
- Build Docker images for both backend and frontend
- Deploy the backend to Google Cloud Run
- Configure the frontend with the backend URL
- Deploy the frontend to Google Cloud Run
- Output the deployment URLs

## Manual Deployment

If you prefer to deploy manually:

### Backend Deployment

1. Build the Docker image:
```bash
docker build -t autoreminder-api .
```

2. Tag the image for Google Container Registry:
```bash
docker tag autoreminder-api gcr.io/your-project-id/autoreminder-api
```

3. Push the image:
```bash
docker push gcr.io/your-project-id/autoreminder-api
```

4. Deploy to Cloud Run:
```bash
gcloud run deploy autoreminder-api \
  --image gcr.io/your-project-id/autoreminder-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production,PORT=8080,JWT_SECRET=your_jwt_secret,MONGODB_URI=your_mongodb_uri,TRELLO_API_KEY=your_trello_api_key,TRELLO_TOKEN=your_trello_token,SMTP_HOST=your_smtp_host,SMTP_PORT=your_smtp_port,SMTP_USER=your_smtp_user,SMTP_PASS=your_smtp_pass,EMAIL_FROM=your_email_from,TIMEZONE=your_timezone"
```

### Frontend Deployment

1. Build the Docker image:
```bash
cd client
docker build -t autoreminder-client .
```

2. Tag the image for Google Container Registry:
```bash
docker tag autoreminder-client gcr.io/your-project-id/autoreminder-client
```

3. Push the image:
```bash
docker push gcr.io/your-project-id/autoreminder-client
```

4. Deploy to Cloud Run:
```bash
gcloud run deploy autoreminder-client \
  --image gcr.io/your-project-id/autoreminder-client \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

For more detailed deployment instructions, please refer to the deployment guide in the docs directory.
