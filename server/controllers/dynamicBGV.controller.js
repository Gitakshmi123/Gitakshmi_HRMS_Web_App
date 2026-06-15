const mongoose = require('mongoose');
const BGVCase = require('../models/BGVCase');
const BGVCheck = require('../models/BGVCheck');
const BGVLog = require('../models/BGVLog');
const { getModels: getRecruitmentModels } = require('../services/onboarding.service');

exports.initiateBGV = async (req, res) => {
  try {
    const { candidateId, jobId, checks, slaDays } = req.body;
    const tenantId = req.tenantId;

    if (!candidateId || !checks || checks.length === 0) {
      return res.status(400).json({ success: false, message: 'Candidate and checks are required' });
    }

    // Create BGV Case
    const bgvCase = await BGVCase.create({
      caseId: `BGV-${Date.now()}`,
      tenant: tenantId,
      candidateId,
      jobId,
      checksRequested: checks.map(type => ({ type, status: 'PENDING' })),
      sla: {
        targetDays: slaDays || 7,
        dueDate: new Date(Date.now() + (slaDays || 7) * 24 * 60 * 60 * 1000)
      },
      initiatedBy: req.user.id,
      overallStatus: 'PENDING'
    });

    // Spawn individual BGV Checks
    const checkPromises = checks.map(type => 
      BGVCheck.create({
        caseId: bgvCase._id,
        tenant: tenantId,
        type: type.toUpperCase(),
        status: 'PENDING',
        mode: 'MANUAL',
        assignedTo: req.user.id
      })
    );

    const createdChecks = await Promise.all(checkPromises);

    // Update case with check IDs
    bgvCase.checksRequested = createdChecks.map(check => ({
      type: check.type,
      checkId: check._id,
      status: 'PENDING'
    }));
    await bgvCase.save();

    // Log the initiation
    await BGVLog.create({
      tenant: tenantId,
      caseId: bgvCase._id,
      action: 'BGV_INITIATED',
      description: `BGV case initiated with ${checks.length} checks`,
      performedBy: req.user.id
    });

    res.status(201).json({ success: true, bgvCase });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateCheckStatus = async (req, res) => {
  try {
    const { checkId } = req.params;
    const { status, remarks, documents, riskScore } = req.body;
    const tenantId = req.tenantId;

    const check = await BGVCheck.findOne({ _id: checkId, tenant: tenantId });
    if (!check) return res.status(404).json({ success: false, message: 'Check not found' });

    const oldStatus = check.status;
    check.status = status;
    if (remarks) check.remarks = remarks;
    if (documents) check.documents = documents;
    await check.save();

    // Update Case status and result
    const bgvCase = await BGVCase.findById(check.caseId);
    const caseCheck = bgvCase.checksRequested.find(c => String(c.checkId) === String(check._id));
    if (caseCheck) caseCheck.status = status;

    // Check if all checks are completed
    const allChecks = await BGVCheck.find({ caseId: bgvCase._id });
    const allDone = allChecks.every(c => ['COMPLETED', 'VERIFIED', 'FAILED'].includes(c.status));
    
    if (allDone) {
      bgvCase.overallStatus = 'COMPLETED';
      bgvCase.completedAt = new Date();
      
      const anyFailed = allChecks.some(c => c.status === 'FAILED');
      bgvCase.overallResult = anyFailed ? 'FAILED' : 'CLEAR';
    } else {
      bgvCase.overallStatus = 'IN_PROGRESS';
    }

    if (riskScore) bgvCase.riskScore = riskScore;
    await bgvCase.save();

    // Log the update
    await BGVLog.create({
      tenant: tenantId,
      caseId: bgvCase._id,
      checkId: check._id,
      action: 'CHECK_UPDATED',
      description: `Check ${check.type} updated to ${status}`,
      performedBy: req.user.id,
      oldStatus,
      newStatus: status,
      metadata: { remarks, riskScore }
    });

    res.json({ success: true, check, bgvCase });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCaseDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;

    const bgvCase = await BGVCase.findOne({ _id: id, tenant: tenantId })
      .populate('checksRequested.checkId')
      .populate('initiatedBy', 'name email');

    if (!bgvCase) return res.status(404).json({ success: false, message: 'Case not found' });

    const logs = await BGVLog.find({ caseId: id }).sort({ createdAt: -1 });

    res.json({ success: true, bgvCase, logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
