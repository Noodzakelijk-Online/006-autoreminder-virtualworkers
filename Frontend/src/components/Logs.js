import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Chip
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import FilterListIcon from '@mui/icons-material/FilterList';

import api from '../utils/api';

const Logs = () => {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    type: '',
    channel: '',
    status: '',
    startDate: '',
    endDate: new Date().toISOString().split('T')[0]
  });
  const [showFilters, setShowFilters] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);

      // Build query params
      const params = { page, limit: 20 };
      if (filters.type) params.type = filters.type;
      if (filters.channel) params.channel = filters.channel;
      if (filters.status) params.status = filters.status;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const response = await api.logs.getAll(params);

      // Handle response data structure
      if (response.success && response.data) {
        setLogs(response.data.logs || []);
        setTotalPages(response.data.pagination?.totalPages || 1);
      } else {
        // Fallback for different response structure
        setLogs(response.logs || []);
        setTotalPages(response.pagination?.totalPages || 1);
      }
      setError(null);
    } catch (err) {
      console.error('Error fetching logs:', err);
      setError(err.message || 'Error fetching logs');
      setLogs([]); // Ensure logs is always an array
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  const fetchLogStats = useCallback(async () => {
    try {
      const params = {};
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const response = await api.logs.getStats(params);

      // Handle response data structure
      if (response.success && response.data) {
        setStats(response.data);
      } else {
        setStats(response);
      }
    } catch (err) {
      console.error('Error fetching log stats:', err);
      setStats(null); // Ensure stats is null on error
    }
  }, [filters]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFilters({
      ...filters,
      [name]: value
    });
    setPage(1); // Reset to first page when filters change
  };

  const handleClearFilters = () => {
    setFilters({
      type: '',
      channel: '',
      status: '',
      startDate: '',
      endDate: new Date().toISOString().split('T')[0]
    });
    setPage(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchLogStats();
  }, [fetchLogs, fetchLogStats]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'reminder':
        return 'primary';
      case 'notification':
        return 'secondary';
      case 'system':
        return 'info';
      default:
        return 'default';
    }
  };

  if (loading && logs.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Activity Logs</Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<FilterListIcon />}
            onClick={() => setShowFilters(!showFilters)}
            sx={{ mr: 1 }}
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </Button>
          <IconButton onClick={() => { fetchLogs(); fetchLogStats(); }}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {showFilters && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel id="type-label">Type</InputLabel>
                <Select
                  labelId="type-label"
                  id="type"
                  name="type"
                  value={filters.type}
                  label="Type"
                  onChange={handleInputChange}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="reminder">Reminder</MenuItem>
                  <MenuItem value="notification">Notification</MenuItem>
                  <MenuItem value="system">System</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel id="channel-label">Channel</InputLabel>
                <Select
                  labelId="channel-label"
                  id="channel"
                  name="channel"
                  value={filters.channel}
                  label="Channel"
                  onChange={handleInputChange}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="trello">Trello</MenuItem>
                  <MenuItem value="email">Email</MenuItem>
                  <MenuItem value="sms">SMS</MenuItem>
                  <MenuItem value="whatsapp">WhatsApp</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel id="status-label">Status</InputLabel>
                <Select
                  labelId="status-label"
                  id="status"
                  name="status"
                  value={filters.status}
                  label="Status"
                  onChange={handleInputChange}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="success">Success</MenuItem>
                  <MenuItem value="error">Error</MenuItem>
                  <MenuItem value="warning">Warning</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                id="startDate"
                label="Start Date"
                name="startDate"
                type="date"
                value={filters.startDate}
                onChange={handleInputChange}
                InputLabelProps={{
                  shrink: true,
                }}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth
                id="endDate"
                label="End Date"
                name="endDate"
                type="date"
                value={filters.endDate}
                onChange={handleInputChange}
                InputLabelProps={{
                  shrink: true,
                }}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Button
                variant="outlined"
                onClick={handleClearFilters}
                fullWidth
              >
                Clear Filters
              </Button>
            </Grid>
          </Grid>
        </Paper>
      )}
      
      {stats && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Log Level Statistics
              </Typography>
              <Box sx={{ mt: 2 }}>
                {stats.levelStats && Object.entries(stats.levelStats).map(([level, count]) => (
                  <Box key={level} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                      {level}:
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {count}
                    </Typography>
                  </Box>
                ))}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                  <Typography variant="body2" fontWeight="bold">
                    Total Logs:
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {stats.totalLogs || 0}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Service Statistics
              </Typography>
              <Box sx={{ mt: 2 }}>
                {stats.serviceStats && Object.keys(stats.serviceStats).length > 0 ? (
                  Object.entries(stats.serviceStats).map(([service, count]) => (
                    <Box key={service} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">
                        {service}:
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {count}
                      </Typography>
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No service data available
                  </Typography>
                )}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}
      
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: 440 }}>
          <Table stickyHeader aria-label="logs table">
            <TableHead>
              <TableRow>
                <TableCell>Timestamp</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Channel</TableCell>
                <TableCell>Message</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>User/Card</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!logs || logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No logs found. Adjust filters or check back later.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log._id}>
                    <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
                    <TableCell>
                      <Chip 
                        label={log.type} 
                        color={getTypeColor(log.type)} 
                        size="small" 
                      />
                    </TableCell>
                    <TableCell>{log.channel || '-'}</TableCell>
                    <TableCell>{log.message}</TableCell>
                    <TableCell>
                      <Chip 
                        label={log.status} 
                        color={getStatusColor(log.status)} 
                        size="small" 
                      />
                    </TableCell>
                    <TableCell>
                      {log.userId ? `User: ${log.userId}` : ''}
                      {log.cardId ? `Card: ${log.cardId}` : ''}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        {/* Pagination */}
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
          <Button 
            disabled={page === 1} 
            onClick={() => handlePageChange(page - 1)}
            sx={{ mx: 1 }}
          >
            Previous
          </Button>
          <Typography sx={{ mx: 2, alignSelf: 'center' }}>
            Page {page} of {totalPages}
          </Typography>
          <Button 
            disabled={page === totalPages} 
            onClick={() => handlePageChange(page + 1)}
            sx={{ mx: 1 }}
          >
            Next
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default Logs;