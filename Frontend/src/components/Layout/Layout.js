import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box, CssBaseline, Toolbar } from '@mui/material';
import Sidebar from '../Layout/Sidebar';
import Header from '../Layout/Header';

const Layout = () => {
  const [open, setOpen] = React.useState(true);
  
  const toggleDrawer = () => {
    setOpen(!open);
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <Header open={open} toggleDrawer={toggleDrawer} />
      <Sidebar open={open} toggleDrawer={toggleDrawer} />
      <Box
        component="main"
        sx={{
          backgroundColor: (theme) => theme.palette.background.default,
          flexGrow: 1,
          height: '100vh',
          overflow: 'auto',
          padding: 3,
          paddingTop: 12,
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '200px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(236, 72, 153, 0.05) 100%)',
            zIndex: -1,
          },
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
};

export default Layout;