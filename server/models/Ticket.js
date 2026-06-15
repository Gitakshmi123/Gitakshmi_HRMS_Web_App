const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', index: true },
    mainCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },

    status: {
        type: String,
        enum: ['UNREAD', 'OPEN', 'IN_PROGRESS', 'DONE', 'REJECTED'],
        default: 'UNREAD',
        index: true
    },


    priority: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
        default: 'MEDIUM'
    },

    category: {
        type: String,
        default: 'GENERAL'
    },

    // Metadata for "Intelligent Routing"
    routingInfo: {
        unit: { type: String },
        aiAnalyzed: { type: Boolean, default: false },
        analysisContext: { type: String }
    },

    // Relations
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    
    comments: [{
        sender: { type: String }, // Display name
        senderId: { type: mongoose.Schema.Types.ObjectId, required: true },
        senderRole: { type: String, enum: ['hr', 'admin', 'employee', 'psa'], required: true },
        text: { type: String }, // Optional if attachment exists
        attachments: [{
            fileUrl: { type: String },
            fileName: { type: String },
            fileType: { type: String }
        }],
        avatar: { type: String },
        createdAt: { type: Date, default: Date.now }
    }],

    isRead: { type: Boolean, default: false }
}, { timestamps: true });

TicketSchema.index({ tenant: 1, employee: 1 });
TicketSchema.index({ tenant: 1, status: 1 });

module.exports = TicketSchema;
