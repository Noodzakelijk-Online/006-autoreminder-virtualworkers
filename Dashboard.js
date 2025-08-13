import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  Paper, 
  CircularProgress,
  Card,
  CardContent,
  CardHeader,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Alert,
  Button,
  Snackbar
} from '@mui/material';
import { api } from '../utils/api';
import { errorHandler, showError } from '../utils/errorHandler';
import { 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import EmailIcon from '@mui/icons-material/Email';
import SmsIcon from '@mui/icons-material/Sms';
import CommentIcon from '@mui/icons-material/Comment';
import RefreshIcon from '@mui/icons-material/Refresh';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [recentCards, setRecentCards] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
  const [lastUpdated, setLastUpdated] = useState(null);
  
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];
  const maxRetries = 3;

  // Enhanced data fetching with comprehensive error handling
  const fetchDashboardData = async (showLoadingIndicator = true) => {
    try {
      if (showLoadingIndicator) {
        setLoading(true);
      }
      setError(null);
      
      // Fetch data using the new API utility
      const [statsResponse, cardsResponse] = await Promise.allSettled([
        api.trello.getStats(),
        api.trello.getCards({ limit: 10, hasResponse: false })
      ]);
      
      // Handle stats response
      if (statsResponse.status === 'fulfilled') {
        setStats(statsResponse.value.data.stats);
      } else {
        console.error('Failed to load stats:', statsResponse.reason);
        handleDashboardError(statsResponse.reason, 'load_stats', false);
      }
      
      // Handle cards response
      if (cardsResponse.status === 'fulfilled') {
        setRecentCards(cardsResponse.value.data.cards || []);
      } else {
        console.error('Failed to load cards:', cardsResponse.reason);
        handleDashboardError(cardsResponse.reason, 'load_cards', false);
        // Fallback to simulated data for demo
        setRecentCards([
          { id: 1, name: 'Website Redesign', status: 'responded', lastActivity: '2 hours ago' },
          { id: 2, name: 'Content Creation', status: 'pending', lastActivity: '1 day ago' },
          { id: 3, name: 'SEO Optimization', status: 'no_response', lastActivity: '3 days ago' },
          { id: 4, name: 'Social Media Campaign', status: 'pending', lastActivity: '12 hours ago' },
        ]);
      }
      
      setLastUpdated(new Date());
      setRetryCount(0); // Reset retry count on success
      
    } catch (err) {
      handleDashboardError(err, 'fetch_dashboard_data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Enhanced error handling
  const handleDashboardError = (error, action, setMainError = true) => {
    const processedError = errorHandler.processError(error, { 
      component: 'Dashboard',
      action,
      retryCount 
    });

    if (setMainError) {
      setError(processedError);
    }

    // Show user-friendly notification
    showNotification({
      message: processedError.message,
      severity: processedError.color === 'error' ? 'error' : 'warning'
    });

    // Auto-retry for retryable errors
    if (processedError.retryable && retryCount < maxRetries) {
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
        fetchDashboardData(false);
      }, Math.pow(2, retryCount) * 1000); // Exponential backoff
    }
  };

  // Show notification helper
  const showNotification = ({ message, severity = 'info' }) => {
    setNotification({ open: true, message, severity });
  };

  // Refresh dashboard data
  const refreshDashboard = async () => {
    setRefreshing(true);
    await fetchDashboardData(false);
  };

  // Retry failed operations
  const retryOperation = () => {
    setRetryCount(0);
    fetchDashboardData();
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading && !refreshing) {
        refreshDashboard();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [loading, refreshing]);

  // Prepare data for charts
  const prepareResponseData = () => {
    if (!stats) return [];
    
    return [
      { name: 'Responded', value: stats.cardsWithResponses },
      { name: 'No Response', value: stats.totalCards - stats.cardsWithResponses }
    ];
  };
  
  const prepareReminderData = () => {
    if (!stats || !stats.reminderCounts) return [];
    
    return stats.reminderCounts.map(item => ({
      name: `Reminder ${item._id}`,
      count: item.count
    }));
  };

  if (loading && !stats) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Loading dashboard...
        </Typography>
      </Box>
    );
  }

  if (error && !stats) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 4, maxWidth: 600, mx: 'auto' }}>
        <Alert 
          severity={error.color === 'error' ? 'error' : 'warning'} 
          sx={{ mb: 2, width: '100%' }}
          action={
            error.retryable && (
              <Button color="inherit" size="small" onClick={retryOperation}>
                Retry
              </Button>
            )
          }
        >
          <Typography variant="h6">{error.title}</Typography>
          <Typography variant="body2">{error.message}</Typography>
          {error.retryable && (
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              Retry attempt: {retryCount}/{maxRetries}
            </Typography>
          )}
        </Alert>
        
        {error.action === 'login' && (
          <Button 
            variant="contained" 
            onClick={() => window.location.href = '/login'}
            sx={{ mt: 2 }}
          >
            Login
          </Button>
        )}
      </Box>
    );
  }

  return (
    <Box>
      {/* Header with refresh button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <div>
          <Typography variant="h4" gutterBottom>
            Dashboard
          </Typography>
          {lastUpdated && (
            <Typography variant="body2" color="text.secondary">
              Last updated: {lastUpdated.toLocaleString()}
            </Typography>
          )}
        </div>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={refreshDashboard}
          disabled={refreshing || loading}
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </Box>

      {/* Error banner for non-critical errors */}
      {error && stats && (
        <Alert 
          severity={error.color === 'error' ? 'error' : 'warning'} 
          sx={{ mb: 2 }}
          onClose={() => setError(null)}
          action={
            error.retryable && (
              <Button color="inherit" size="small" onClick={retryOperation}>
                Retry
              </Button>
            )
          }
        >
          {error.message}
        </Alert>
      )}

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification({ ...notification, open: false })}
      >
        <Alert 
          onClose={() => setNotification({ ...notification, open: false })} 
          severity={notification.severity}
        >
          {notification.message}
        </Alert>
      </Snackbar>
      
      {/* Stats Overview */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 140 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Total Cards
            </Typography>
            <Typography component="p" variant="h3">
              {stats?.totalCards || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Cards being monitored
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 140 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Response Rate
            </Typography>
            <Typography component="p" variant="h3">
              {stats ? `${Math.round(stats.responseRate * 100)}%` : '0%'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Cards with responses
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 140 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Active Reminders
            </Typography>
            <Typography component="p" variant="h3">
              {stats?.cardsWithReminders || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Cards with active reminders
            </Typography>
          </Paper>
        </Grid>
      </Grid>
      
      {/* Charts */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 300 }}>
            <Typography variant="h6" gutterBottom>
              Response Status
            </Typography>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={prepareResponseData()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {prepareResponseData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 300 }}>
            <Typography variant="h6" gutterBottom>
              Reminder Distribution
            </Typography>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={prepareReminderData()}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
      
      {/* Recent Activity */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Recent Cards" />
            <Divider />
            <CardContent>
              <List>
                {recentCards.map((card) => (
                  <ListItem key={card.id} divider>
                    <ListItemIcon>
                      {card.status === 'responded' ? (
                        <CheckCircleIcon color="success" />
                      ) : card.status === 'no_response' ? (
                        <ErrorIcon color="error" />
                      ) : (
                        <WarningIcon color="warning" />
                      )}
                    </ListItemIcon>
                    <ListItemText 
                      primary={card.name} 
                      secondary={`Last activity: ${card.lastActivity}`} 
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Notification Channels" />
            <Divider />
            <CardContent>
              <List>
                <ListItem divider>
                  <ListItemIcon>
                    <CommentIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Trello Comments" 
                    secondary={`${stats?.metrics?.notificationsSent?.trello || 0} sent`} 
                  />
                </ListItem>
                <ListItem divider>
                  <ListItemIcon>
                    <EmailIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Email Notifications" 
                    secondary={`${stats?.metrics?.notificationsSent?.email || 0} sent`} 
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <SmsIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="SMS/WhatsApp Messages" 
                    secondary={`${(stats?.metrics?.notificationsSent?.sms || 0) + (stats?.metrics?.notificationsSent?.whatsapp || 0)} sent`} 
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
