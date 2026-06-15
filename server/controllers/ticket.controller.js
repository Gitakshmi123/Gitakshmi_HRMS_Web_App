const mongoose = require('mongoose');

// Helper to safely get Ticket model relative to tenant DB
const getModels = (req) => {
    if (req.tenantDB) {
        try {
            return {
                Ticket: req.tenantDB.model('Ticket'),
                Employee: req.tenantDB.model('Employee'),
            };
        } catch (error) {
            try {
                const TicketSchema = require('../models/Ticket');
                const EmployeeSchema = require('../models/Employee');
                return {
                    Ticket: req.tenantDB.model('Ticket', TicketSchema),
                    Employee: req.tenantDB.model('Employee', EmployeeSchema),
                };
            } catch (innerError) {
                console.error("CRITICAL: Failed to register tenant models:", innerError);
                throw innerError;
            }
        }
    } else {
        return {
            Ticket: mongoose.model('Ticket'),
            Employee: mongoose.model('Employee'),
        };
    }
};

// Helper to normalize role for Ticket Comment enum ['hr', 'admin', 'employee', 'psa']
const normalizeRole = (role) => {
    const r = (role || '').toLowerCase();
    if (['psa', 'super_admin'].includes(r)) return 'psa';
    if (['admin', 'company_admin', 'company_super_admin'].includes(r)) return 'admin';
    if (['hr', 'hr_manager', 'hr manager', 'human_resource', 'manager', 'hr_admin'].includes(r)) return 'hr';
    return 'employee';
};

/**
 * Get all tickets for the employee
 */
exports.getMyTickets = async (req, res) => {
    try {
        const { Ticket } = getModels(req);
        const query = {
            tenant: req.tenantId,
            employee: req.user.id
        };
        console.log('[TICKET_CONTROLLER] getMyTickets Query:', query, 'Tenant:', req.tenantId);

        const tickets = await Ticket.find(query)
            .sort({ createdAt: -1 })
            .limit(100);

        console.log(`[TICKET_CONTROLLER] getMyTickets Found ${tickets.length} tickets`);
        return res.status(200).json(tickets);
    } catch (error) {
        console.error("CONTROLLER ERROR (getMyTickets):", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Create a new ticket
 */
exports.createTicket = async (req, res) => {
    try {
        const { Ticket } = getModels(req);
        const { title, description, category, priority } = req.body;

        const attachments = [];
        if (req.file) {
            const CloudinaryService = require("../services/CloudinaryService");
            if (CloudinaryService.isConfigured()) {
                try {
                    const result = await CloudinaryService.uploadFile(
                        req.file.path,
                        `hrms/${req.tenantId}/tickets/${req.user.id}`,
                        true
                    );
                    attachments.push({
                        fileName: req.file.originalname,
                        fileUrl: result.url,
                        fileType: req.file.mimetype
                    });
                } catch (cloudErr) {
                    console.warn("Ticket attachment cloud upload failed, using local:", cloudErr.message);
                    attachments.push({
                        fileName: req.file.originalname,
                        fileUrl: `/uploads/tickets/${req.file.filename}`,
                        fileType: req.file.mimetype
                    });
                }
            } else {
                attachments.push({
                    fileName: req.file.originalname,
                    fileUrl: `/uploads/tickets/${req.file.filename}`,
                    fileType: req.file.mimetype
                });
            }
        }

        const ticket = new Ticket({
            tenant: req.tenantId,
            groupId: req.user.groupId || null,
            mainCompanyId: req.user.mainCompanyId || null,
            employee: req.user.id,
            title,
            description,
            category,
            priority,
            routingInfo: {
                unit: 'General Support',
                aiAnalyzed: true,
                analysisContext: 'Auto-routed by Ticket Intelligence Engine'
            },
            // Add the initial message as a comment if it has attachments or we want a conversational start
            comments: [{
                sender: req.user.name || 'Employee',
                senderId: req.user.id,
                senderRole: 'employee',
                text: description,
                attachments,
                createdAt: new Date()
            }]
        });

        await ticket.save();

        return res.status(201).json({ success: true, ticket });
    } catch (error) {
        console.error("CONTROLLER ERROR (createTicket):", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get ticket details
 */
exports.getTicketDetails = async (req, res) => {
    try {
        const { Ticket } = getModels(req);
        const query = req.user.role === 'psa' ? { _id: req.params.id } : { _id: req.params.id, tenant: req.tenantId };
        const ticket = await Ticket.findOne(query);

        if (!ticket) {
            return res.status(404).json({ success: false, message: 'Ticket not found' });
        }

        return res.status(200).json(ticket);
    } catch (error) {
        console.error("CONTROLLER ERROR (getTicketDetails):", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Add a comment (Chat)
 */
exports.addComment = async (req, res) => {
    try {
        const { Ticket } = getModels(req);
        const { text, senderName, avatar } = req.body;

        if (!text && !req.file) {
            return res.status(400).json({ success: false, message: 'Comment text or attachment is required' });
        }

        const query = req.user.role === 'psa' ? { _id: req.params.id } : { _id: req.params.id, tenant: req.tenantId };
        const ticket = await Ticket.findOne(query);

        if (!ticket) {
            return res.status(404).json({ success: false, message: 'Ticket not found' });
        }

        const attachments = [];
        if (req.file) {
            const CloudinaryService = require("../services/CloudinaryService");
            if (CloudinaryService.isConfigured()) {
                try {
                    const result = await CloudinaryService.uploadFile(
                        req.file.path,
                        `hrms/${req.tenantId}/tickets/${req.user.id}/comments`,
                        true
                    );
                    attachments.push({
                        fileName: req.file.originalname,
                        fileUrl: result.url,
                        fileType: req.file.mimetype
                    });
                } catch (cloudErr) {
                    console.warn("Comment attachment cloud upload failed, using local:", cloudErr.message);
                    attachments.push({
                        fileName: req.file.originalname,
                        fileUrl: `/uploads/tickets/${req.file.filename}`,
                        fileType: req.file.mimetype
                    });
                }
            } else {
                attachments.push({
                    fileUrl: `/uploads/tickets/${req.file.filename}`,
                    fileName: req.file.originalname,
                    fileType: req.file.mimetype
                });
            }
        }

        ticket.comments.push({
            sender: senderName || req.user.name || 'User',
            senderId: req.user.id,
            senderRole: normalizeRole(req.user.role),
            text: text || (attachments.length > 0 ? "Attached a file" : ""),
            attachments,
            avatar: avatar || null,
            createdAt: new Date()
        });

        await ticket.save();

        return res.status(200).json({ success: true, ticket });
    } catch (error) {
        console.error("CONTROLLER ERROR (addComment):", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Update status (Used by Admin usually)
 */
exports.updateTicketStatus = async (req, res) => {
    try {
        const { Ticket } = getModels(req);
        const { status, remark } = req.body;

        const query = req.user.role === 'psa' ? { _id: req.params.id } : { _id: req.params.id, tenant: req.tenantId };
        const ticket = await Ticket.findOne(query);

        if (!ticket) {
            return res.status(404).json({ success: false, message: 'Ticket not found' });
        }

        ticket.status = status;
        if (remark) {
            ticket.comments.push({
                sender: req.user.name || 'System Admin',
                senderId: req.user.id,
                senderRole: normalizeRole(req.user.role),
                text: `[STATUS UPDATE] ${remark}`,
                createdAt: new Date()
            });
        }

        await ticket.save();

        return res.status(200).json({ success: true, ticket });
    } catch (error) {
        console.error("CONTROLLER ERROR (updateTicketStatus):", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Admin: Get all tickets
 */
exports.getAllTickets = async (req, res) => {
    try {
        const { Ticket } = getModels(req);
        
        // Resolve the most accurate tenantId for filtering
        const effectiveTenantId = req.tenantId || req.user.tenantId || req.user.companyId;
        const groupId = req.user.groupId;
        
        // 🔥 PSA BYPASS: If Super Admin, show ALL tickets across ALL tenants.
        // Otherwise, filter by the user's tenantId OR their organization groupId.
        let query = {};
        if (req.user.role !== 'psa') {
            const orConditions = [{ tenant: effectiveTenantId }];
            
            // If HR admin belongs to a group/organization, find all company IDs in that group
            if (groupId) {
                try {
                    const TenantModel = mongoose.model('Tenant');
                    const relatedTenants = await TenantModel.find({ groupId: groupId }).select('_id').lean();
                    const relatedIds = relatedTenants.map(t => t._id);
                    if (relatedIds.length > 0) {
                        orConditions.push({ tenant: { $in: relatedIds } });
                    }
                    orConditions.push({ groupId: groupId });
                } catch (err) {
                    console.error("[TICKET_CONTROLLER] Error fetching related tenants:", err);
                }
            }
            
            if (req.user.mainCompanyId) orConditions.push({ mainCompanyId: req.user.mainCompanyId });
            
            query = { $or: orConditions };
        }

        const tickets = await Ticket.find(query)
            .populate({ path: 'employee', select: 'firstName lastName email designation' })
            .populate({ path: 'tenant', select: 'companyName code' }) // Added for PSA to see which company the ticket belongs to
            .sort({ createdAt: -1 });

        console.log(`[TICKET_CONTROLLER] getAllTickets Found ${tickets.length} tickets`);
        return res.status(200).json(tickets);
    } catch (error) {
        console.error("CONTROLLER ERROR (getAllTickets):", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Admin: Assign ticket
 */
exports.assignTicket = async (req, res) => {
    try {
        const { Ticket } = getModels(req);
        const { assigneeId } = req.body;

        const query = req.user.role === 'psa' ? { _id: req.params.id } : { _id: req.params.id, tenant: req.tenantId };
        const ticket = await Ticket.findOne(query);

        if (!ticket) {
            return res.status(404).json({ success: false, message: 'Ticket not found' });
        }

        ticket.assignedTo = assigneeId;
        await ticket.save();

        return res.status(200).json({ success: true, ticket });
    } catch (error) {
        console.error("CONTROLLER ERROR (assignTicket):", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
