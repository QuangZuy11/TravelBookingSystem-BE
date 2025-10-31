const mongoose = require('mongoose');

const termItemSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      trim: true,
    },
    content: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ['warning', 'success', 'info', 'note', 'rule', 'tip'],
      default: 'info',
    },
    important: {
      type: Boolean,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const termsPolicySchema = new mongoose.Schema(
  {
    target: {
      type: String,
      trim: true,
      lowercase: true,
    },
    role: {
      type: String,
      trim: true,
      uppercase: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    iconKey: {
      type: String,
      default: null,
      trim: true,
    },
    highlight: {
      type: Boolean,
      default: false,
    },
    color: {
      type: String,
      default: 'teal',
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    items: {
      type: [termItemSchema],
      default: [],
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

termsPolicySchema.pre('validate', function (next) {
  if (!this.target && !this.role) {
    return next(new Error('Terms policy must specify either target or role'));
  }
  return next();
});

termsPolicySchema.index({ target: 1 });
termsPolicySchema.index({ role: 1 });
termsPolicySchema.index({ target: 1, role: 1 });

module.exports = mongoose.model('TermsPolicy', termsPolicySchema, 'TERMS_POLICIES');
