import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid,
  CircularProgress,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Alert,
  Button,
  Snackbar,
  Avatar,
  Chip,
  useTheme,
  alpha,
  Stack
} from '@mui/material';
import { api } from '../utils/api';
import { errorHandler } from '../utils/errorHandler';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Email as EmailIcon,
  Sms as SmsIcon,
  Comment as CommentIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Speed as SpeedIcon,
  Notifications as NotificationsIcon,
  ViewKanban as ViewKanbanIcon,
  Schedule as ScheduleIcon,
  AutoAwesome as AutoAwesomeIcon,
  Analytics as AnalyticsIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';

// Modern Metric Card Component
const MetricCard = ({ title, value, change, changeType, icon, color, subtitle }) => {
  const theme = useTheme();

  return (
    <Card
      sx={{
        background: `linear-gradient(135deg, ${alpha(color, 0.1)} 0%, ${alpha(color, 0.05)} 100%)`,
        border: `1px solid ${alpha(color, 0.2)}`,
        transition: 'all 0.3s ease-in-out',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 12px 24px ${alpha(color, 0.15)}`,
        },
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Avatar
            sx={{
              backgroundColor: alpha(color, 0.15),
              color: color,
              width: 48,
              height: 48,
            }}
          >
            {icon}
          </Avatar>
          {change && (
            <Chip
              icon={changeType === 'increase' ? <TrendingUpIcon /> : <TrendingDownIcon />}
              label={`${change}%`}
              size="small"
              sx={{
                backgroundColor: changeType === 'increase'
                  ? alpha(theme.palette.success.main, 0.15)
                  : alpha(theme.palette.error.main, 0.15),
                color: changeType === 'increase'
                  ? theme.palette.success.main
                  : theme.palette.error.main,
                fontWeight: 600,
              }}
            />
          )}
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 700, color: color, mb: 0.5 }}>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

const Dashboard = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [recentCards, setRecentCards] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
  const [lastUpdated, setLastUpdated] = useState(null);
  

  const maxRetries = 3;

  // Enhanced data fetching with comprehensive error handling
  const fetchDashboardData = useCallback(async (showLoadingIndicator = true) => {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryCount]);

  // Enhanced error handling
  const handleDashboardError = useCallback((error, action, setMainError = true) => {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryCount, maxRetries]);

  // Show notification helper
  const showNotification = ({ message, severity = 'info' }) => {
    setNotification({ open: true, message, severity });
  };

  // Refresh dashboard data
  const refreshDashboard = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboardData(false);
  }, [fetchDashboardData]);

  // Retry failed operations
  const retryOperation = () => {
    setRetryCount(0);
    fetchDashboardData();
  };

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading && !refreshing) {
        refreshDashboard();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [loading, refreshing, refreshDashboard]);



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
    <Box sx={{ width: '100%', maxWidth: '1400px', mx: 'auto' }}>
      {/* Modern Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 800,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 1
              }}
            >
              Dashboard
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400 }}>
              Welcome back! Here's what's happening with your reminders.
            </Typography>
            {lastUpdated && (
              <Chip
                icon={<ScheduleIcon />}
                label={`Updated ${lastUpdated.toLocaleString()}`}
                size="small"
                sx={{ mt: 1, backgroundColor: alpha(theme.palette.info.main, 0.1), color: theme.palette.info.main }}
              />
            )}
          </Box>
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              startIcon={<AnalyticsIcon />}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              View Reports
            </Button>
            <Button
              variant="contained"
              startIcon={refreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
              onClick={refreshDashboard}
              disabled={refreshing || loading}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                '&:hover': {
                  background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.secondary.dark} 100%)`,
                },
              }}
            >
              {refreshing ? 'Refreshing...' : 'Refresh Data'}
            </Button>
          </Stack>
        </Box>
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
      
      {/* Modern Metrics Overview */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            title="Total Cards"
            value={stats?.totalCards || 0}
            change={12}
            changeType="increase"
            icon={<ViewKanbanIcon />}
            color={theme.palette.primary.main}
            subtitle="Cards being monitored"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            title="Active Reminders"
            value={stats?.cardsWithReminders || 0}
            change={8}
            changeType="increase"
            icon={<NotificationsIcon />}
            color={theme.palette.warning.main}
            subtitle="Cards with active reminders"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            title="Response Rate"
            value={stats ? `${Math.round(stats.responseRate * 100)}%` : '0%'}
            change={5}
            changeType="increase"
            icon={<TrendingUpIcon />}
            color={theme.palette.success.main}
            subtitle="Cards with responses"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <MetricCard
            title="System Health"
            value="98.5%"
            change={2}
            changeType="increase"
            icon={<SpeedIcon />}
            color={theme.palette.info.main}
            subtitle="Overall system uptime"
          />
        </Grid>
      </Grid>
      
      {/* Modern Charts Section */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} lg={8}>
          <Card
            sx={{
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.02)} 0%, ${alpha(theme.palette.secondary.main, 0.02)} 100%)`,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              height: 400,
            }}
          >
            <CardHeader
              title={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TimelineIcon sx={{ color: theme.palette.primary.main }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Activity Timeline
                  </Typography>
                </Box>
              }
              action={
                <Chip
                  label="Last 7 days"
                  size="small"
                  sx={{
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    color: theme.palette.primary.main,
                    fontWeight: 600,
                  }}
                />
              }
            />
            <CardContent sx={{ height: 'calc(100% - 80px)' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={[
                    { name: 'Mon', reminders: 12, responses: 8 },
                    { name: 'Tue', reminders: 19, responses: 15 },
                    { name: 'Wed', reminders: 15, responses: 12 },
                    { name: 'Thu', reminders: 22, responses: 18 },
                    { name: 'Fri', reminders: 18, responses: 14 },
                    { name: 'Sat', reminders: 8, responses: 6 },
                    { name: 'Sun', reminders: 5, responses: 4 },
                  ]}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorReminders" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorResponses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={theme.palette.success.main} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={theme.palette.success.main} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.3)} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: theme.palette.background.paper,
                      border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                      borderRadius: 8,
                      boxShadow: theme.shadows[4],
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="reminders"
                    stroke={theme.palette.primary.main}
                    fillOpacity={1}
                    fill="url(#colorReminders)"
                    strokeWidth={3}
                  />
                  <Area
                    type="monotone"
                    dataKey="responses"
                    stroke={theme.palette.success.main}
                    fillOpacity={1}
                    fill="url(#colorResponses)"
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} lg={4}>
          <Card
            sx={{
              background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.02)} 0%, ${alpha(theme.palette.info.main, 0.02)} 100%)`,
              border: `1px solid ${alpha(theme.palette.success.main, 0.1)}`,
              height: 400,
            }}
          >
            <CardHeader
              title={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AutoAwesomeIcon sx={{ color: theme.palette.success.main }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Quick Actions
                  </Typography>
                </Box>
              }
            />
            <CardContent>
              <Stack spacing={2}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<NotificationsIcon />}
                  sx={{
                    justifyContent: 'flex-start',
                    py: 1.5,
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 500,
                  }}
                >
                  Send Test Notification
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<ViewKanbanIcon />}
                  sx={{
                    justifyContent: 'flex-start',
                    py: 1.5,
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 500,
                  }}
                >
                  Sync Trello Boards
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<AnalyticsIcon />}
                  sx={{
                    justifyContent: 'flex-start',
                    py: 1.5,
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 500,
                  }}
                >
                  Generate Report
                </Button>

                <Divider sx={{ my: 2 }} />

                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                    System Status
                  </Typography>
                  <Stack spacing={1.5}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: theme.palette.success.main,
                          }}
                        />
                        <Typography variant="body2">Email Service</Typography>
                      </Box>
                      <Chip label="Online" size="small" color="success" />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: theme.palette.success.main,
                          }}
                        />
                        <Typography variant="body2">SMS Service</Typography>
                      </Box>
                      <Chip label="Online" size="small" color="success" />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: theme.palette.warning.main,
                          }}
                        />
                        <Typography variant="body2">WhatsApp Service</Typography>
                      </Box>
                      <Chip label="Limited" size="small" color="warning" />
                    </Box>
                  </Stack>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Recent Activity */}
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12}>
          <Card
            sx={{
              background: `linear-gradient(135deg, ${alpha(theme.palette.grey[50], 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.9)} 100%)`,
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            }}
          >
            <CardHeader
              title={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TimelineIcon sx={{ color: theme.palette.primary.main }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Recent Activity
                  </Typography>
                </Box>
              }
              action={
                <Button
                  size="small"
                  sx={{ textTransform: 'none', fontWeight: 500 }}
                >
                  View All
                </Button>
              }
            />
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: theme.palette.text.secondary }}>
                    Recent Cards
                  </Typography>
                  <Stack spacing={2}>
                    {recentCards.slice(0, 4).map((card, index) => (
                      <Box
                        key={card.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                          p: 2,
                          borderRadius: 2,
                          backgroundColor: alpha(theme.palette.background.paper, 0.7),
                          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                          transition: 'all 0.2s ease-in-out',
                          '&:hover': {
                            transform: 'translateX(4px)',
                            boxShadow: theme.shadows[2],
                          },
                        }}
                      >
                        <Avatar
                          sx={{
                            width: 40,
                            height: 40,
                            backgroundColor: card.status === 'responded'
                              ? alpha(theme.palette.success.main, 0.15)
                              : card.status === 'no_response'
                              ? alpha(theme.palette.error.main, 0.15)
                              : alpha(theme.palette.warning.main, 0.15),
                            color: card.status === 'responded'
                              ? theme.palette.success.main
                              : card.status === 'no_response'
                              ? theme.palette.error.main
                              : theme.palette.warning.main,
                          }}
                        >
                          {card.status === 'responded' ? (
                            <CheckCircleIcon />
                          ) : card.status === 'no_response' ? (
                            <ErrorIcon />
                          ) : (
                            <WarningIcon />
                          )}
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {card.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {card.lastActivity}
                          </Typography>
                        </Box>
                        <Chip
                          label={card.status.replace('_', ' ')}
                          size="small"
                          sx={{
                            backgroundColor: card.status === 'responded'
                              ? alpha(theme.palette.success.main, 0.15)
                              : card.status === 'no_response'
                              ? alpha(theme.palette.error.main, 0.15)
                              : alpha(theme.palette.warning.main, 0.15),
                            color: card.status === 'responded'
                              ? theme.palette.success.main
                              : card.status === 'no_response'
                              ? theme.palette.error.main
                              : theme.palette.warning.main,
                            fontWeight: 600,
                            textTransform: 'capitalize',
                          }}
                        />
                      </Box>
                    ))}
                  </Stack>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: theme.palette.text.secondary }}>
                    Notification Channels
                  </Typography>
                  <Stack spacing={2}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        p: 2,
                        borderRadius: 2,
                        backgroundColor: alpha(theme.palette.background.paper, 0.7),
                        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                      }}
                    >
                      <Avatar
                        sx={{
                          width: 40,
                          height: 40,
                          backgroundColor: alpha(theme.palette.primary.main, 0.15),
                          color: theme.palette.primary.main,
                        }}
                      >
                        <EmailIcon />
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          Email Notifications
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {stats?.metrics?.notificationsSent?.email || 0} sent today
                        </Typography>
                      </Box>
                      <Chip
                        label="Active"
                        size="small"
                        sx={{
                          backgroundColor: alpha(theme.palette.success.main, 0.15),
                          color: theme.palette.success.main,
                          fontWeight: 600,
                        }}
                      />
                    </Box>

                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        p: 2,
                        borderRadius: 2,
                        backgroundColor: alpha(theme.palette.background.paper, 0.7),
                        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                      }}
                    >
                      <Avatar
                        sx={{
                          width: 40,
                          height: 40,
                          backgroundColor: alpha(theme.palette.warning.main, 0.15),
                          color: theme.palette.warning.main,
                        }}
                      >
                        <SmsIcon />
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          SMS Messages
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {stats?.metrics?.notificationsSent?.sms || 0} sent today
                        </Typography>
                      </Box>
                      <Chip
                        label="Active"
                        size="small"
                        sx={{
                          backgroundColor: alpha(theme.palette.success.main, 0.15),
                          color: theme.palette.success.main,
                          fontWeight: 600,
                        }}
                      />
                    </Box>

                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        p: 2,
                        borderRadius: 2,
                        backgroundColor: alpha(theme.palette.background.paper, 0.7),
                        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                      }}
                    >
                      <Avatar
                        sx={{
                          width: 40,
                          height: 40,
                          backgroundColor: alpha(theme.palette.secondary.main, 0.15),
                          color: theme.palette.secondary.main,
                        }}
                      >
                        <CommentIcon />
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          Trello Comments
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {stats?.metrics?.notificationsSent?.trello || 0} sent today
                        </Typography>
                      </Box>
                      <Chip
                        label="Active"
                        size="small"
                        sx={{
                          backgroundColor: alpha(theme.palette.success.main, 0.15),
                          color: theme.palette.success.main,
                          fontWeight: 600,
                        }}
                      />
                    </Box>
                  </Stack>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;