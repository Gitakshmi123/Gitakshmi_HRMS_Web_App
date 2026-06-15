const mongoose = require('mongoose');

const getBranchModel = () => {
    return mongoose.models.Branch || mongoose.model('Branch', require('../models/Branch'));
};
const getTenantModel = () => {
    return mongoose.models.Tenant || mongoose.model('Tenant', require('../models/Tenant').schema || require('../models/Tenant'));
};
const getUserModel = () => {
    return mongoose.models.User || mongoose.model('User', require('../models/User').schema || require('../models/User'));
};

const Branch = getBranchModel();
const Tenant = getTenantModel();
const User = getUserModel();

function getLoggedCompanyId(req) {
  const compId = String(req.user?.companyId || '').trim();
  const isInvalid = !compId || compId === 'null' || compId === 'undefined';
  
  const finalId = isInvalid ? (req.user?.tenantId || req.user?.tenant) : compId;
  
  if (!finalId) return null;
  const s = String(finalId).trim();
  return mongoose.Types.ObjectId.isValid(s) ? s : null;
}

/**
 * @route   POST /api/branch/create
 * @desc    Create a new branch
 * @access  Private (Company Admin/Super Admin)
 */
exports.createBranch = async (req, res) => {
  try {
    const { 
      name, address, city, state, country, branchCode, 
      branchType, contactPerson, contactPhone, contactEmail, 
      workingHours, timezone, headUserId, status 
    } = req.body;
    const loggedCompanyId = getLoggedCompanyId(req);

    // Product Super Admin is not involved in branches
    if (req.user.role === 'psa') {
      return res.status(403).json({ success: false, message: 'Forbidden: Product Admin does not manage branches' });
    }

    if (!name || (!branchCode && !req.body.autoGenerateCode)) {
      return res.status(400).json({ success: false, message: 'Name and Branch Code are required' });
    }

    if (!loggedCompanyId || !mongoose.Types.ObjectId.isValid(loggedCompanyId)) {
      return res.status(400).json({ success: false, message: 'Invalid company context' });
    }

    let targetCompanyId = loggedCompanyId;
    let initialStatus = 'pending';

    // Role-based logic
    if (req.user.role === 'company_super_admin') {
      // Company Super Admin: Can specify sub-company and branch is active immediately
      if (req.body.companyId && mongoose.Types.ObjectId.isValid(req.body.companyId)) {
        targetCompanyId = req.body.companyId;
      }
      initialStatus = status || 'active';
    } else if (req.user.role === 'company_admin' || req.user.role === 'hr' || req.user.role === 'hr_manager' || req.user.role === 'hr_admin') {
      // Sub Company Admin / HR: Branch is always pending
      initialStatus = 'pending';
    } else {
      return res.status(403).json({ success: false, message: 'Forbidden: Unauthorized role' });
    }

    // Fetch parentCompanyId from Tenant model
    const Tenant = mongoose.model('Tenant');
    const targetTenant = await Tenant.findById(targetCompanyId).lean();
    const parentCompanyId = targetTenant?.parentCompanyId || null;

    // Check uniqueness of branchCode
    const codeExists = await getBranchModel().findOne({ branchCode: branchCode.trim() }).lean();
    if (codeExists) {
      return res.status(400).json({ success: false, message: 'Branch code already exists' });
    }

    // Check name uniqueness per company
    const existingName = await getBranchModel().findOne({
      mainCompanyId: targetCompanyId,
      name: { $regex: new RegExp(`^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    }).lean();

    if (existingName) {
      return res.status(400).json({ success: false, message: 'Branch name already exists for this company' });
    }

    const branch = await getBranchModel().create({
      name: name.trim(),
      mainCompanyId: targetCompanyId,
      parentCompanyId: parentCompanyId,
      address: address?.trim(),
      city: city?.trim(),
      state: state?.trim(),
      country: country?.trim(),
      branchCode: (branchCode || '').trim(),
      branchType: branchType || 'Branch',
      contactPerson: contactPerson?.trim(),
      contactPhone: contactPhone?.trim(),
      contactEmail: contactEmail?.trim(),
      workingHours: {
        startTime: workingHours?.startTime || '09:00',
        endTime: workingHours?.endTime || '18:00'
      },
      timezone: timezone || 'UTC+5:30',
      headUserId: headUserId || null,
      status: initialStatus
    });

    return res.status(201).json({
      success: true,
      message: initialStatus === 'pending' ? 'Branch request submitted for approval' : 'Branch created successfully',
      data: branch
    });
  } catch (error) {
    console.error('createBranch error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create branch', error: error.message });
  }
};

/**
 * @route   GET /api/branches/pending
 * @desc    Get all branches with status = "pending" for approval
 */
exports.getPendingBranches = async (req, res) => {
  try {
    const userRole = (req.user.role || '').toLowerCase();
    const userCompanyId = String(req.user.companyId || '').trim();
    const userTenantId = String(req.user.tenantId || req.user.tenant || '').trim();
    
    // In this system, parent admins often have companyId === tenantId in their token context
    const isParentContext = !userCompanyId || userCompanyId === 'null' || userCompanyId === '' || userCompanyId === userTenantId;
    
    const isAdminOfParent = 
      userRole === 'company_super_admin' || 
      (['hr', 'admin', 'human_resource', 'hr_manager', 'hr_admin', 'manager'].includes(userRole) && isParentContext);

    if (!isAdminOfParent || userRole === 'psa') {
      return res.status(403).json({ 
        success: false, 
        message: 'Forbidden: Unauthorized to view pending branches (Parent-level access required)',
        debug: { userRole, userCompanyId, userTenantId, isParentContext, isAdminOfParent }
      });
    }

    const loggedCompanyId = getLoggedCompanyId(req);
    if (!loggedCompanyId) {
      return res.json({ success: true, items: [], message: 'No company context found' });
    }

    // Filter: branches whose parent is the logged-in admin's company
    const filter = { 
      status: 'pending',
      parentCompanyId: loggedCompanyId
    };
    
    // console.log(`[DEBUG] Fetching pending branches for parentCompanyId: ${loggedCompanyId}`);
    const branches = await getBranchModel().find(filter)
      .populate('mainCompanyId', 'name companyName code')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, items: branches });
  } catch (error) {
    console.error('getPendingBranches error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch pending branches', 
      error: error.message,
      stack: error.stack 
    });
  }
};

/**
 * @route   PUT /api/branches/approve/:id
 * @desc    Approve a branch request
 */
exports.approveBranch = async (req, res) => {
  try {
    const userRole = (req.user.role || '').toLowerCase();
    const userCompanyId = String(req.user.companyId || '').trim();
    const userTenantId = String(req.user.tenantId || req.user.tenant || '').trim();
    
    // Parent context identification
    const isParentContext = !userCompanyId || userCompanyId === 'null' || userCompanyId === '' || userCompanyId === userTenantId;
    
    const isAdminOfParent = 
      userRole === 'company_super_admin' || 
      (['hr', 'admin', 'human_resource', 'hr_manager', 'hr_admin', 'manager'].includes(userRole) && isParentContext);

    if (!isAdminOfParent || userRole === 'psa') {
      return res.status(403).json({ success: false, message: 'Forbidden: Unauthorized to approve branches' });
    }

    const branch = await getBranchModel().findById(req.params.id);
    if (!branch) return res.status(404).json({ success: false, message: 'Branch not found' });

    branch.status = 'active';
    await branch.save();

    return res.json({ success: true, message: 'Branch approved and activated', data: branch });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Approval process failed' });
  }
};

/**
 * @route   PUT /api/branches/reject/:id
 * @desc    Reject a branch request
 */
exports.rejectBranch = async (req, res) => {
  try {
    const userRole = (req.user.role || '').toLowerCase();
    const userCompanyId = String(req.user.companyId || '').trim();
    const userTenantId = String(req.user.tenantId || req.user.tenant || '').trim();
    
    // Parent context identification
    const isParentContext = !userCompanyId || userCompanyId === 'null' || userCompanyId === '' || userCompanyId === userTenantId;
    
    const isAdminOfParent = 
      userRole === 'company_super_admin' || 
      (['hr', 'admin', 'human_resource', 'hr_manager', 'hr_admin', 'manager'].includes(userRole) && isParentContext);

    if (!isAdminOfParent || userRole === 'psa') {
      return res.status(403).json({ success: false, message: 'Forbidden: Unauthorized to reject branches' });
    }

    const branch = await getBranchModel().findById(req.params.id);
    if (!branch) return res.status(404).json({ success: false, message: 'Branch not found' });

    branch.status = 'rejected';
    await branch.save();

    return res.json({ success: true, message: 'Branch request rejected', data: branch });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Rejection process failed' });
  }
};

/**
 * @route   GET /api/branch/list
 * @desc    Get all branches for the logged-in company
 * @access  Private (Admin/HR)
 */
exports.getBranches = async (req, res) => {
  try {
    const loggedCompanyId = getLoggedCompanyId(req);
    if (!loggedCompanyId || !mongoose.Types.ObjectId.isValid(loggedCompanyId)) {
      return res.status(400).json({ success: false, message: 'Invalid company context' });
    }

    const userRole = (req.user.role || '').toLowerCase();
    const userCompanyId = String(req.user.companyId || '').trim();
    const userTenantId = String(req.user.tenantId || req.user.tenant || '').trim();
    const isParentContext = !userCompanyId || userCompanyId === 'null' || userCompanyId === '' || userCompanyId === userTenantId;

    let filter = { mainCompanyId: loggedCompanyId };

    // If Parent Admin, they should see all branches of their organization (including sub-companies)
    const isParentAdmin = ['hr', 'admin', 'company_super_admin', 'human_resource', 'hr_manager', 'hr_admin', 'manager'].includes(userRole) && isParentContext;

    if (isParentAdmin) {
      filter = {
        $or: [
          { mainCompanyId: loggedCompanyId },
          { parentCompanyId: loggedCompanyId }
        ]
      };
    } else if (req.user.role === 'company_super_admin' && req.user.groupId) {
      // Legacy Group ID logic
      const TenantModel = getTenantModel();
      const subCompanies = await TenantModel.find({ groupId: req.user.groupId }).select('_id').lean();
      const companyIds = subCompanies.map(c => c._id);
      filter = { mainCompanyId: { $in: companyIds } };
    }

    const branches = await getBranchModel().find(filter)
      .populate('mainCompanyId', 'name companyName code') // Populate which company it belongs to
      .populate('headUserId', 'firstName lastName name email firstName lastName')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ 
      success: true, 
      items: branches,
      count: branches.length 
    });
  } catch (error) {
    console.error('getBranches error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch branches', error: error.message });
  }
};

/**
 * @route   PUT /api/branch/:id
 * @desc    Update a branch
 */
exports.updateBranch = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, address, city, state, country, branchCode, 
      branchType, contactPerson, contactPhone, contactEmail, 
      workingHours, timezone, headUserId, status 
    } = req.body;
    const loggedCompanyId = getLoggedCompanyId(req);

    const branch = await getBranchModel().findOne({ 
      _id: id, 
      $or: [{ mainCompanyId: loggedCompanyId }, { parentCompanyId: loggedCompanyId }] 
    });

    if (!branch) {
      return res.status(404).json({ success: false, message: 'Branch not found or unauthorized' });
    }

    if (name) branch.name = name.trim();
    if (address !== undefined) branch.address = address.trim();
    if (city !== undefined) branch.city = city.trim();
    if (state !== undefined) branch.state = state.trim();
    if (country !== undefined) branch.country = country.trim();
    if (branchCode) branch.branchCode = branchCode.trim();
    if (branchType) branch.branchType = branchType;
    if (contactPerson !== undefined) branch.contactPerson = contactPerson.trim();
    if (contactPhone !== undefined) branch.contactPhone = contactPhone.trim();
    if (contactEmail !== undefined) branch.contactEmail = contactEmail.trim();
    if (workingHours) {
      branch.workingHours = {
        startTime: workingHours.startTime || branch.workingHours.startTime,
        endTime: workingHours.endTime || branch.workingHours.endTime
      };
    }
    if (timezone) branch.timezone = timezone;
    if (headUserId !== undefined) branch.headUserId = headUserId || null;
    if (status) branch.status = status;

    await branch.save();

    return res.json({
      success: true,
      message: 'Branch updated successfully',
      data: branch
    });
  } catch (error) {
    console.error('updateBranch error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update branch', error: error.message });
  }
};

/**
 * @route   DELETE /api/branch/:id
 * @desc    Delete a branch
 */
exports.deleteBranch = async (req, res) => {
  try {
    const { id } = req.params;
    const loggedCompanyId = getLoggedCompanyId(req);

    const result = await getBranchModel().deleteOne({ _id: id, mainCompanyId: loggedCompanyId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Branch not found or unauthorized' });
    }

    return res.json({
      success: true,
      message: 'Branch deleted successfully'
    });
  } catch (error) {
    console.error('deleteBranch error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete branch', error: error.message });
  }
};

/**
 * @route   GET /api/branch/:id
 * @desc    Get a single branch details
 */
exports.getBranchById = async (req, res) => {
  try {
    const { id } = req.params;
    const loggedCompanyId = getLoggedCompanyId(req);

    const branch = await getBranchModel().findOne({ _id: id, mainCompanyId: loggedCompanyId }).populate('headUserId', 'firstName lastName name email');
    if (!branch) {
      return res.status(404).json({ success: false, message: 'Branch not found' });
    }

    return res.json({
      success: true,
      item: branch
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch branch details', error: error.message });
  }
};

/**
 * @route   GET /api/branch/my
 * @desc    Alias for backward compatibility
 */
exports.getMyBranches = exports.getBranches;
