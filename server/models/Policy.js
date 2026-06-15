const mongoose = require('mongoose');

const targetSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    maxlength: 80,
  },
  values: {
    type: [String],
    default: [],
  },
}, { _id: false });

const policySchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  },
  module: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    maxlength: 80,
    index: true,
  },
  policyType: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    maxlength: 80,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 160,
  },
  code: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    maxlength: 80,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: '',
  },
  priority: {
    type: Number,
    default: 100,
    index: true,
  },
  targetMode: {
    type: String,
    enum: ['ALL', 'ANY', 'NONE'],
    default: 'ALL',
    uppercase: true,
    index: true,
  },
  targets: {
    type: [targetSchema],
    default: [],
  },
  targetKeys: {
    type: [String],
    default: [],
    index: true,
  },
  rules: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  effectiveFrom: {
    type: Date,
    default: null,
    index: true,
  },
  effectiveTo: {
    type: Date,
    default: null,
    index: true,
  },
  status: {
    type: String,
    enum: ['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'],
    default: 'ACTIVE',
    uppercase: true,
    index: true,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  version: {
    type: Number,
    min: 1,
    default: 1,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, {
  timestamps: true,
  collection: 'policies',
});

function normalizeToken(value) {
  return String(value || '').trim().toUpperCase();
}

function buildTargetKeys(targets = []) {
  const keys = new Set();

  targets.forEach((target) => {
    const type = normalizeToken(target?.type);
    if (!type) return;

    const values = Array.isArray(target?.values) ? target.values : [];
    values.forEach((value) => {
      const normalizedValue = String(value || '').trim();
      if (!normalizedValue) return;
      keys.add(`${type}:${normalizedValue.toLowerCase()}`);
    });
  });

  return Array.from(keys);
}

policySchema.pre('validate', function normalizePolicy(next) {
  this.module = normalizeToken(this.module);
  this.policyType = normalizeToken(this.policyType);
  this.code = normalizeToken(this.code);
  this.status = normalizeToken(this.status || 'ACTIVE');
  this.targetMode = normalizeToken(this.targetMode || 'ALL');
  this.isActive = this.status === 'ACTIVE';

  this.targets = (this.targets || []).map((target) => ({
    type: normalizeToken(target.type),
    values: Array.from(new Set((target.values || [])
      .map((value) => String(value || '').trim())
      .filter(Boolean))),
  })).filter((target) => target.type);

  this.targetKeys = buildTargetKeys(this.targets);

  if (this.targetMode !== 'ALL' && this.targetKeys.length === 0) {
    return next(new Error('Targeted policies require at least one target value'));
  }

  if (this.effectiveFrom && this.effectiveTo && new Date(this.effectiveTo) < new Date(this.effectiveFrom)) {
    return next(new Error('effectiveTo cannot be before effectiveFrom'));
  }

  next();
});

policySchema.statics.buildTargetKeys = buildTargetKeys;

policySchema.index({ tenant: 1, module: 1, policyType: 1, status: 1, isActive: 1, priority: -1 });
policySchema.index({ tenant: 1, module: 1, policyType: 1, targetMode: 1, targetKeys: 1, priority: -1 });
policySchema.index({ tenant: 1, code: 1, version: 1 }, { unique: true });
policySchema.index({ tenant: 1, effectiveFrom: 1, effectiveTo: 1 });

module.exports = policySchema;
