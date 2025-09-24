import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Avatar,
  Box,
  Tooltip,
  Chip,
  InputBase,
  alpha,
  useTheme,
  Divider,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Menu as MenuIcon,
  Notifications as NotificationsIcon,
  AccountCircle as AccountCircleIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,

} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const drawerWidth = 280;

const StyledAppBar = styled(AppBar, {
  shouldForwardProp: (prop) => prop !== 'open',
})(({ theme, open }) => ({
  zIndex: theme.zIndex.drawer + 1,
  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.95)} 0%, ${alpha(theme.palette.secondary.main, 0.95)} 100%)`,
  backdropFilter: 'blur(20px)',
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
  boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
  transition: theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

const Search = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: theme.shape.borderRadius * 2,
  backgroundColor: alpha(theme.palette.common.white, 0.15),
  '&:hover': {
    backgroundColor: alpha(theme.palette.common.white, 0.25),
  },
  marginRight: theme.spacing(2),
  marginLeft: 0,
  width: '100%',
  [theme.breakpoints.up('sm')]: {
    marginLeft: theme.spacing(3),
    width: 'auto',
  },
}));

const SearchIconWrapper = styled('div')(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: '100%',
  position: 'absolute',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: 'inherit',
  '& .MuiInputBase-input': {
    padding: theme.spacing(1, 1, 1, 0),
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    transition: theme.transitions.create('width'),
    width: '100%',
    [theme.breakpoints.up('md')]: {
      width: '20ch',
    },
  },
}));

const Header = ({ open, toggleDrawer }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [notificationAnchorEl, setNotificationAnchorEl] = React.useState(null);
  const isMenuOpen = Boolean(anchorEl);
  const isNotificationOpen = Boolean(notificationAnchorEl);

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleNotificationMenuOpen = (event) => {
    setNotificationAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClose = () => {
    setNotificationAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    logout();
    navigate('/login');
  };

  const handleSettings = () => {
    handleMenuClose();
    navigate('/settings');
  };

  const handleProfile = () => {
    handleMenuClose();
    // Navigate to profile page when implemented
  };

  const menuId = 'primary-account-menu';
  const notificationMenuId = 'notification-menu';

  const renderMenu = (
    <Menu
      anchorEl={anchorEl}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      id={menuId}
      keepMounted
      transformOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
      open={isMenuOpen}
      onClose={handleMenuClose}
      PaperProps={{
        elevation: 0,
        sx: {
          overflow: 'visible',
          filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
          mt: 1.5,
          borderRadius: 2,
          minWidth: 200,
          '& .MuiAvatar-root': {
            width: 32,
            height: 32,
            ml: -0.5,
            mr: 1,
          },
          '&:before': {
            content: '""',
            display: 'block',
            position: 'absolute',
            top: 0,
            right: 14,
            width: 10,
            height: 10,
            bgcolor: 'background.paper',
            transform: 'translateY(-50%) rotate(45deg)',
            zIndex: 0,
          },
        },
      }}
    >
      <MenuItem onClick={handleProfile} sx={{ py: 1.5 }}>
        <ListItemIcon>
          <PersonIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Profile</ListItemText>
      </MenuItem>
      <MenuItem onClick={handleSettings} sx={{ py: 1.5 }}>
        <ListItemIcon>
          <SettingsIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Settings</ListItemText>
      </MenuItem>
      <Divider />
      <MenuItem onClick={handleLogout} sx={{ py: 1.5, color: 'error.main' }}>
        <ListItemIcon>
          <LogoutIcon fontSize="small" color="error" />
        </ListItemIcon>
        <ListItemText>Logout</ListItemText>
      </MenuItem>
    </Menu>
  );

  const renderNotificationMenu = (
    <Menu
      anchorEl={notificationAnchorEl}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      id={notificationMenuId}
      keepMounted
      transformOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
      open={isNotificationOpen}
      onClose={handleNotificationClose}
      PaperProps={{
        elevation: 0,
        sx: {
          overflow: 'visible',
          filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
          mt: 1.5,
          borderRadius: 2,
          minWidth: 320,
          maxHeight: 400,
          '&:before': {
            content: '""',
            display: 'block',
            position: 'absolute',
            top: 0,
            right: 14,
            width: 10,
            height: 10,
            bgcolor: 'background.paper',
            transform: 'translateY(-50%) rotate(45deg)',
            zIndex: 0,
          },
        },
      }}
    >
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Notifications
        </Typography>
      </Box>
      <MenuItem sx={{ py: 2 }}>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            New reminder sent
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Card "Project Review" reminder sent via email
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            2 minutes ago
          </Typography>
        </Box>
      </MenuItem>
      <MenuItem sx={{ py: 2 }}>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            Trello sync completed
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Successfully synced 15 cards from your boards
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            1 hour ago
          </Typography>
        </Box>
      </MenuItem>
      <Divider />
      <MenuItem onClick={() => navigate('/notifications')} sx={{ py: 1.5, justifyContent: 'center' }}>
        <Typography variant="body2" color="primary">
          View All Notifications
        </Typography>
      </MenuItem>
    </Menu>
  );

  return (
    <>
      <StyledAppBar position="absolute" open={open} elevation={0}>
        <Toolbar
          sx={{
            pr: 3,
            minHeight: 72,
          }}
        >
          <IconButton
            edge="start"
            color="inherit"
            aria-label="open drawer"
            onClick={toggleDrawer}
            sx={{
              marginRight: 4,
              ...(open && { display: 'none' }),
              '&:hover': {
                backgroundColor: alpha(theme.palette.common.white, 0.1),
              },
            }}
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            <Typography
              component="h1"
              variant="h5"
              color="inherit"
              noWrap
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(45deg, #ffffff 30%, #f8fafc 90%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mr: 4
              }}
            >
              AutoReminder
            </Typography>

            <Chip
              label="Pro"
              size="small"
              sx={{
                backgroundColor: alpha(theme.palette.warning.main, 0.2),
                color: theme.palette.warning.main,
                fontWeight: 600,
                fontSize: '0.75rem',
              }}
            />
          </Box>

          <Search>
            <SearchIconWrapper>
              <SearchIcon />
            </SearchIconWrapper>
            <StyledInputBase
              placeholder="Search cards, templates..."
              inputProps={{ 'aria-label': 'search' }}
            />
          </Search>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Notifications" arrow>
              <IconButton
                color="inherit"
                onClick={handleNotificationMenuOpen}
                sx={{
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.common.white, 0.1),
                  },
                }}
              >
                <Badge
                  badgeContent={3}
                  color="error"
                  sx={{
                    '& .MuiBadge-badge': {
                      backgroundColor: '#ef4444',
                      color: 'white',
                      fontWeight: 600,
                    }
                  }}
                >
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>

            <Tooltip title={`${user?.username || 'User'} - Click for menu`} arrow>
              <IconButton
                edge="end"
                aria-label="account of current user"
                aria-controls={menuId}
                aria-haspopup="true"
                onClick={handleProfileMenuOpen}
                color="inherit"
                sx={{
                  ml: 1,
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.common.white, 0.1),
                  },
                }}
              >
                {user?.username ? (
                  <Avatar
                    sx={{
                      width: 36,
                      height: 36,
                      bgcolor: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                      fontWeight: 600,
                      fontSize: '1rem',
                      border: '2px solid rgba(255, 255, 255, 0.2)',
                    }}
                  >
                    {user.username.charAt(0).toUpperCase()}
                  </Avatar>
                ) : (
                  <AccountCircleIcon sx={{ fontSize: 36 }} />
                )}
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </StyledAppBar>
      {renderMenu}
      {renderNotificationMenu}
    </>
  );
};

export default Header;