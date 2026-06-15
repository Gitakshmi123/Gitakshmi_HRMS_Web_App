const Group = require('../models/Group');
const Tenant = require('../models/Tenant');

exports.createGroup = async (req, res) => {
  try {
    const { name, companyLimit } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Group name is required'
      });
    }

    const parsedLimit = Number(companyLimit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
      return res.status(400).json({
        success: false,
        message: 'companyLimit must be a positive integer'
      });
    }

    const existingGroup = await Group.findOne({ name: String(name).trim() });
    if (existingGroup) {
      return res.status(400).json({
        success: false,
        message: 'Group with this name already exists'
      });
    }

    const group = await Group.create({
      name: String(name).trim(),
      companyLimit: parsedLimit,
      createdBy: String(req.user?.id || req.user?.email || 'unknown')
    });

    return res.status(201).json({
      success: true,
      message: 'Group created successfully',
      data: group
    });
  } catch (error) {
    console.error('createGroup error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create group',
      error: error.message
    });
  }
};

exports.getAllGroups = async (req, res) => {
  try {
    const requesterId = String(req.user?.id || '').trim();
    const requesterEmail = String(req.user?.email || '').trim();

    const query = {};
    if (requesterId || requesterEmail) {
      query.$or = [];
      if (requesterId) query.$or.push({ createdBy: requesterId });
      if (requesterEmail) {
        query.$or.push({
          createdBy: { $regex: new RegExp(`^${requesterEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        });
      }
    }

    const groups = await Group.find(query).sort({ createdAt: -1 }).lean();

    if (!groups.length) {
      return res.json({
        success: true,
        data: []
      });
    }

    const groupIds = groups.map((g) => g._id);
    const usageRows = await Tenant.aggregate([
      {
        $match: {
          groupId: { $in: groupIds },
          status: { $ne: 'deleted' }
        }
      },
      {
        $group: {
          _id: '$groupId',
          created: { $sum: 1 }
        }
      }
    ]);

    const usageMap = new Map(usageRows.map((u) => [String(u._id), Number(u.created || 0)]));

    const data = groups.map((group) => {
      const created = usageMap.get(String(group._id)) || 0;
      const limit = Number(group.companyLimit || 0);
      return {
        ...group,
        createdCompanies: created,
        remainingSlots: Math.max(limit - created, 0)
      };
    });

    return res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('getAllGroups error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch groups',
      error: error.message
    });
  }
};
