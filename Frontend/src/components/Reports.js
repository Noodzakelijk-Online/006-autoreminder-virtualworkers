import React, { useState, useEffect } from 'react';
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
  Card,
  CardHeader,
  CardContent,
  Divider,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { api } from '../utils/api';

const Reports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [formData, setFormData] = useState({
    reportType: 'weekly',
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await api.reports.getAll();
      setReports(response.data.reports || []);
      setError(null);
    } catch (err) {
      if (err.message?.includes('token') || err.response?.status === 401) {
        // Token expired - redirect to login
        localStorage.clear();
        window.location.href = '/login';
        return;
      }
      setError(err.message || 'Error fetching reports');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleGenerateReport = async () => {
    try {
      setGenerating(true);
      const response = await api.reports.generate(formData);
      setReports([response.data, ...reports]);
      setSuccess(true);
      setError(null);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Error generating report');
      setSuccess(false);
    } finally {
      setGenerating(false);
    }
  };

  const handleViewReport = async (reportId) => {
    try {
      setLoading(true);
      const response = await api.reports.getById(reportId);
      setSelectedReport(response.data);
      setError(null);
    } catch (err) {
      setError(err.message || 'Error fetching report details');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = async (reportId) => {
    try {
      window.open(`/api/reports/download/${reportId}`, '_blank');
    } catch (err) {
      setError('Error downloading report');
    }
  };

  // Prepare data for notification chart
  const prepareNotificationData = (report) => {
    if (!report) return [];
    
    const { notificationsSent } = report.metrics;
    return [
      { name: 'Trello', value: notificationsSent.trello },
      { name: 'Email', value: notificationsSent.email },
      { name: 'SMS', value: notificationsSent.sms },
      { name: 'WhatsApp', value: notificationsSent.whatsapp }
    ];
  };

  // Prepare data for user metrics chart
  const prepareUserMetricsData = (report) => {
    if (!report || !report.userMetrics) return [];
    
    return report.userMetrics.map(user => ({
      name: user.username,
      notifications: user.notificationsReceived,
      responseRate: Math.round(user.responseRate * 100)
    }));
  };

  if (loading && reports.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Reports
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Report generated successfully!
        </Alert>
      )}
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader title="Generate New Report" />
            <Divider />
            <CardContent>
              <FormControl fullWidth margin="normal">
                <InputLabel id="report-type-label">Report Type</InputLabel>
                <Select
                  labelId="report-type-label"
                  id="reportType"
                  name="reportType"
                  value={formData.reportType}
                  label="Report Type"
                  onChange={handleInputChange}
                >
                  <MenuItem value="daily">Daily Report</MenuItem>
                  <MenuItem value="weekly">Weekly Report</MenuItem>
                </Select>
              </FormControl>
              
              <TextField
                margin="normal"
                fullWidth
                id="startDate"
                label="Start Date"
                name="startDate"
                type="date"
                value={formData.startDate}
                onChange={handleInputChange}
                InputLabelProps={{
                  shrink: true,
                }}
              />
              
              <TextField
                margin="normal"
                fullWidth
                id="endDate"
                label="End Date"
                name="endDate"
                type="date"
                value={formData.endDate}
                onChange={handleInputChange}
                InputLabelProps={{
                  shrink: true,
                }}
              />
              
              <Button
                variant="contained"
                color="primary"
                fullWidth
                onClick={handleGenerateReport}
                disabled={generating}
                sx={{ mt: 2 }}
              >
                {generating ? <CircularProgress size={24} /> : 'Generate Report'}
              </Button>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={8}>
          <Card>
            <CardHeader 
              title="Report History" 
              action={
                <IconButton onClick={fetchReports}>
                  <RefreshIcon />
                </IconButton>
              }
            />
            <Divider />
            <CardContent>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>Date Range</TableCell>
                      <TableCell>Generated</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reports.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          No reports found. Generate your first report!
                        </TableCell>
                      </TableRow>
                    ) : (
                      reports.map((report) => (
                        <TableRow key={report._id}>
                          <TableCell>{report.reportType}</TableCell>
                          <TableCell>
                            {new Date(report.startDate).toLocaleDateString()} - {new Date(report.endDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{new Date(report.generatedAt).toLocaleString()}</TableCell>
                          <TableCell>
                            <IconButton
                              color="primary"
                              onClick={() => handleViewReport(report._id)}
                            >
                              <VisibilityIcon />
                            </IconButton>
                            <IconButton
                              color="secondary"
                              onClick={() => handleDownloadReport(report._id)}
                            >
                              <DownloadIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {selectedReport && (
        <Box mt={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              {selectedReport.reportType.charAt(0).toUpperCase() + selectedReport.reportType.slice(1)} Report
            </Typography>
            <Typography variant="subtitle1" gutterBottom>
              {new Date(selectedReport.startDate).toLocaleDateString()} - {new Date(selectedReport.endDate).toLocaleDateString()}
            </Typography>
            
            <Grid container spacing={3} sx={{ mt: 2 }}>
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Summary
                  </Typography>
                  <Typography variant="body1">
                    Total Cards: {selectedReport.metrics.totalCards}
                  </Typography>
                  <Typography variant="body1">
                    Response Rate: {Math.round(selectedReport.metrics.responseRate * 100)}%
                  </Typography>
                  <Typography variant="body1">
                    Avg Response Time: {Math.round(selectedReport.metrics.avgResponseTime / (1000 * 60 * 60))} hours
                  </Typography>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={8}>
                <Paper sx={{ p: 2, height: 300 }}>
                  <Typography variant="h6" gutterBottom>
                    Notifications Sent
                  </Typography>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={prepareNotificationData(selectedReport)}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {prepareNotificationData(selectedReport).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>
              
              <Grid item xs={12}>
                <Paper sx={{ p: 2, height: 400 }}>
                  <Typography variant="h6" gutterBottom>
                    User Metrics
                  </Typography>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={prepareUserMetricsData(selectedReport)}
                      margin={{
                        top: 20,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                      <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="notifications" name="Notifications Received" fill="#8884d8" />
                      <Bar yAxisId="right" dataKey="responseRate" name="Response Rate (%)" fill="#82ca9d" />
                    </BarChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>
            </Grid>
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default Reports;