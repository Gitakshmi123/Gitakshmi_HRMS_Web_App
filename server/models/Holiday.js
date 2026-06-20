const mongoose = require('mongoose');

const HolidaySchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    endDate: { type: Date },
    type: { type: String, enum: ['Public', 'Optional', 'Company', 'National', 'Festival'], default: 'Public' },
    description: { type: String, trim: true },

}, { timestamps: true });

// Unique holiday per tenant per date
HolidaySchema.index({ tenant: 1, date: 1 }, { unique: true });

module.exports = HolidaySchema;
