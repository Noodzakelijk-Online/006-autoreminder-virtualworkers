const express = require('express');
const router = express.Router();
const Template = require('../models/Template');
const { validationResult, body } = require('express-validator');
const { AppError, ValidationError } = require('../middleware/errorHandler');

// GET /api/templates - Get all templates for user
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const templates = await Template.find({ createdBy: userId }).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: templates,
      message: 'Templates retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/templates/:id - Get specific template
router.get('/:id', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const template = await Template.findOne({ _id: req.params.id, createdBy: userId });
    
    if (!template) {
      throw new AppError('Template not found', 404);
    }
    
    res.json({
      success: true,
      data: template,
      message: 'Template retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/templates - Create new template
router.post('/', [
  body('name').notEmpty().trim().isLength({ min: 1, max: 100 }),
  body('type').isIn(['email', 'sms', 'whatsapp', 'trello']),
  body('subject').optional().trim().isLength({ max: 200 }),
  body('content').notEmpty().trim().isLength({ min: 1, max: 2000 }),
  body('variables').optional().isArray(),
  body('isDefault').optional().isBoolean()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid template data', errors.array());
    }

    const userId = req.user.id;
    const templateData = { ...req.body, createdBy: userId };

    const template = new Template(templateData);
    await template.save();

    res.status(201).json({
      success: true,
      data: template,
      message: 'Template created successfully'
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      next(new ValidationError('Template validation failed', error.errors));
    } else {
      next(error);
    }
  }
});

// PUT /api/templates/:id - Update template
router.put('/:id', [
  body('name').optional().trim().isLength({ min: 1, max: 100 }),
  body('type').optional().isIn(['email', 'sms', 'whatsapp', 'trello']),
  body('subject').optional().trim().isLength({ max: 200 }),
  body('content').optional().trim().isLength({ min: 1, max: 2000 }),
  body('variables').optional().isArray(),
  body('isDefault').optional().isBoolean()
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid template data', errors.array());
    }

    const userId = req.user.id;
    const template = await Template.findOneAndUpdate(
      { _id: req.params.id, createdBy: userId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    res.json({
      success: true,
      data: template,
      message: 'Template updated successfully'
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      next(new ValidationError('Template validation failed', error.errors));
    } else {
      next(error);
    }
  }
});

// DELETE /api/templates/:id - Delete template
router.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const template = await Template.findOneAndDelete({ _id: req.params.id, createdBy: userId });

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
