const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Report Configuration Schema
 * Stores settings for VA daily report generation and delivery
 */
const ReportConfigurationSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  enabled: {
    type: Boolean,
    default: true
  },
  boardIds: [{
    type: String,
    required: true
  }],
  boardNames: [{
    type: String
  }],
  virtualAssistantIds: [{
    type: String
  }],
  virtualAssistantNames: [{
    type: String
  }],
  recipients: [{
    type: String,
    required: true,
    validate: {
      validator: function(email) {
        return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email);
      },
      message: props => `${props.value} is not a valid email address!`
    }
  }],
  scheduleTime: {
    type: String,
    required: true,
    validate: {
      validator: function(time) {
        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
      },
      message: props => `${props.value} is not a valid time format (HH:MM)!`
    }
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  weekendDelivery: {
    type: Boolean,
    default: false
  },
  reportTemplate: {
    type: String,
    default: `
      <h1>Daily Progress Report - {{date}}</h1>
      <h2>Virtual Assistant: {{vaName}}</h2>
      
      <h3>Task Status</h3>
      <ul>
        {{#each tasks}}
        <li>
          <strong>{{cardName}}</strong>: {{taskStatus}}
          {{#if completedItems.length}}
          <ul>
            {{#each completedItems}}
            <li>{{this}}</li>
            {{/each}}
          </ul>
          {{/if}}
        </li>
        {{/each}}
      </ul>
      
      <h3>Blockers & Challenges</h3>
      {{#if blockers.length}}
      <ul>
        {{#each blockers}}
        <li>{{this}}</li>
        {{/each}}
      </ul>
      {{else}}
      <p>No blockers reported today.</p>
      {{/if}}
      
      <h3>Additional Notes</h3>
      <p>{{additionalNotes}}</p>
    `
  },
  requiredFields: [{
    type: String,
    enum: ['taskStatus', 'completedItems', 'blockers', 'additionalNotes'],
    default: ['taskStatus']
  }],
  parsePatterns: [{
    type: String,
    default: [
      "status:([\\w\\s]+)",
      "completed:([\\w\\s,]+)",
      "blockers?:([\\w\\s,]+)",
      "notes?:([\\w\\s,]+)"
    ]
  }],
  createdBy: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save hook to update the updatedAt field
ReportConfigurationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to enable configuration
ReportConfigurationSchema.methods.enable = function() {
  this.enabled = true;
  return this.save();
};

// Method to disable configuration
ReportConfigurationSchema.methods.disable = function() {
  this.enabled = false;
  return this.save();
};

// Static method to find active configurations
ReportConfigurationSchema.statics.findActive = function() {
  return this.find({ enabled: true });
};

// Static method to find configurations by board
ReportConfigurationSchema.statics.findByBoard = function(boardId) {
  return this.find({ boardIds: boardId });
};

// Static method to find configurations by VA
ReportConfigurationSchema.statics.findByVirtualAssistant = function(vaId) {
  return this.find({ virtualAssistantIds: vaId });
};

module.exports = mongoose.model('ReportConfiguration', ReportConfigurationSchema);
