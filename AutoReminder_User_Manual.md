# AutoReminder User Manual

## Introduction

AutoReminder is a comprehensive system designed to automatically remind virtual workers about their Trello tasks through multiple notification channels. This application helps teams stay on track by sending timely reminders when tasks are due or require updates, improving accountability and productivity.

## Getting Started

### System Requirements
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection
- Trello account with API access

### Accessing the Application
1. Navigate to the application URL provided by your administrator
2. Log in using your email and password
3. Upon first login, you'll be directed to the Dashboard

## Main Features

### Dashboard
The Dashboard provides an overview of your system's performance and activity:
- Total cards being monitored
- Response rate statistics
- Active reminders count
- Visual charts showing response status and reminder distribution
- Recent card activity
- Notification channel statistics

### Template Management
Templates allow you to customize the content of notifications sent through different channels:

1. **Creating Templates**
   - Click "Add Template" button
   - Select template type (Trello, Email, SMS, WhatsApp)
   - Enter template name
   - For email templates, provide a subject line
   - Enter the template content using variables like {{username}}, {{cardName}}, etc.
   - Click "Save"

2. **Editing Templates**
   - Click the edit icon next to any template
   - Modify the template details
   - Click "Save"

3. **Deleting Templates**
   - Click the delete icon next to any template
   - Confirm deletion

### Configuration
The Configuration panel allows you to customize system settings:

1. **General Settings**
   - Timezone: Set the system timezone
   - Weekend Days: Select which days of the week are considered weekends
   - Maximum Reminder Days: Set how many days to send reminders
   - Allow Urgent Override: Toggle whether urgent tasks can receive reminders on weekends

2. **Reminder Schedule**
   - Set when reminders should be sent using cron format
   - Configure different times for different notification channels

### Reports
The Reports section provides detailed analytics on system performance:

1. **Generating Reports**
   - Select report type (daily or weekly)
   - Set date range
   - Click "Generate Report"

2. **Viewing Reports**
   - Click the view icon next to any report
   - View summary statistics, notification charts, and user metrics

3. **Downloading Reports**
   - Click the download icon next to any report
   - CSV file will be downloaded to your computer

### Activity Logs
The Logs section shows detailed system activity:

1. **Viewing Logs**
   - Browse chronological list of system activities
   - View timestamp, type, channel, message, status, and related user/card

2. **Filtering Logs**
   - Click "Show Filters" button
   - Filter by type, channel, status, or date range
   - Click "Apply Filters"

### Trello Integration
The Trello Integration section allows you to manage Trello boards and cards:

1. **Selecting Boards**
   - Choose a Trello board from the dropdown
   - Specify which list names to monitor (comma-separated)
   - Click "Apply Filters"

2. **Syncing Cards**
   - Click "Sync Cards" button to update card data from Trello

3. **Posting Comments**
   - Click "Comment" button on any card
   - Enter comment text
   - Click "Send Comment"

### Notifications
The Notifications section allows you to send manual notifications:

1. **Sending Manual Notifications**
   - Select a card from the dropdown
   - Click "Compose Notification"
   - Select notification channels (Email, SMS, WhatsApp, Trello)
   - Enter message text
   - Click "Send Notification"

2. **Viewing Notification Status**
   - See overall notification statistics
   - View response rates and reminder distribution

## Troubleshooting

### Common Issues

1. **No cards appearing in Trello Integration**
   - Verify your Trello API credentials
   - Check that the list names match exactly with your Trello board
   - Click "Sync Cards" to refresh data

2. **Notifications not being sent**
   - Check system logs for any errors
   - Verify that templates exist for all notification channels
   - Ensure user contact information is correctly set up

3. **Dashboard statistics not updating**
   - Refresh the page
   - Check system logs for any errors
   - Verify that scheduled jobs are running

### Getting Help
If you encounter issues not covered in this manual, please contact your system administrator.

## Best Practices

1. **Template Design**
   - Keep messages concise and clear
   - Include specific action items
   - Use variables to personalize messages

2. **Reminder Configuration**
   - Set reminder times during working hours
   - Configure weekend pause appropriately for your team
   - Adjust maximum reminder days based on team responsiveness

3. **Regular Monitoring**
   - Check the dashboard regularly
   - Review reports weekly
   - Adjust configuration based on response rates
