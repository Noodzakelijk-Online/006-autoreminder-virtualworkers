# Vercel Deployment Guide

## Environment Variables Required

Make sure to set these environment variables in your Vercel project settings:

### Required Variables
- `MONGODB_URI` - Your MongoDB connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `JWT_REFRESH_SECRET` - Secret key for refresh tokens
- `TRELLO_API_KEY` - Your Trello API key
- `TRELLO_TOKEN` - Your Trello API token

### Optional Variables (for notifications)
- `SENDGRID_API_KEY` - For email notifications
- `TWILIO_ACCOUNT_SID` - For SMS/WhatsApp notifications
- `TWILIO_AUTH_TOKEN` - Twilio auth token
- `TWILIO_PHONE_NUMBER` - Twilio phone number

### Cron Configuration
- `REMINDER_TIME_DAY0` - Cron expression for day 0 reminders (default: "30 18 * * *")
- `REMINDER_TIME_DAY1` - Cron expression for day 1 reminders (default: "0 18 * * *")
- `REMINDER_TIME_DAY2` - Cron expression for day 2 reminders (default: "0 12 * * *")
- `TIMEZONE` - Timezone for cron jobs (default: "UTC")

### Other Configuration
- `NODE_ENV` - Set to "production" for production deployment
- `PORT` - Port number (Vercel will set this automatically)
- `FRONTEND_URL` - Your frontend domain for CORS (e.g., "https://frontend-auto-rem.vercel.app")

## Deployment Steps

1. Connect your GitHub repository to Vercel
2. Set the build command to: `npm install`
3. Set the output directory to: `backend` (if deploying from root)
4. Add all required environment variables in Vercel dashboard
5. Deploy!

## Notes

- The application uses `server.js` as the main entry point
- Cron jobs will run automatically when the server starts
- Make sure your MongoDB database is accessible from Vercel's servers
- The app is configured with `trust proxy` for proper rate limiting on Vercel
- CORS is configured to allow your frontend domain
- Consider using Vercel's serverless functions for better performance
