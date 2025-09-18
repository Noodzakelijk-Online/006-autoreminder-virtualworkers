import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import Login from './components/auth/Login';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import Templates from './components/Templates';
import Reports from './components/Reports';
import Logs from './components/Logs';
import TrelloIntegration from './components/TrelloIntegration';
import Notifications from './components/Notifications';
import NotFound from './components/common/NotFound';
import LoadingScreen from './components/common/LoadingScreen';
import PrivateRoute from './components/auth/PrivateRoute';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Box sx={{ minHeight: '100vh', width: '100%' }}>
      <Routes>
        {/* Public routes */}
        <Route 
          path="/login" 
          element={!user ? <Login /> : <Navigate to="/dashboard" replace />} 
        />
        
        {/* Protected routes */}
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="settings" element={<Settings />} />
          <Route path="templates" element={<Templates />} />
          <Route path="reports" element={<Reports />} />
          <Route path="logs" element={<Logs />} />
          <Route path="trello" element={<TrelloIntegration />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>
        
        {/* Catch all route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Box>
  );
}

export default App;
