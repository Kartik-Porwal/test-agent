// models/responseTemplate.js
const mongoose = require('mongoose');

const responseTemplateSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  channel: {
    type: String,
    default: 'Chat'
  },
  description: String,
  content: {
    type: String,
    required: true
  },
  variables: [{
    name: String,
    description: String
  }],
  createdBy: String,
  isShared: {
    type: Boolean,
    default: false
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  uses: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.model('ResponseTemplate', responseTemplateSchema);
