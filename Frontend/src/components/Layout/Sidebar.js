import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
  styled,
  Toolbar,
  Box,
  Typography,
  Avatar,
  Chip,
  useTheme,
  alpha,
  Tooltip
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  Dashboard as DashboardIcon,
  Settings as SettingsIcon,
  Description as TemplateIcon,
  Assessment as AssessmentIcon,
  ListAlt as ListAltIcon,
  ViewKanban as TrelloIcon,
  Notifications as NotificationsIcon,

  AutoAwesome as AutoAwesomeIcon,
  Speed as SpeedIcon
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';

const drawerWidth = 280;

const StyledDrawer = styled(Drawer, {
  shouldForwardProp: (prop) => prop !== 'open',
})(({ theme, open }) => ({
  '& .MuiDrawer-paper': {
    position: 'relative',
    whiteSpace: 'nowrap',
    width: drawerWidth,
    background: `linear-gradient(180deg, ${theme.palette.grey[50]} 0%, ${theme.palette.background.paper} 100%)`,
    borderRight: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
    boxSizing: 'border-box',
    ...(!open && {
      overflowX: 'hidden',
      transition: theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
      }),
      width: theme.spacing(7),
      [theme.breakpoints.up('sm')]: {
        width: theme.spacing(9),
      },
    }),
  },
}));

const StyledListItem = styled(ListItem)(({ theme, selected }) => ({
  borderRadius: 12,
  margin: '4px 12px',
  padding: '12px 16px',
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
    transform: 'translateX(4px)',
  },
  ...(selected && {
    backgroundColor: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)} 0%, ${alpha(theme.palette.secondary.main, 0.15)} 100%)`,
    border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
    '&:hover': {
      backgroundColor: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.2)} 0%, ${alpha(theme.palette.secondary.main, 0.2)} 100%)`,
    },
    '& .MuiListItemIcon-root': {
      color: theme.palette.primary.main,
    },
    '& .MuiListItemText-primary': {
      color: theme.palette.primary.main,
      fontWeight: 600,
    },
  }),
}));

const Sidebar = ({ open, toggleDrawer }) => {
  const location = useLocation();
  const { user } = useAuth();
  const theme = useTheme();

  const menuItems = [
    {
      text: 'Dashboard',
      icon: <DashboardIcon />,
      path: '/dashboard',
      badge: null,
      color: theme.palette.primary.main
    },
    {
      text: 'Templates',
      icon: <TemplateIcon />,
      path: '/templates',
      badge: '12',
      color: theme.palette.info.main
    },
    {
      text: 'Reports',
      icon: <AssessmentIcon />,
      path: '/reports',
      badge: null,
      color: theme.palette.success.main
    },
    {
      text: 'Activity Logs',
      icon: <ListAltIcon />,
      path: '/logs',
      badge: null,
      color: theme.palette.warning.main
    },
    {
      text: 'Notifications',
      icon: <NotificationsIcon />,
      path: '/notifications',
      badge: '3',
      color: theme.palette.error.main
    },
    {
      text: 'Trello Integration',
      icon: <TrelloIcon />,
      path: '/trello',
      badge: null,
      color: theme.palette.secondary.main
    },
    {
      text: 'Configuration',
      icon: <SettingsIcon />,
      path: '/settings',
      badge: null,
      color: theme.palette.grey[600]
    },
  ];

  return (
    <StyledDrawer variant="permanent" open={open}>
      <Toolbar
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 2,
          minHeight: 72,
        }}
      >
        {open && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              sx={{
                width: 40,
                height: 40,
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                fontWeight: 700,
              }}
            >
              AR
            </Avatar>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                {user?.username || 'User'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Administrator
              </Typography>
            </Box>
          </Box>
        )}
        <IconButton
          onClick={toggleDrawer}
          sx={{
            '&:hover': {
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
            },
          }}
        >
          <ChevronLeftIcon />
        </IconButton>
      </Toolbar>

      <Divider sx={{ mx: 2, opacity: 0.3 }} />

      {open && (
        <Box sx={{ px: 2, py: 2 }}>
          <Box
            sx={{
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)`,
              borderRadius: 2,
              p: 2,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <AutoAwesomeIcon sx={{ fontSize: 20, color: theme.palette.primary.main }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Quick Stats
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Active Cards
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                24
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="text.secondary">
                Reminders Sent
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                156
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      <List component="nav" sx={{ px: 1, flex: 1 }}>
        {menuItems.map((item) => {
          const isSelected = location.pathname === item.path ||
            (item.path === '/dashboard' && location.pathname === '/');

          return (
            <Tooltip
              key={item.text}
              title={!open ? item.text : ''}
              placement="right"
              arrow
            >
              <StyledListItem
                button
                component={Link}
                to={item.path}
                selected={isSelected}
              >
                <ListItemIcon sx={{ color: item.color, minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    fontWeight: isSelected ? 600 : 500,
                  }}
                />
                {item.badge && open && (
                  <Chip
                    label={item.badge}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: alpha(item.color, 0.15),
                      color: item.color,
                    }}
                  />
                )}
              </StyledListItem>
            </Tooltip>
          );
        })}
      </List>

      {open && (
        <Box sx={{ p: 2 }}>
          <Box
            sx={{
              background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.info.main, 0.1)} 100%)`,
              borderRadius: 2,
              p: 2,
              border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
              textAlign: 'center',
            }}
          >
            <SpeedIcon sx={{ fontSize: 32, color: theme.palette.success.main, mb: 1 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
              System Status
            </Typography>
            <Chip
              label="All Systems Operational"
              size="small"
              sx={{
                backgroundColor: alpha(theme.palette.success.main, 0.15),
                color: theme.palette.success.main,
                fontWeight: 600,
                fontSize: '0.75rem',
              }}
            />
          </Box>
        </Box>
      )}
    </StyledDrawer>
  );
};

export default Sidebar;