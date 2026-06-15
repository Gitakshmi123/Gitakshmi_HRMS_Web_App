const mongoose = require('mongoose');
const Company = require('../models/Company');
const Group = require('../models/Group');

function normalizeEmailRegex(email = '') {
  const safeEmail = String(email).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${safeEmail}$`, 'i');
}

async function resolveGroupIdForGroupAdmin(req) {
  if (req.user?.groupId && mongoose.Types.ObjectId.isValid(req.user.groupId)) {
    return String(req.user.groupId);
  }

  const User = mongoose.models.User || mongoose.model('User');

  if (req.user?.id && mongoose.Types.ObjectId.isValid(req.user.id)) {
    const userById = await User.findById(req.user.id).select('groupId');
    if (userById?.groupId) return String(userById.groupId);
  }

  if (req.user?.email) {
    const userByEmail = await User.findOne({
      email: normalizeEmailRegex(req.user.email)
    }).select('groupId');

    if (userByEmail?.groupId) return String(userByEmail.groupId);
  }

  return null;
}

exports.createCompany = async (req, res) => {
  try {
    const { name, groupId } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Company name is required'
      });
    }

    const requesterGroupId = await resolveGroupIdForGroupAdmin(req);
    if (!requesterGroupId) {
      return res.status(400).json({
        success: false,
        message: 'Group admin is not linked to any group. Please contact Super Admin'
      });
    }

    const bodyGroupId = groupId ? String(groupId) : null;
    if (bodyGroupId && !mongoose.Types.ObjectId.isValid(bodyGroupId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid groupId'
      });
    }

    const targetGroupId = bodyGroupId || requesterGroupId;
    if (targetGroupId !== requesterGroupId) {
      return res.status(403).json({
        success: false,
        message: 'You can only create companies in your own group'
      });
    }

    const group = await Group.findById(targetGroupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    const existingCompany = await Company.findOne({
      name: String(name).trim(),
      groupId: targetGroupId
    });

    if (existingCompany) {
      return res.status(400).json({
        success: false,
        message: 'Company with this name already exists in this group'
      });
    }

    const totalCompanies = await Company.countDocuments({ groupId: targetGroupId });
    if (totalCompanies >= group.companyLimit) {
      return res.status(400).json({
        success: false,
        message: 'Company limit reached. Contact Super Admin'
      });
    }

    const company = await Company.create({
      name: String(name).trim(),
      groupId: targetGroupId,
      createdBy: String(req.user?.id || req.user?.email || 'unknown')
    });

    return res.status(201).json({
      success: true,
      message: 'Company created successfully',
      data: {
        company,
        usage: `${totalCompanies + 1}/${group.companyLimit}`
      }
    });
  } catch (error) {
    console.error('createCompany error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create company',
      error: error.message
    });
  }
};
