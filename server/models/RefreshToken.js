const mongoose = require('mongoose');

const RefreshTokenSchema = new mongoose.Schema(
  {
    subjectId: { type: String, required: true, index: true },
    subjectType: {
      type: String,
      enum: ['psa', 'user', 'employee'],
      required: true,
      index: true,
    },
    tenantId: { type: String, default: null, index: true },
    sessionId: { type: String, required: true, index: true },
    jti: { type: String, required: true, unique: true, index: true },
    tokenHash: { type: String, required: true, unique: true, select: false },
    email: { type: String, default: null },
    role: { type: String, default: null },
    companyCode: { type: String, default: null },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
    expiresAt: { type: Date, required: true },
    lastUsedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null, index: true },
    revokedReason: { type: String, default: null },
    replacedByJti: { type: String, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
RefreshTokenSchema.index({ subjectId: 1, subjectType: 1, sessionId: 1 });

module.exports =
  mongoose.models.RefreshToken || mongoose.model('RefreshToken', RefreshTokenSchema);
