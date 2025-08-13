const log = require('electron-log');
const { v4: uuidv4 } = require('uuid');
const { getLocalDatabase } = require('./database');

/**
 * Get all templates
 * @returns {Array} List of templates
 */
const getTemplates = () => {
  try {
    const db = getLocalDatabase();
    
    const templates = db.prepare('SELECT * FROM templates ORDER BY updated_at DESC').all();
    
    return templates;
  } catch (error) {
    log.error('Error getting templates:', error);
    throw error;
  }
};

/**
 * Get template by ID
 * @param {string} id - Template ID
 * @returns {Object} Template data
 */
const getTemplate = (id) => {
  try {
    const db = getLocalDatabase();
    
    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
    
    if (!template) {
      throw new Error(`Template not found: ${id}`);
    }
    
    return template;
  } catch (error) {
    log.error(`Error getting template ${id}:`, error);
    throw error;
  }
};

/**
 * Create template
 * @param {Object} templateData - Template data
 * @returns {Object} Created template
 */
const createTemplate = (templateData) => {
  try {
    const db = getLocalDatabase();
    
    const now = Date.now();
    const id = uuidv4();
    
    // Parse variables from content
    const variables = extractVariables(templateData.content);
    
    const template = {
      id,
      name: templateData.name,
      type: templateData.type,
      subject: templateData.subject || null,
      content: templateData.content,
      variables: JSON.stringify(variables),
      created_at: now,
      updated_at: now
    };
    
    db.prepare(`
      INSERT INTO templates (id, name, type, subject, content, variables, created_at, updated_at)
      VALUES (@id, @name, @type, @subject, @content, @variables, @created_at, @updated_at)
    `).run(template);
    
    return getTemplate(id);
  } catch (error) {
    log.error('Error creating template:', error);
    throw error;
  }
};

/**
 * Update template
 * @param {string} id - Template ID
 * @param {Object} templateData - Template data
 * @returns {Object} Updated template
 */
const updateTemplate = (id, templateData) => {
  try {
    const db = getLocalDatabase();
    
    // Check if template exists
    const existingTemplate = getTemplate(id);
    
    if (!existingTemplate) {
      throw new Error(`Template not found: ${id}`);
    }
    
    // Parse variables from content
    const variables = extractVariables(templateData.content);
    
    const template = {
      id,
      name: templateData.name || existingTemplate.name,
      type: templateData.type || existingTemplate.type,
      subject: templateData.subject || existingTemplate.subject,
      content: templateData.content || existingTemplate.content,
      variables: JSON.stringify(variables),
      updated_at: Date.now()
    };
    
    db.prepare(`
      UPDATE templates
      SET name = @name, type = @type, subject = @subject, content = @content, 
          variables = @variables, updated_at = @updated_at
      WHERE id = @id
    `).run(template);
    
    return getTemplate(id);
  } catch (error) {
    log.error(`Error updating template ${id}:`, error);
    throw error;
  }
};

/**
 * Delete template
 * @param {string} id - Template ID
 * @returns {boolean} Delete result
 */
const deleteTemplate = (id) => {
  try {
    const db = getLocalDatabase();
    
    // Check if template exists
    const existingTemplate = getTemplate(id);
    
    if (!existingTemplate) {
      throw new Error(`Template not found: ${id}`);
    }
    
    db.prepare('DELETE FROM templates WHERE id = ?').run(id);
    
    return true;
  } catch (error) {
    log.error(`Error deleting template ${id}:`, error);
    throw error;
  }
};

/**
 * Extract variables from template content
 * @param {string} content - Template content
 * @returns {Array} List of variables
 */
const extractVariables = (content) => {
  const regex = /{{([^}]+)}}/g;
  const variables = [];
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    variables.push(match[1]);
  }
  
  return [...new Set(variables)]; // Remove duplicates
};

/**
 * Apply template with variables
 * @param {Object} template - Template object
 * @param {Object} variables - Variables to replace
 * @returns {Object} Processed template
 */
const applyTemplate = (template, variables) => {
  try {
    let content = template.content;
    let subject = template.subject;
    
    // Replace variables in content
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      content = content.replace(regex, value);
      
      if (subject) {
        subject = subject.replace(regex, value);
      }
    });
    
    return {
      ...template,
      content,
      subject,
      processedAt: Date.now()
    };
  } catch (error) {
    log.error('Error applying template:', error);
    throw error;
  }
};

/**
 * Initialize default templates if none exist
 */
const initDefaultTemplates = () => {
  try {
    const db = getLocalDatabase();
    
    // Check if templates exist
    const count = db.prepare('SELECT COUNT(*) as count FROM templates').get().count;
    
    if (count === 0) {
      log.info('Creating default templates');
      
      // Email template
      createTemplate({
        name: 'Default Email Reminder',
        type: 'email',
        subject: 'Reminder: {{cardName}} is due soon',
        content: `
          <p>Hello {{username}},</p>
          <p>This is a reminder that your task <strong>{{cardName}}</strong> is due on {{dueDate}}.</p>
          <p>Please update the card or mark it as complete if you've finished the task.</p>
          <p>You can access the card here: <a href="{{cardUrl}}">{{cardName}}</a></p>
          <p>Thank you,<br>AutoReminder</p>
        `
      });
      
      // Trello template
      createTemplate({
        name: 'Default Trello Comment',
        type: 'trello',
        content: '@{{username}} This is a reminder that this card is due on {{dueDate}}. Please update or complete it.'
      });
      
      // SMS template
      createTemplate({
        name: 'Default SMS Reminder',
        type: 'sms',
        content: 'Hi {{username}}, your task "{{cardName}}" is due on {{dueDate}}. Please update it soon.'
      });
      
      // WhatsApp template
      createTemplate({
        name: 'Default WhatsApp Reminder',
        type: 'whatsapp',
        content: 'Hello {{username}}, this is a reminder that your task "{{cardName}}" is due on {{dueDate}}. Please update it soon.'
      });
      
      log.info('Default templates created');
    }
  } catch (error) {
    log.error('Error initializing default templates:', error);
  }
};

module.exports = {
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  applyTemplate,
  initDefaultTemplates
};
