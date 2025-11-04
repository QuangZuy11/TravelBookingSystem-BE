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
      trim: true,
    },
    policyType: {
      type: String,
      enum: ['TOUR', 'HOTEL'],
      uppercase: true,
      trim: true,
      default: null,
    },
    highlight: {
      type: Boolean,
    },
    color: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    items: {
      type: [termItemSchema],
      default: undefined,
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
    versionKey: false,
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
