import React from 'react';
import { Box, Typography, Paper, Button } from '@mui/material';
import { Link } from 'react-router-dom';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

const NotFound = () => {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '80vh',
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 5,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: 500,
        }}
      >
        <ErrorOutlineIcon sx={{ fontSize: 100, color: 'error.main', mb: 2 }} />
        <Typography variant="h4" component="h1" gutterBottom>
          404 - Page Not Found
        </Typography>
        <Typography variant="body1" align="center" paragraph>
          The page you are looking for doesn't exist or has been moved.
        </Typography>
        <Button
          variant="contained"
          color="primary"
          component={Link}
          to="/"
          sx={{ mt: 2 }}
        >
          Return to Dashboard
        </Button>
      </Paper>
    </Box>
  );
};

export default NotFound;