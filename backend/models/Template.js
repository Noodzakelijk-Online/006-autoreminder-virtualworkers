const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  type: {
    type: String,
    required: true,
    enum: ['trello', 'email', 'sms', 'whatsapp'],
    index: true
  },
  subject: {
    type: String,
    trim: true,
    maxlength: 200,
    // Required only for email templates
    required: function() {
      return this.type === 'email';
    }
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  variables: [{
    type: String,
    trim: true
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastUsed: {
    type: Date
  },
  usageCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Ensure only one default template per type
templateSchema.index({ type: 1, isDefault: 1 }, { 
  unique: true, 
  partialFilterExpression: { isDefault: true } 
});

// Method to get available variables for template type
templateSchema.statics.getAvailableVariables = function(type) {
  const commonVariables = [
    '{{username}}',
    '{{cardName}}',
    '{{cardUrl}}',
    '{{dueDate}}',
    '{{currentDate}}',
    '{{daysSinceLastUpdate}}'
  ];
  
  const typeSpecificVariables = {
    trello: ['{{memberMention}}'],
    email: ['{{unsubscribeUrl}}', '{{companyName}}'],
    sms: [],
    whatsapp: ['{{companyName}}']
  };
  
  return [...commonVariables, ...(typeSpecificVariables[type] || [])];
};

// Method to validate template content
templateSchema.methods.validateContent = function() {
  const availableVars = this.constructor.getAvailableVariables(this.type);
  const usedVars = this.content.match(/\{\{[^}]+\}\}/g) || [];
  
  const invalidVars = usedVars.filter(variable => 
    !availableVars.includes(variable)
  );
  
  if (invalidVars.length > 0) {
    throw new Error(`Invalid variables found: ${invalidVars.join(', ')}`);
  }
  
  return true;
};

// Method to render template with data
templateSchema.methods.render = function(data) {
  let rendered = this.content;
  
  // Replace variables with actual data
  Object.keys(data).forEach(key => {
    const variable = `{{${key}}}`;
    const value = data[key] || '';
    rendered = rendered.replace(new RegExp(variable, 'g'), value);
  });
  
  // Handle subject for email templates
  let renderedSubject = this.subject;
  if (this.type === 'email' && this.subject) {
    Object.keys(data).forEach(key => {
      const variable = `{{${key}}}`;
      const value = data[key] || '';
      renderedSubject = renderedSubject.replace(new RegExp(variable, 'g'), value);
    });
  }
  
  return {
    content: rendered,
    subject: renderedSubject
  };
};

// Pre-save validation
templateSchema.pre('save', function(next) {
  try {
    this.validateContent();
    next();
  } catch (error) {
    next(error);
  }
});

// Update usage statistics
templateSchema.methods.incrementUsage = function() {
  return this.updateOne({
    $inc: { usageCount: 1 },
    $set: { lastUsed: new Date() }
  });
};

// Indexes
templateSchema.index({ type: 1, isActive: 1 });
templateSchema.index({ createdBy: 1 });
templateSchema.index({ createdAt: -1 });
templateSchema.index({ name: 'text', content: 'text' });

module.exports = mongoose.model('Template', templateSchema);

