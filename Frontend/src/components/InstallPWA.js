import React, { useState, useEffect } from 'react';
import { Button, Snackbar, Alert, IconButton } from '@mui/material';
import { Close as CloseIcon, GetApp as InstallIcon } from '@mui/icons-material';

const InstallPWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);
      // Show install button
      setShowInstallPrompt(true);
    };

    const handleAppInstalled = () => {
      console.log('[PWA] App successfully installed');
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] User response: ${outcome}`);

    // Clear the deferredPrompt for reuse
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleClose = () => {
    setShowInstallPrompt(false);
  };

  if (!showInstallPrompt) {
    return null;
  }

  return (
    <Snackbar
      open={showInstallPrompt}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      sx={{ bottom: { xs: 90, sm: 24 } }}
    >
      <Alert
        severity="info"
        variant="filled"
        action={
          <>
            <Button
              color="inherit"
              size="small"
              onClick={handleInstallClick}
              startIcon={<InstallIcon />}
              sx={{
                fontWeight: 600,
                mr: 1,
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                },
              }}
            >
              Install
            </Button>
            <IconButton
              size="small"
              aria-label="close"
              color="inherit"
              onClick={handleClose}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </>
        }
        sx={{
          width: '100%',
          maxWidth: 500,
          '& .MuiAlert-message': {
            display: 'flex',
            alignItems: 'center',
          },
        }}
      >
        Install AutoReminder for quick access and offline use!
      </Alert>
    </Snackbar>
  );
};

export default InstallPWA;
