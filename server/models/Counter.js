const mongoose = require('mongoose');

const CounterSchema = new mongoose.Schema({
  key: { type: String }, // Generic key support (for company codes, etc.)
  entity: { type: String },           // Legacy/Entity support
  prefix: { type: String },           // Legacy/Entity support
  year: { type: Number },             // Legacy/Entity support
  seq: { type: Number, default: 0 },
}, {
  timestamps: true,
  collection: 'counters',
  strict: false // Allow other fields if needed during transitions
});

// Compound index for entity-based counters
CounterSchema.index({ entity: 1, year: 1 }, { unique: true, sparse: true });
// Unique index for key-based counters
CounterSchema.index({ key: 1 }, { unique: true, sparse: true });

module.exports = CounterSchema;
