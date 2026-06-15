const mongoose = require('mongoose');

// Helper to safely get models relative to tenant DB
const getModels = (req) => {
    if (req.tenantDB) {
        try {
            // Check if models are already registered on this connection
            // We use a safe check to avoid OverwriteModelError if schema differs (though usually it's same schema)
            // But standard mongoose.model getter works fine if model exists.
            // If not, it throws, and we catch it to register.
            return {
                Notification: req.tenantDB.model('Notification'),
                LeaveRequest: req.tenantDB.model('LeaveRequest'),
                Regularization: req.tenantDB.model('Regularization'),
            };
        } catch (error) {
            // Models not registered, register them
            try {
                const NotificationSchema = require('../models/Notification');
                const LeaveRequestSchema = require('../models/LeaveRequest');
                const RegularizationSchema = require('../models/Regularization');
                return {
                    Notification: req.tenantDB.model('Notification', NotificationSchema),
                    LeaveRequest: req.tenantDB.model('LeaveRequest', LeaveRequestSchema),
                    Regularization: req.tenantDB.model('Regularization', RegularizationSchema),
                };
            } catch (innerError) {
                console.error("CRITICAL: Failed to register tenant models:", innerError);
                throw innerError; // Propagate up
            }
        }
    } else {
        // Fallback for super admin or when tenantDB is not set
        return {
            Notification: mongoose.model('Notification'),
            LeaveRequest: mongoose.model('LeaveRequest'),
            Regularization: mongoose.model('Regularization'),
        };
    }
};

/**
 * Creates a notification (Internal Service function)
 * Does not send response, just returns result.
 */
exports.createNotification = async (req, {
    receiverId,
    receiverRole,
    entityType,
    entityId,
    title,
    message
}) => {
    try {
        const { Notification } = getModels(req);

        const notification = new Notification({
            tenant: req.tenantId,
            receiverId,
            receiverRole,
            entityType,
            entityId,
            title,
            message
        });

        await notification.save();
        return notification;
    } catch (error) {
        console.error("SERVICE ERROR: Failed to create notification:", error);
        return null;
    }
};

/**
 * Get notifications for the logged-in user
 */
exports.getNotifications = async (req, res) => {
    try {
        // Backend validation: Ensure user is authenticated
        if (!req.user || !req.user.id) {
            return res.status(401).json({ success: false, message: 'User authentication required' });
        }

        // For tenant-specific operations, ensure tenantId is available (except for super admin)
        if (!req.tenantId && req.user.role !== 'psa') {
            return res.status(400).json({ success: false, message: 'Tenant context required' });
        }

        const { Notification } = getModels(req);

        // Valid ObjectId check to prevent CastError crashes
        if (!mongoose.Types.ObjectId.isValid(req.user.id)) {
            return res.status(200).json({ notifications: [], unreadCount: 0 });
        }

        const query = {
            tenant: req.tenantId,
            receiverId: req.user.id,
            receiverRole: req.user.role
        };

        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .limit(50);

        const unreadCount = await Notification.countDocuments({ ...query, isRead: false });

        return res.status(200).json({
            notifications,
            unreadCount
        });

    } catch (error) {
        console.error("CONTROLLER ERROR (getNotifications):", error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

/**
 * Get all requests and notifications for the user
 */
exports.getMyRequests = async (req, res) => {
    try {
        const { LeaveRequest, Regularization, Notification } = getModels(req);
        const userId = req.user.id;
        const tenantId = req.tenantId;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(200).json({ leaves: [], regularizations: [], notifications: [] });
        }

        // Parallel execution for performance
        const [leaves, regularizations, notifications] = await Promise.all([
            LeaveRequest.find({ tenant: tenantId, employee: userId }).sort({ createdAt: -1 }),
            Regularization.find({ tenant: tenantId, employee: userId }).sort({ createdAt: -1 }),
            Notification.find({ tenant: tenantId, receiverId: userId, receiverRole: req.user.role }).sort({ createdAt: -1 }).limit(50)
        ]);

        return res.status(200).json({
            leaves,
            regularizations,
            notifications
        });
    } catch (error) {
        console.error("CONTROLLER ERROR (getMyRequests):", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Mark as read
 */
exports.markAsRead = async (req, res) => {
    try {
        const { Notification } = getModels(req);
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid ID' });
        }

        const notification = await Notification.findOne({
            _id: id,
            tenant: req.tenantId,
            receiverId: req.user.id,
            receiverRole: req.user.role
        });

        if (!notification) {
            return res.status(404).json({ success: false, message: "Notification not found" });
        }

        notification.isRead = true;
        notification.readAt = new Date();
        await notification.save();

        return res.status(200).json(notification);
    } catch (error) {
        console.error("CONTROLLER ERROR (markAsRead):", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Mark ALL as read
 */
exports.markAllAsRead = async (req, res) => {
    try {
        const { Notification } = getModels(req);

        await Notification.updateMany(
            {
                tenant: req.tenantId,
                receiverId: req.user.id,
                receiverRole: req.user.role,
                isRead: false
            },
            { $set: { isRead: true, readAt: new Date() } }
        );

        return res.status(200).json({ success: true, message: "All marked as read" });
    } catch (error) {
        console.error("CONTROLLER ERROR (markAllAsRead):", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
