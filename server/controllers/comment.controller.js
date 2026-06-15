const mongoose = require('mongoose');
const { checkEntityAccess } = require('../utils/accessControl');

const getModels = (req) => {
  if (req.tenantDB) {
    try {
      return {
        Comment: req.tenantDB.model('Comment'),
      };
    } catch (error) {
      // Model not registered, register it
      // console.log(`[COMMENT_CONTROLLER] Registering Comment model in tenant DB`);
      const CommentSchema = require('../models/Comment');
      return {
        Comment: req.tenantDB.model('Comment', CommentSchema),
      };
    }
  } else {
    // For super admin or testing, use main connection
    return {
      Comment: mongoose.model('Comment'),
    };
  }
};

// Fetch entity comments (with access validation)
exports.getComments = async (req, res) => {
    try {
        const { entityType, entityId } = req.params;
        const { Comment } = getModels(req);

        // Access Validation
        const hasAccess = await checkEntityAccess(req, entityType, entityId);
        if (!hasAccess) {
            return res.status(403).json({ error: "Access denied to this entity's comments." });
        }

        const comments = await Comment.find({
            tenant: req.tenantId,
            entityType,
            entityId
        })
            .populate('commentedBy', 'firstName lastName profilePic department designation name') // Added 'name' for User/Tenant fallback
            .sort({ createdAt: 1 })
            .lean();

        // Map for frontend compatibility (ensuring firstName/lastName exist even if from denormalized or other models)
        const enrichedComments = comments.map(c => {
            if (c.commentedByRole === 'hr' || !c.commentedBy) {
                // Return denormalized info for HR or if population failed
                return {
                    ...c,
                    commentedBy: {
                        _id: c.commentedBy,
                        firstName: c.commenterName?.split(' ')[0] || 'HR',
                        lastName: c.commenterName?.split(' ').slice(1).join(' ') || 'Admin',
                        profilePic: c.commenterPhoto
                    }
                };
            }
            return c;
        });

        res.json(enrichedComments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Add comment (with access validation)
exports.addComment = async (req, res) => {
    try {
        const { entityType, entityId } = req.params;
        const { message } = req.body;
        const { Comment } = getModels(req);

        if (!message) return res.status(400).json({ error: "Message is required" });

        // Access Validation
        const hasAccess = await checkEntityAccess(req, entityType, entityId);
        if (!hasAccess) {
            return res.status(403).json({ error: "Access denied. You cannot comment on this entity." });
        }

        let commenterName = "User";
        let commenterPhoto = "";
        let model = "Employee";

        if (req.user.role === 'hr') {
            const Tenant = require('../models/Tenant');
            const tenant = await Tenant.findById(req.user.id).lean();
            commenterName = tenant?.name || tenant?.meta?.ownerName || "HR Admin";
            commenterPhoto = tenant?.meta?.profilePic || "";
            model = "Tenant";
        } else {
            const { Employee } = getModels(req);
            const emp = await Employee.findById(req.user.id).select('firstName lastName profilePic').lean();
            if (emp) {
                commenterName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
                commenterPhoto = emp.profilePic || "";
            }
            model = "Employee";
        }

        const comment = new Comment({
            tenant: req.tenantId,
            entityType,
            entityId,
            message,
            commentedBy: req.user.id,
            commentedByModel: model,
            commentedByRole: req.user.role,
            commenterName,
            commenterPhoto
        });

        await comment.save();

        const populatedComment = await Comment.findById(comment._id)
            .populate('commentedBy', 'firstName lastName profilePic department designation name')
            .lean();

        // enrichment for HR on return
        if (req.user.role === 'hr') {
            populatedComment.commentedBy = {
                _id: req.user.id,
                firstName: commenterName.split(' ')[0],
                lastName: commenterName.split(' ').slice(1).join(' '),
                profilePic: commenterPhoto
            };
        }

        res.status(201).json(populatedComment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
