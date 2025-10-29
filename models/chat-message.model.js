const mongoose = require('mongoose');

const ChatMessageSchema = new mongoose.Schema(
  {
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatSession', required: true },
    role: { type: String, enum: ['user', 'assistant', 'tool', 'system'], required: true },
    content: { type: String, default: '' },
    toolName: { type: String, default: null },
    toolArgs: { type: Object, default: null },
    citations: { type: Array, default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ChatMessage', ChatMessageSchema);