import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { api } from '../utils/api';

const Templates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState({
    name: '',
    type: 'email',
    subject: '',
    content: '',
    variables: []
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await api.templates.getAll();
      setTemplates(response.data);
      setError(null);
    } catch (err) {
      console.error('Template fetch error:', err);
      setError(err.response?.data?.message || 'Error fetching templates');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (template = null) => {
    if (template) {
      setCurrentTemplate(template);
      setEditMode(true);
    } else {
      setCurrentTemplate({
        name: '',
        type: 'email',
        subject: '',
        content: '',
        variables: []
      });
      setEditMode(false);
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCurrentTemplate({
      ...currentTemplate,
      [name]: value
    });
  };

  const handleVariablesChange = (e) => {
    const variables = e.target.value.split(',').map(v => v.trim());
    setCurrentTemplate({
      ...currentTemplate,
      variables
    });
  };

  const handleSaveTemplate = async () => {
    try {
      setLoading(true);
      
      if (editMode) {
        await api.templates.update(currentTemplate._id, currentTemplate);
      } else {
        await api.templates.create(currentTemplate);
      }
      
      fetchTemplates();
      handleCloseDialog();
    } catch (err) {
      console.error('Template save error:', err);
      setError(err.message || 'Error saving template');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      try {
        setLoading(true);
        await api.templates.delete(id);
        fetchTemplates();
      } catch (err) {
        console.error('Template delete error:', err);
        setError(err.message || 'Error deleting template');
      } finally {
        setLoading(false);
      }
    }
  };

  if (loading && templates.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Notification Templates</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Template
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: 440 }}>
          <Table stickyHeader aria-label="templates table">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Content Preview</TableCell>
                <TableCell>Variables</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No templates found. Create your first template!
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((template) => (
                  <TableRow key={template._id}>
                    <TableCell>{template.name}</TableCell>
                    <TableCell>{template.type}</TableCell>
                    <TableCell>{template.subject || '-'}</TableCell>
                    <TableCell>{template.content.substring(0, 50)}...</TableCell>
                    <TableCell>{template.variables.join(', ')}</TableCell>
                    <TableCell>
                      <IconButton
                        color="primary"
                        onClick={() => handleOpenDialog(template)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        color="error"
                        onClick={() => handleDeleteTemplate(template._id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Template Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editMode ? 'Edit Template' : 'Create Template'}</DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ mt: 1 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="name"
              label="Template Name"
              name="name"
              value={currentTemplate.name}
              onChange={handleInputChange}
            />
            
            <FormControl fullWidth margin="normal">
              <InputLabel id="type-label">Template Type</InputLabel>
              <Select
                labelId="type-label"
                id="type"
                name="type"
                value={currentTemplate.type}
                label="Template Type"
                onChange={handleInputChange}
              >
                <MenuItem value="trello">Trello Comment</MenuItem>
                <MenuItem value="email">Email</MenuItem>
                <MenuItem value="sms">SMS</MenuItem>
                <MenuItem value="whatsapp">WhatsApp</MenuItem>
              </Select>
            </FormControl>
            
            {currentTemplate.type === 'email' && (
              <TextField
                margin="normal"
                required
                fullWidth
                id="subject"
                label="Email Subject"
                name="subject"
                value={currentTemplate.subject || ''}
                onChange={handleInputChange}
              />
            )}
            
            <TextField
              margin="normal"
              required
              fullWidth
              id="content"
              label="Template Content"
              name="content"
              multiline
              rows={6}
              value={currentTemplate.content}
              onChange={handleInputChange}
              helperText="Use {{variable}} syntax for dynamic content"
            />
            
            <TextField
              margin="normal"
              fullWidth
              id="variables"
              label="Variables (comma-separated)"
              name="variables"
              value={currentTemplate.variables.join(', ')}
              onChange={handleVariablesChange}
              helperText="e.g., username, cardName, cardUrl"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={handleSaveTemplate} 
            variant="contained" 
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Templates;