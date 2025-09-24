import React, { useState, useEffect } from 'react';
import {
  Snackbar,
  Alert,
  AlertTitle,
  Button,
  Box,
  Typography
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

const UpdateNotification = ({ 
  open, 
  onClose, 
  title = 'Update Available',
  message = 'A new version is available. Please refresh to get the latest features.',
  severity = 'info',
  autoHideDuration = null,
  showRefreshButton = true
}) => {
  const [isOpen, setIsOpen] = useState(open);

  useEffect(() => {
    setIsOpen(open);
  }, [open]);

  const handleClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setIsOpen(false);
    if (onClose) {
      onClose();
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <Snackbar
      open={isOpen}
      autoHideDuration={autoHideDuration}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      sx={{ mt: 2 }}
    >
      <Alert
        onClose={handleClose}
        severity={severity}
        sx={{ 
          width: '100%',
          minWidth: 400,
          '& .MuiAlert-message': {
            width: '100%'
          }
        }}
        action={
          showRefreshButton && (
            <Button
              color="inherit"
              size="small"
              onClick={handleRefresh}
              startIcon={<RefreshIcon />}
              sx={{ ml: 1 }}
            >
              Refresh
            </Button>
          )
        }
      >
        <AlertTitle>{title}</AlertTitle>
        <Typography variant="body2">
          {message}
        </Typography>
      </Alert>
    </Snackbar>
  );
};

export default UpdateNotification;
