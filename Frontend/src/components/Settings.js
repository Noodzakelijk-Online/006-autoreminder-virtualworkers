import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Alert,
  Snackbar,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SaveIcon from '@mui/icons-material/Save';
import TestIcon from '@mui/icons-material/PlayArrow';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { api } from '../utils/api';
import { errorHandler } from '../utils/errorHandler';

const Settings = () => {
  // State management
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState({});
  const [config, setConfig] = useState(null);
  const [originalConfig, setOriginalConfig] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
  const [testResults, setTestResults] = useState({});
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null });

  /**
   * Load configuration with error handling
   */
  const loadConfiguration = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.config.get();
      const configData = response.data;
      
      setConfig(configData);
      setOriginalConfig(JSON.parse(JSON.stringify(configData))); // Deep copy
      setHasChanges(false);
      setValidationErrors({});
      
    } catch (error) {
      const processedError = errorHandler.processError(error, { 
        component: 'Settings',
        action: 'load_configuration'
      });
      
      showNotification({
        message: processedError.message,
        severity: 'error'
      });
      
      // If authentication error, redirect to login
      if (processedError.action === 'login') {
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      }
      
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Save configuration with validation and error handling
   */
  const saveConfiguration = async () => {
    try {
      // Validate configuration before saving
      const validation = validateConfiguration(config);
      if (!validation.isValid) {
        setValidationErrors(validation.errors);
        showNotification({
          message: 'Please fix validation errors before saving.',
          severity: 'error'
        });
        return;
      }

      setSaving(true);
      setValidationErrors({});
      
      await api.config.update(config);
      
      setOriginalConfig(JSON.parse(JSON.stringify(config))); // Deep copy
      setHasChanges(false);
      
      showNotification({
        message: 'Configuration saved successfully!',
        severity: 'success'
      });
      
    } catch (error) {
      const processedError = errorHandler.processError(error, { 
        component: 'Settings',
        action: 'save_configuration'
      });
      
      showNotification({
        message: processedError.message,
        severity: 'error'
      });
      
      // Handle specific validation errors from server
      if (processedError.type === 'VALIDATION_ERROR' && error.response?.data?.error?.details) {
        const serverErrors = {};
        error.response.data.error.details.forEach(detail => {
          if (detail.path) {
            serverErrors[detail.path] = detail.message;
          }
        });
        setValidationErrors(serverErrors);
      }
      
    } finally {
      setSaving(false);
    }
  };

  /**
   * Test notification service
   */
  const testNotificationService = async (service) => {
    try {
      setTesting({ ...testing, [service]: true });
      
      const testData = getTestData(service);
      const response = await api.notifications.test(service, testData);
      
      setTestResults({
        ...testResults,
        [service]: {
          success: true,
          message: response.message || 'Test successful',
          timestamp: new Date()
        }
      });
      
      showNotification({
        message: `${service.charAt(0).toUpperCase() + service.slice(1)} test successful!`,
        severity: 'success'
      });
      
    } catch (error) {
      const processedError = errorHandler.processError(error, { 
        component: 'Settings',
        action: 'test_notification_service',
        service
      });
      
      setTestResults({
        ...testResults,
        [service]: {
          success: false,
          message: processedError.message,
          timestamp: new Date()
        }
      });
      
      showNotification({
        message: `${service.charAt(0).toUpperCase() + service.slice(1)} test failed: ${processedError.message}`,
        severity: 'error'
      });
      
    } finally {
      setTesting({ ...testing, [service]: false });
    }
  };

  /**
   * Get test data for different services
   */
  const getTestData = (service) => {
    switch (service) {
      case 'email':
        return {
          recipient: config.notifications.email.testEmail || 'test@example.com'
        };
      case 'sms':
        return {
          recipient: config.notifications.sms.testPhone || '+1234567890'
        };
      case 'whatsapp':
        return {
          recipient: config.notifications.whatsapp.testPhone || '+1234567890'
        };
      case 'trello':
        return {
          cardId: config.trello.testCardId || 'test-card-id',
          memberIds: []
        };
      default:
        return {};
    }
  };

  /**
   * Validate configuration
   */
  const validateConfiguration = (configData) => {
    const errors = {};
    let isValid = true;

    // Validate Trello configuration
    if (!configData.trello.apiKey || configData.trello.apiKey.trim() === '') {
      errors['trello.apiKey'] = 'Trello API Key is required';
      isValid = false;
    }
    
    if (!configData.trello.token || configData.trello.token.trim() === '') {
      errors['trello.token'] = 'Trello Token is required';
      isValid = false;
    }

    // Validate email configuration if enabled
    if (configData.notifications.email.enabled) {
      if (!configData.notifications.email.fromEmail || !isValidEmail(configData.notifications.email.fromEmail)) {
        errors['notifications.email.fromEmail'] = 'Valid from email is required';
        isValid = false;
      }
      
      if (!configData.notifications.email.fromName || configData.notifications.email.fromName.trim() === '') {
        errors['notifications.email.fromName'] = 'From name is required';
        isValid = false;
      }
    }

  // Validate monitoring intervals
    if (configData.monitoring && (configData.monitoring.intervalMinutes < 5 || configData.monitoring.intervalMinutes > 1440)) {
      errors['monitoring.intervalMinutes'] = 'Monitoring interval must be between 5 and 1440 minutes';
      isValid = false;
    }

    return { isValid, errors };
  };

  /**
   * Validate email format
   */
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  /**
   * Handle configuration changes
   */
  const handleConfigChange = (path, value) => {
    const newConfig = { ...config };
    const pathArray = path.split('.');
    let current = newConfig;
    
    for (let i = 0; i < pathArray.length - 1; i++) {
      current = current[pathArray[i]];
    }
    
    current[pathArray[pathArray.length - 1]] = value;
    
    setConfig(newConfig);
    setHasChanges(JSON.stringify(newConfig) !== JSON.stringify(originalConfig));
    
    // Clear validation error for this field
    if (validationErrors[path]) {
      const newErrors = { ...validationErrors };
      delete newErrors[path];
      setValidationErrors(newErrors);
    }
  };

  /**
   * Show notification helper
   */
  const showNotification = ({ message, severity = 'info' }) => {
    setNotification({ open: true, message, severity });
  };

  /**
   * Reset configuration to original values
   */
  const resetConfiguration = () => {
    setConfirmDialog({
      open: true,
      title: 'Reset Configuration',
      message: 'Are you sure you want to reset all changes? This will discard any unsaved modifications.',
      onConfirm: () => {
        setConfig(JSON.parse(JSON.stringify(originalConfig)));
        setHasChanges(false);
        setValidationErrors({});
        setConfirmDialog({ open: false });
        showNotification({
          message: 'Configuration reset to saved values.',
          severity: 'info'
        });
      }
    });
  };

  /**
   * Get status color for test results
   */
  const getTestStatusColor = (service) => {
    const result = testResults[service];
    if (!result) return 'default';
    return result.success ? 'success' : 'error';
  };

  /**
   * Get status icon for test results
   */
  const getTestStatusIcon = (service) => {
    const result = testResults[service];
    if (!result) return null;
    return result.success ? <CheckCircleIcon /> : <ErrorIcon />;
  };

  // Load configuration on component mount
  useEffect(() => {
    loadConfiguration();
  }, [loadConfiguration]);

  // Show loading state
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Loading configuration...
        </Typography>
      </Box>
    );
  }

  // Show error state if config failed to load
  if (!config) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
        <Alert severity="error">
          Failed to load configuration. Please refresh the page or contact support.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Settings
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          {hasChanges && (
            <Button
              variant="outlined"
              onClick={resetConfiguration}
              disabled={saving}
            >
              Reset
            </Button>
          )}
          
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={saveConfiguration}
            disabled={!hasChanges || saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>
      </Box>

      {/* Changes indicator */}
      {hasChanges && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <WarningIcon sx={{ mr: 1 }} />
            You have unsaved changes. Don't forget to save your configuration.
          </Box>
        </Alert>
      )}

      {/* Configuration Sections */}
      <Grid container spacing={3}>
        {/* Trello Configuration */}
        <Grid item xs={12}>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Trello Integration</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="API Key"
                    value={config.trello.apiKey || ''}
                    onChange={(e) => handleConfigChange('trello.apiKey', e.target.value)}
                    error={!!validationErrors['trello.apiKey']}
                    helperText={validationErrors['trello.apiKey'] || 'Your Trello API key'}
                    type="password"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Token"
                    value={config.trello.token || ''}
                    onChange={(e) => handleConfigChange('trello.token', e.target.value)}
                    error={!!validationErrors['trello.token']}
                    helperText={validationErrors['trello.token'] || 'Your Trello token'}
                    type="password"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Button
                      variant="outlined"
                      startIcon={<TestIcon />}
                      onClick={() => testNotificationService('trello')}
                      disabled={testing.trello}
                    >
                      {testing.trello ? 'Testing...' : 'Test Connection'}
                    </Button>
                    
                    {testResults.trello && (
                      <Chip
                        icon={getTestStatusIcon('trello')}
                        label={testResults.trello.message}
                        color={getTestStatusColor('trello')}
                        size="small"
                      />
                    )}
                  </Box>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Grid>

        {/* Email Notifications */}
        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Email Notifications</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.notifications.email.enabled}
                        onChange={(e) => handleConfigChange('notifications.email.enabled', e.target.checked)}
                      />
                    }
                    label="Enable Email Notifications"
                  />
                </Grid>
                
                {config.notifications.email.enabled && (
                  <>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="From Email"
                        value={config.notifications.email.fromEmail || ''}
                        onChange={(e) => handleConfigChange('notifications.email.fromEmail', e.target.value)}
                        error={!!validationErrors['notifications.email.fromEmail']}
                        helperText={validationErrors['notifications.email.fromEmail'] || 'Email address to send from'}
                        type="email"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="From Name"
                        value={config.notifications.email.fromName || ''}
                        onChange={(e) => handleConfigChange('notifications.email.fromName', e.target.value)}
                        error={!!validationErrors['notifications.email.fromName']}
                        helperText={validationErrors['notifications.email.fromName'] || 'Display name for emails'}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Test Email"
                        value={config.notifications.email.testEmail || ''}
                        onChange={(e) => handleConfigChange('notifications.email.testEmail', e.target.value)}
                        helperText="Email address for testing"
                        type="email"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Button
                          variant="outlined"
                          startIcon={<TestIcon />}
                          onClick={() => testNotificationService('email')}
                          disabled={testing.email}
                        >
                          {testing.email ? 'Testing...' : 'Send Test Email'}
                        </Button>
                        
                        {testResults.email && (
                          <Chip
                            icon={getTestStatusIcon('email')}
                            label={testResults.email.message}
                            color={getTestStatusColor('email')}
                            size="small"
                          />
                        )}
                      </Box>
                    </Grid>
                  </>
                )}
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Grid>

        {/* SMS Notifications */}
        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">SMS Notifications</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.notifications.sms.enabled}
                        onChange={(e) => handleConfigChange('notifications.sms.enabled', e.target.checked)}
                      />
                    }
                    label="Enable SMS Notifications"
                  />
                </Grid>
                
                {config.notifications.sms.enabled && (
                  <>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Test Phone Number"
                        value={config.notifications.sms.testPhone || ''}
                        onChange={(e) => handleConfigChange('notifications.sms.testPhone', e.target.value)}
                        helperText="Phone number for testing (include country code)"
                        placeholder="+1234567890"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Button
                          variant="outlined"
                          startIcon={<TestIcon />}
                          onClick={() => testNotificationService('sms')}
                          disabled={testing.sms}
                        >
                          {testing.sms ? 'Testing...' : 'Send Test SMS'}
                        </Button>
                        
                        {testResults.sms && (
                          <Chip
                            icon={getTestStatusIcon('sms')}
                            label={testResults.sms.message}
                            color={getTestStatusColor('sms')}
                            size="small"
                          />
                        )}
                      </Box>
                    </Grid>
                  </>
                )}
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Grid>

        {/* WhatsApp Notifications */}
        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">WhatsApp Notifications</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.notifications.whatsapp.enabled}
                        onChange={(e) => handleConfigChange('notifications.whatsapp.enabled', e.target.checked)}
                      />
                    }
                    label="Enable WhatsApp Notifications"
                  />
                </Grid>
                
                {config.notifications.whatsapp.enabled && (
                  <>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Test Phone Number"
                        value={config.notifications.whatsapp.testPhone || ''}
                        onChange={(e) => handleConfigChange('notifications.whatsapp.testPhone', e.target.value)}
                        helperText="WhatsApp number for testing (include country code)"
                        placeholder="+1234567890"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Button
                          variant="outlined"
                          startIcon={<TestIcon />}
                          onClick={() => testNotificationService('whatsapp')}
                          disabled={testing.whatsapp}
                        >
                          {testing.whatsapp ? 'Testing...' : 'Send Test WhatsApp'}
                        </Button>
                        
                        {testResults.whatsapp && (
                          <Chip
                            icon={getTestStatusIcon('whatsapp')}
                            label={testResults.whatsapp.message}
                            color={getTestStatusColor('whatsapp')}
                            size="small"
                          />
                        )}
                      </Box>
                    </Grid>
                  </>
                )}
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Grid>

        {/* Monitoring Configuration */}
        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Monitoring Settings</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Monitoring Interval (minutes)"
                    type="number"
                    value={config.monitoring?.intervalMinutes || 30}
                    onChange={(e) => handleConfigChange('monitoring.intervalMinutes', parseInt(e.target.value))}
                    error={!!validationErrors['monitoring.intervalMinutes']}
                    helperText={validationErrors['monitoring.intervalMinutes'] || 'How often to check for updates (5-1440 minutes)'}
                    inputProps={{ min: 5, max: 1440 }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.monitoring?.autoStart || false}
                        onChange={(e) => handleConfigChange('monitoring.autoStart', e.target.checked)}
                      />
                    }
                    label="Auto-start monitoring on server startup"
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Grid>
      </Grid>

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

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}
      >
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <Typography>{confirmDialog.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>
            Cancel
          </Button>
          <Button onClick={confirmDialog.onConfirm} color="primary" autoFocus>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Settings;
