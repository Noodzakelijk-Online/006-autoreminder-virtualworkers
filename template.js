const { validationResult } = require('express-validator');
const Template = require('../models/Template');
const logger = require('../utils/logger');

/**
 * Template Controller - Handles notification templates
 */
class TemplateController {
  /**
   * Get all templates
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getAllTemplates(req, res) {
    try {
      const templates = await Template.find({});
      res.json(templates);
    } catch (error) {
      logger.log('error', `Get templates error: ${error.message}`);
      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * Get template by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getTemplateById(req, res) {
    try {
      const template = await Template.findById(req.params.id);
      if (!template) {
        return res.status(404).json({ message: 'Template not found' });
      }
      res.json(template);
    } catch (error) {
      logger.log('error', `Get template error: ${error.message}`);
      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * Create new template
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async createTemplate(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, type, subject, content, variables } = req.body;

      // Create new template
      const template = new Template({
        name,
        type,
        subject,
        content,
        variables
      });

      // Save template to database
      await template.save();

      logger.log('info', `Template created: ${name}`);
      res.status(201).json(template);
    } catch (error) {
      logger.log('error', `Create template error: ${error.message}`);
      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * Update template
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateTemplate(req, res) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, type, subject, content, variables } = req.body;

      // Find template by ID
      let template = await Template.findById(req.params.id);
      if (!template) {
        return res.status(404).json({ message: 'Template not found' });
      }

      // Update template fields
      if (name) template.name = name;
      if (type) template.type = type;
      if (subject !== undefined) template.subject = subject;
      if (content) template.content = content;
      if (variables) template.variables = variables;

      // Save updated template
      await template.save();

      logger.log('info', `Template updated: ${template.name}`);
      res.json(template);
    } catch (error) {
      logger.log('error', `Update template error: ${error.message}`);
      res.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * Delete template
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async deleteTemplate(req, res) {
    try {
      // Find template by ID
      const template = await Template.findById(req.params.id);
      if (!template) {
        return res.status(404).json({ message: 'Template not found' });
      }

      // Delete template
      await template.remove();

      logger.log('info', `Template deleted: ${template.name}`);
      res.json({ message: 'Template deleted' });
    } catch (error) {
      logger.log('error', `Delete template error: ${error.message}`);
      res.status(500).json({ message: 'Server error' });
    }
  }
}

module.exports = new TemplateController();
