import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  CircularProgress,
  Alert,
  Card,
  CardHeader,
  CardContent,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import RefreshIcon from '@mui/icons-material/Refresh';
import EmailIcon from '@mui/icons-material/Email';
import SmsIcon from '@mui/icons-material/Sms';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import CommentIcon from '@mui/icons-material/Comment';
import api from '../utils/api';

const Notifications = () => {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [stats, setStats] = useState(null);
  const [selectedCard, setSelectedCard] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [notificationForm, setNotificationForm] = useState({
    message: '',
    channels: ['email']
  });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchCards();
    fetchNotificationStatus();
  }, []);

  const fetchCards = async () => {
    try {
      setLoading(true);
      // In a real implementation, we would fetch cards from the API
      // For now, we'll use mock data
      const mockCards = [
        { id: 'card1', name: 'Website Redesign', assignedUsers: [{ username: 'john.doe', email: 'john@example.com' }] },
        { id: 'card2', name: 'Content Creation', assignedUsers: [{ username: 'jane.smith', email: 'jane@example.com' }] },
        { id: 'card3', name: 'SEO Optimization', assignedUsers: [{ username: 'bob.jones', email: 'bob@example.com' }] },
        { id: 'card4', name: 'Social Media Campaign', assignedUsers: [{ username: 'alice.wong', email: 'alice@example.com' }] },
      ];
      setCards(mockCards);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Error fetching cards');
    } finally {
      setLoading(false);
    }
  };

  const fetchNotificationStatus = async () => {
    try {
      const response = await api.notifications.getStatus();
      if (response.success && response.data) {
        setStats(response.data);
      } else {
        setStats(response);
      }
    } catch (err) {
      console.error('Error fetching notification status:', err);
      setStats(null);
    }
  };

  const handleOpenDialog = () => {
    if (!selectedCard) return;
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setNotificationForm({
      message: '',
      channels: ['email']
    });
  };

  const handleCardChange = (e) => {
    setSelectedCard(e.target.value);
  };

  const handleMessageChange = (e) => {
    setNotificationForm({
      ...notificationForm,
      message: e.target.value
    });
  };

  const handleChannelChange = (channel) => {
    const currentChannels = [...notificationForm.channels];
    const channelIndex = currentChannels.indexOf(channel);
    
    if (channelIndex === -1) {
      // Add channel
      currentChannels.push(channel);
    } else {
      // Remove channel
      currentChannels.splice(channelIndex, 1);
    }
    
    setNotificationForm({
      ...notificationForm,
      channels: currentChannels
    });
  };

  const handleSendNotification = async () => {
    if (!selectedCard || !notificationForm.message.trim() || notificationForm.channels.length === 0) return;

    try {
      setSending(true);

      // Send notification for each selected channel
      const promises = notificationForm.channels.map(async (channel) => {
        const selectedCardData = cards.find(card => card.id === selectedCard);

        // Determine recipient based on channel
        let recipient;
        switch (channel) {
          case 'email':
            recipient = 'test@example.com'; // In real app, get from user profile
            break;
          case 'sms':
            recipient = '+1234567890'; // In real app, get from user profile
            break;
          case 'whatsapp':
            recipient = '+1234567890'; // In real app, get from user profile
            break;
          default:
            throw new Error(`Unsupported channel: ${channel}`);
        }

        return await api.notifications.sendNotification({
          type: channel,
          recipient: recipient,
          subject: `Reminder: ${selectedCardData?.name || 'Card Update'}`,
          message: notificationForm.message,
          cardId: selectedCard
        });
      });

      await Promise.all(promises);

      setSuccess(`Notification sent successfully via ${notificationForm.channels.join(', ')}`);
      handleCloseDialog();

      // Refresh notification status
      fetchNotificationStatus();

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err) {
      setError(err.message || 'Error sending notification');
    } finally {
      setSending(false);
    }
  };

  if (loading && cards.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Notifications
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader title="Send Manual Notification" />
            <Divider />
            <CardContent>
              <FormControl fullWidth margin="normal">
                <InputLabel id="card-label">Select Card</InputLabel>
                <Select
                  labelId="card-label"
                  id="card"
                  value={selectedCard}
                  label="Select Card"
                  onChange={handleCardChange}
                >
                  <MenuItem value="">
                    <em>Select a card</em>
                  </MenuItem>
                  {cards.map((card) => (
                    <MenuItem key={card.id} value={card.id}>{card.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <Button
                variant="contained"
                color="primary"
                fullWidth
                onClick={handleOpenDialog}
                disabled={!selectedCard}
                sx={{ mt: 2 }}
              >
                Compose Notification
              </Button>
            </CardContent>
          </Card>
          
          <Card sx={{ mt: 3 }}>
            <CardHeader title="Notification Channels" />
            <Divider />
            <CardContent>
              <List>
                <ListItem>
                  <ListItemIcon>
                    <CommentIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Trello Comments"
                    secondary={`${stats?.byType?.trello || 0} sent`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <EmailIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Email Notifications"
                    secondary={`${stats?.byType?.email || 0} sent`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <SmsIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="SMS Messages"
                    secondary={`${stats?.byType?.sms || 0} sent`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <WhatsAppIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="WhatsApp Messages"
                    secondary={`${stats?.byType?.whatsapp || 0} sent`}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Notification Status
              </Typography>
              <IconButton onClick={() => { fetchCards(); fetchNotificationStatus(); }}>
                <RefreshIcon />
              </IconButton>
            </Box>
            <Divider sx={{ mb: 2 }} />
            
            {stats ? (
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4">{stats.total || 0}</Typography>
                    <Typography variant="body2" color="text.secondary">Total Notifications</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4">{stats.byStatus?.sent || 0}</Typography>
                    <Typography variant="body2" color="text.secondary">Successfully Sent</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4">{stats.byStatus?.failed || 0}</Typography>
                    <Typography variant="body2" color="text.secondary">Failed</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Paper sx={{ p: 2, textAlign: 'center' }}>
                    <Typography variant="h4">{stats.serviceHealth?.enabledChannels?.length || 0}</Typography>
                    <Typography variant="body2" color="text.secondary">Active Channels</Typography>
                  </Paper>
                </Grid>
                
                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom>
                    Service Health Status
                  </Typography>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Service</TableCell>
                          <TableCell align="center">Status</TableCell>
                          <TableCell align="center">Provider</TableCell>
                          <TableCell align="right">Notifications Sent</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {stats.serviceHealth?.services && Object.entries(stats.serviceHealth.services).map(([service, config]) => (
                          <TableRow key={service}>
                            <TableCell sx={{ textTransform: 'capitalize' }}>{service}</TableCell>
                            <TableCell align="center">
                              <Chip
                                label={config.enabled ? 'Enabled' : 'Disabled'}
                                color={config.enabled ? 'success' : 'default'}
                                size="small"
                              />
                            </TableCell>
                            <TableCell align="center" sx={{ textTransform: 'capitalize' }}>
                              {config.provider || 'N/A'}
                            </TableCell>
                            <TableCell align="right">{stats.byType?.[service] || 0}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
              </Grid>
            ) : (
              <Alert severity="info">
                No notification statistics available. Start sending reminders to see data here.
              </Alert>
            )}
          </Paper>
        </Grid>
      </Grid>
      
      {/* Notification Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          Compose Notification
          {selectedCard && (
            <Typography variant="subtitle2" color="text.secondary">
              Card: {cards.find(c => c.id === selectedCard)?.name}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Typography variant="subtitle1" gutterBottom sx={{ mt: 1 }}>
            Notification Channels
          </Typography>
          <FormGroup row>
            <FormControlLabel
              control={
                <Checkbox 
                  checked={notificationForm.channels.includes('email')} 
                  onChange={() => handleChannelChange('email')}
                />
              }
              label="Email"
            />
            <FormControlLabel
              control={
                <Checkbox 
                  checked={notificationForm.channels.includes('sms')} 
                  onChange={() => handleChannelChange('sms')}
                />
              }
              label="SMS"
            />
            <FormControlLabel
              control={
                <Checkbox 
                  checked={notificationForm.channels.includes('whatsapp')} 
                  onChange={() => handleChannelChange('whatsapp')}
                />
              }
              label="WhatsApp"
            />
            <FormControlLabel
              control={
                <Checkbox 
                  checked={notificationForm.channels.includes('trello')} 
                  onChange={() => handleChannelChange('trello')}
                />
              }
              label="Trello Comment"
            />
          </FormGroup>
          
          <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
            Message
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={4}
            value={notificationForm.message}
            onChange={handleMessageChange}
            placeholder="Enter your notification message here..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={handleSendNotification} 
            variant="contained" 
            startIcon={<SendIcon />}
            disabled={!notificationForm.message.trim() || notificationForm.channels.length === 0 || sending}
          >
            {sending ? <CircularProgress size={24} /> : 'Send Notification'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Notifications;
