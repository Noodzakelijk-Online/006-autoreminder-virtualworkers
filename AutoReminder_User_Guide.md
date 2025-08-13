# AutoReminder User Guide

## Installation Instructions

### System Requirements
- Windows 10 or Windows 11
- 4GB RAM minimum (8GB recommended)
- 500MB free disk space
- Internet connection for Trello integration

### Installation Options

#### Option 1: Installer Version
1. Download the AutoReminder-Setup-1.0.0.exe file
2. Double-click the installer file
3. Follow the on-screen instructions
4. Choose your installation location when prompted
5. Select whether to create desktop and start menu shortcuts
6. Complete the installation

#### Option 2: Portable Version
1. Download the AutoReminder-Portable-1.0.0.exe file
2. Move the file to your preferred location
3. Double-click to run the application without installation
4. No additional setup required

## Getting Started

### First Launch
1. When you first launch AutoReminder, you'll need to connect to your Trello account
2. Click the "Connect to Trello" button on the welcome screen
3. You'll be redirected to Trello's authorization page
4. Grant permission for AutoReminder to access your Trello boards and cards
5. After successful authentication, you'll be returned to the application

### Dashboard Overview
The dashboard provides a quick overview of:
- Cards due today and upcoming
- Notification statistics
- Recent activity
- System status

### Configuration
Before using the application, configure the following settings:

1. **General Settings**
   - Theme (Dark/Light)
   - Startup options
   - Accent color

2. **Reminder Settings**
   - Weekend days (which days to pause reminders)
   - Reminder schedule
   - Timezone settings

3. **Notification Channels**
   - Enable/disable Trello comments
   - Configure email notifications
   - Set up SMS/WhatsApp notifications (requires Twilio account)

4. **Database Settings**
   - Choose between local storage, cloud storage, or hybrid mode
   - Configure sync settings if using cloud or hybrid mode

## Using AutoReminder

### Managing Trello Integration
1. Go to the Trello Integration page
2. Select which boards to monitor
3. Configure which list names to include
4. Use the "Sync Cards" button to manually update card data

### Creating Notification Templates
1. Navigate to the Templates page
2. Click "Create Template"
3. Choose the notification channel (Trello, Email, SMS, WhatsApp)
4. Design your template using the rich text editor
5. Use variables like {{username}}, {{cardName}}, {{dueDate}} in your templates

### Viewing and Managing Notifications
1. Go to the Notifications page to see all cards with due dates
2. Send manual notifications by selecting a card and clicking "Send Notification"
3. View notification history and statistics

### Generating Reports
1. Navigate to the Reports page
2. Click "Generate Report"
3. Choose the report type (daily, weekly, monthly, quarterly, or custom)
4. Select options for charts and detailed tables
5. Download the report as PDF or email it to recipients

### Viewing System Logs
1. Go to the Logs page to view system activity
2. Filter logs by level, source, or search text
3. Export logs for troubleshooting

## Advanced Features

### Automated Reminders
AutoReminder automatically sends reminders based on your configuration:
- Cards are checked against their due dates
- Reminders are sent according to your schedule
- Weekend days are skipped unless urgent override is enabled

### Multi-Channel Notifications
Send notifications through multiple channels simultaneously:
- Trello comments appear directly on the card
- Email notifications are sent to the card member's email
- SMS and WhatsApp messages are sent to configured phone numbers

### Data Synchronization
If using cloud or hybrid database mode:
- Data is synchronized between devices
- Changes made on one device appear on others
- Offline changes are synced when connection is restored

## Troubleshooting

### Common Issues

#### Application Won't Start
- Verify you have the required .NET Framework installed
- Check Windows Event Viewer for error details
- Try running as administrator

#### Trello Authentication Fails
- Check your internet connection
- Verify your Trello account credentials
- Try disconnecting and reconnecting to Trello

#### Notifications Not Sending
- Check your notification channel configurations
- Verify API keys and credentials for email and SMS services
- Check the Logs page for specific error messages

#### Database Sync Issues
- Verify your internet connection
- Check cloud database credentials
- Try manual sync using the "Sync Now" button

### Getting Help
If you encounter issues not covered in this guide:
- Check the Logs page for error details
- Export logs and send them to support
- Visit our support website for additional resources

## Web Version Access
The web version of AutoReminder is available alongside the desktop application:
- Access the web version at https://autoreminder.example.com
- Use the same Trello account credentials
- Data is synchronized between web and desktop versions
- The web version offers the same features as the desktop application

## Updates
AutoReminder will automatically check for updates:
- You'll be notified when updates are available
- Choose to install updates immediately or later
- Updates include new features, improvements, and bug fixes
