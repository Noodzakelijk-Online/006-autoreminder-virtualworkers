import React, { useState, useEffect, useCallback } from 'react';
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

  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SyncIcon from '@mui/icons-material/Sync';
import ViewListIcon from '@mui/icons-material/ViewList';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PersonIcon from '@mui/icons-material/Person';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LinkIcon from '@mui/icons-material/Link';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import api from '../utils/api';

const TrelloIntegration = () => {
  const [boards, setBoards] = useState([]);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [selectedBoard, setSelectedBoard] = useState('');
  const [listNames, setListNames] = useState('Doing,On-Hold');
  const [openCardDialog, setOpenCardDialog] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [credentialsValid, setCredentialsValid] = useState(null);
  const [validatingCredentials, setValidatingCredentials] = useState(false);
  const [warning, setWarning] = useState(null);

  const validateCredentials = useCallback(async () => {
    try {
      setValidatingCredentials(true);
      setError(null);
      setWarning(null);

      const response = await api.trello.validateCredentials();
      if (response.success && response.data.valid) {
        setCredentialsValid(true);
        setWarning(null);
      } else if (response.success && !response.data.valid) {
        setCredentialsValid(false);
        setWarning('Trello API credentials are invalid. Using mock data for development.');
      } else {
        setCredentialsValid(false);
        setWarning('Failed to validate Trello credentials. Using mock data for development.');
      }

      // Always fetch boards (will get mock data if credentials are invalid)
      fetchBoards();

    } catch (err) {
      setCredentialsValid(false);
      setWarning('Failed to validate Trello credentials. Using mock data for development.');
      console.error('Credentials validation error:', err);

      // Still try to fetch boards (will get mock data)
      fetchBoards();
    } finally {
      setValidatingCredentials(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchBoards = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.trello.getBoards();

      if (response.success && response.data.boards) {
        setBoards(response.data.boards);
        setError(null);
        setWarning(response.warning || null);

        // Select first board by default if available
        if (response.data.boards.length > 0 && !selectedBoard) {
          setSelectedBoard(response.data.boards[0].id);
        }
      } else {
        setBoards([]);
        setError('No boards found or invalid response format');
      }
    } catch (err) {
      setError(err.message || 'Error fetching Trello boards');
      setBoards([]);
      setWarning(null);
    } finally {
      setLoading(false);
    }
  }, [selectedBoard]);

  const fetchCards = useCallback(async () => {
    if (!selectedBoard) return;

    try {
      setLoading(true);
      const lists = listNames.split(',').map(name => name.trim());
      const response = await api.trello.getCards({
        boardId: selectedBoard,
        listNames: lists.join(',')
      });

      if (response.success && response.data.cards) {
        setCards(response.data.cards);
        setError(null);
        if (response.warning) {
          setWarning(response.warning);
        }
      } else {
        setCards([]);
        setError('No cards found or invalid response format');
      }
    } catch (err) {
      setError(err.message || 'Error fetching Trello cards');
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [selectedBoard, listNames]);

  const handleSyncCards = async () => {
    try {
      setSyncing(true);
      const response = await api.trello.syncCards();

      if (response.success && response.data.syncResults) {
        const { totalCards, newCards, updatedCards } = response.data.syncResults;
        setSuccess(`Successfully synced ${totalCards} cards (${newCards} new, ${updatedCards} updated)`);
        setError(null);

        // Clear success message after 3 seconds
        setTimeout(() => {
          setSuccess(false);
        }, 3000);

        // Refresh cards
        fetchCards();
      } else {
        setError('Sync completed but no results returned');
      }
    } catch (err) {
      setError(err.message || 'Error syncing Trello cards');
      setSuccess(false);
    } finally {
      setSyncing(false);
    }
  };

  const handleBoardChange = (e) => {
    setSelectedBoard(e.target.value);
  };

  const handleListNamesChange = (e) => {
    setListNames(e.target.value);
  };

  const handleOpenCardDialog = (card) => {
    setSelectedCard(card);
    setOpenCardDialog(true);
  };

  const handleCloseCardDialog = () => {
    setOpenCardDialog(false);
    setSelectedCard(null);
    setCommentText('');
  };

  const handleCommentTextChange = (e) => {
    setCommentText(e.target.value);
  };

  const handleSendComment = async () => {
    if (!commentText.trim()) return;

    try {
      setSendingComment(true);
      await api.trello.postComment(selectedCard.id, {
        text: commentText
      });
      setSuccess('Comment posted successfully');
      handleCloseCardDialog();
    } catch (err) {
      setError(err.message || 'Error posting comment');
    } finally {
      setSendingComment(false);
    }
  };

  useEffect(() => {
    validateCredentials();
  }, [validateCredentials]);

  useEffect(() => {
    if (selectedBoard) {
      fetchCards();
    }
  }, [selectedBoard, listNames, fetchCards]);

  const getCardStatusColor = (card) => {
    if (card.due && new Date(card.due) < new Date()) {
      return 'error';
    }
    if (card.due && new Date(card.due) < new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)) {
      return 'warning';
    }
    return 'success';
  };

  if (loading && boards.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Show loading screen while validating credentials
  if (validatingCredentials) {
    return (
      <Box>
        <Typography variant="h4" sx={{ mb: 3 }}>Trello Integration</Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
          <CircularProgress />
          <Typography variant="body1" sx={{ ml: 2 }}>
            Validating Trello credentials...
          </Typography>
        </Box>
      </Box>
    );
  }



  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Trello Integration</Typography>
        <Box>
          <Button
            variant="contained"
            color="primary"
            startIcon={<SyncIcon />}
            onClick={handleSyncCards}
            disabled={syncing}
            sx={{ mr: 1 }}
          >
            {syncing ? <CircularProgress size={24} /> : 'Sync Cards'}
          </Button>
          <IconButton onClick={validateCredentials} title="Refresh & Validate">
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {warning && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {warning}
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
            <CardHeader title="Trello Settings" />
            <Divider />
            <CardContent>
              <FormControl fullWidth margin="normal">
                <InputLabel id="board-label">Select Board</InputLabel>
                <Select
                  labelId="board-label"
                  id="board"
                  value={selectedBoard}
                  label="Select Board"
                  onChange={handleBoardChange}
                >
                  {boards.map((board) => (
                    <MenuItem key={board.id} value={board.id}>{board.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <TextField
                margin="normal"
                fullWidth
                id="listNames"
                label="List Names (comma-separated)"
                value={listNames}
                onChange={handleListNamesChange}
                helperText="Enter the names of lists to monitor"
              />
              
              <Button
                variant="outlined"
                color="primary"
                fullWidth
                onClick={fetchCards}
                sx={{ mt: 2 }}
              >
                Apply Filters
              </Button>
            </CardContent>
          </Card>
          
          <Card sx={{ mt: 3 }}>
            <CardHeader title="Integration Status" />
            <Divider />
            <CardContent>
              <List>
                <ListItem>
                  <ListItemIcon>
                    {credentialsValid ? (
                      <CheckCircleIcon sx={{ color: 'success.main' }} />
                    ) : (
                      <WarningIcon sx={{ color: 'warning.main' }} />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary="API Credentials"
                    secondary={credentialsValid ? 'Valid' : 'Invalid (using mock data)'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <ViewListIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Boards Available"
                    secondary={boards.length}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <DashboardIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Cards Loaded"
                    secondary={cards.length}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CalendarTodayIcon />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Last Sync" 
                    secondary={new Date().toLocaleString()} 
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Cards from {boards.find(b => b.id === selectedBoard)?.name || 'Selected Board'}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                <CircularProgress />
              </Box>
            ) : cards.length === 0 ? (
              <Alert severity="info">
                No cards found in the selected lists. Try changing the list names or select a different board.
              </Alert>
            ) : (
              <Grid container spacing={2}>
                {cards.map((card) => (
                  <Grid item xs={12} key={card.id}>
                    <Paper 
                      sx={{ 
                        p: 2, 
                        display: 'flex', 
                        flexDirection: { xs: 'column', sm: 'row' },
                        justifyContent: 'space-between',
                        alignItems: { xs: 'flex-start', sm: 'center' },
                        borderLeft: 4,
                        borderColor: `${getCardStatusColor(card)}.main`
                      }}
                    >
                      <Box sx={{ mb: { xs: 2, sm: 0 } }}>
                        <Typography variant="h6" component="div">
                          {card.name}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                          <PersonIcon fontSize="small" sx={{ mr: 1 }} />
                          <Typography variant="body2" color="text.secondary">
                            {card.members?.map(m => m.fullName).join(', ') || 'Unassigned'}
                          </Typography>
                        </Box>
                        {card.due && (
                          <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                            <CalendarTodayIcon fontSize="small" sx={{ mr: 1 }} />
                            <Typography variant="body2" color="text.secondary">
                              Due: {new Date(card.due).toLocaleString()}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                      
                      <Box>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<LinkIcon />}
                          href={card.url}
                          target="_blank"
                          sx={{ mr: 1 }}
                        >
                          Open
                        </Button>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => handleOpenCardDialog(card)}
                        >
                          Comment
                        </Button>
                      </Box>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            )}
          </Paper>
        </Grid>
      </Grid>
      
      {/* Card Dialog */}
      <Dialog open={openCardDialog} onClose={handleCloseCardDialog} maxWidth="md" fullWidth>
        {selectedCard && (
          <>
            <DialogTitle>
              {selectedCard.name}
              {selectedCard.due && (
                <Typography variant="subtitle2" color="text.secondary">
                  Due: {new Date(selectedCard.due).toLocaleString()}
                </Typography>
              )}
            </DialogTitle>
            <DialogContent>
              <Typography variant="body1" gutterBottom>
                {selectedCard.desc || 'No description provided.'}
              </Typography>
              
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Post a Comment
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  value={commentText}
                  onChange={handleCommentTextChange}
                  placeholder="Enter your comment here..."
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseCardDialog}>Cancel</Button>
              <Button 
                onClick={handleSendComment} 
                variant="contained" 
                disabled={!commentText.trim() || sendingComment}
              >
                {sendingComment ? <CircularProgress size={24} /> : 'Send Comment'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default TrelloIntegration;
