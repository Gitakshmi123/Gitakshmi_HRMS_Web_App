const leaveManagementService = require('../leaveManagement.service');

function recalculateAvailable(balance) {
  if (!balance || typeof balance.total !== 'number') return;
  balance.available = Math.max(0, (balance.total || 0) - (balance.used || 0) - (balance.pending || 0));
}

async function refreshLeaveSnapshot({ tenantDB, employeeId, tenantId, year }) {
  try {
    const Employee = tenantDB.model('Employee');
    const LeaveBalance = tenantDB.model('LeaveBalance');
    const employee = await Employee.findById(employeeId);
    if (!employee) return;
    await leaveManagementService.syncEmployeeLeaveSnapshotFromDocuments({
      employee,
      tenantId,
      LeaveBalance,
      year,
    });
  } catch (_) {
    // Snapshot refresh should not block workflow completion.
  }
}

async function syncLeaveToAttendance({ tenantDB, tenantId, leaveRequest }) {
  const Attendance = tenantDB.model('Attendance');
  const LeavePolicy = tenantDB.model('LeavePolicy');
  const Employee = tenantDB.model('Employee');
  const start = new Date(leaveRequest.startDate);
  const end = new Date(leaveRequest.endDate);
  let color = '#3b82f6';

  try {
    const employee = await Employee.findById(leaveRequest.employee).select('leavePolicy').lean();
    if (employee?.leavePolicy) {
      const policy = await LeavePolicy.findById(employee.leavePolicy).lean();
      const rule = policy?.rules?.find((item) => item?.leaveType === leaveRequest.leaveType);
      if (rule?.color) color = rule.color;
    }
  } catch (_) {
    // Keep default color.
  }

  const halfDayTargetDate = leaveRequest.halfDayTarget === 'End'
    ? new Date(end)
    : new Date(start);
  halfDayTargetDate.setHours(0, 0, 0, 0);

  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const date = new Date(cursor);
    date.setHours(0, 0, 0, 0);
    const isHalf = leaveRequest.isHalfDay && date.getTime() === halfDayTargetDate.getTime();

    await Attendance.findOneAndUpdate(
      { tenant: tenantId, employee: leaveRequest.employee, date },
      {
        status: isHalf ? 'half_day' : 'leave',
        leaveType: leaveRequest.leaveType,
        leaveColor: color,
      },
      { upsert: true, new: true }
    );
  }
}

async function notifyEmployee({ tenantDB, tenantId, leaveRequest, status, comment }) {
  try {
    const Notification = tenantDB.model('Notification');
    const approved = status === 'APPROVED';
    await Notification.create({
      tenant: tenantId,
      receiverId: leaveRequest.employee,
      receiverRole: 'employee',
      entityType: 'LeaveRequest',
      entityId: leaveRequest._id,
      title: approved ? 'Leave Approved' : 'Leave Rejected',
      message: approved
        ? `Your ${leaveRequest.leaveType} leave request has been approved.`
        : `Your ${leaveRequest.leaveType} leave request was rejected.${comment ? ` Remark: ${comment}` : ''}`,
    });
  } catch (_) {
    // Notifications are best-effort.
  }
}

async function finalizeLeaveWorkflow({
  tenantDB,
  tenantId,
  entityId,
  status,
  actorEmployeeId,
  actorUserId,
  comment = '',
}) {
  const LeaveRequest = tenantDB.model('LeaveRequest');
  const LeaveBalance = tenantDB.model('LeaveBalance');

  const leaveRequest = await LeaveRequest.findOne({ _id: entityId, tenant: tenantId });
  if (!leaveRequest) {
    throw new Error('Leave request not found for workflow finalization.');
  }

  if (!['Pending', 'Approved', 'Rejected'].includes(leaveRequest.status)) {
    throw new Error(`Cannot finalize leave request with status ${leaveRequest.status}.`);
  }

  if (leaveRequest.status === 'Approved' || leaveRequest.status === 'Rejected') {
    return leaveRequest;
  }

  const year = new Date(leaveRequest.startDate).getFullYear();
  const paidDays = Number(leaveRequest.paidLeaveDays || 0);
  const balance = paidDays > 0
    ? await LeaveBalance.findOne({
      tenant: tenantId,
      employee: leaveRequest.employee,
      leaveType: leaveRequest.leaveType,
      year,
    })
    : null;

  if (balance && paidDays > 0) {
    balance.pending = Math.max(0, (balance.pending || 0) - paidDays);
    if (status === 'APPROVED') {
      balance.used = (balance.used || 0) + paidDays;
    }
    recalculateAvailable(balance);
    await balance.save();
    await refreshLeaveSnapshot({ tenantDB, employeeId: leaveRequest.employee, tenantId, year });
  }

  if (status === 'APPROVED') {
    leaveRequest.status = 'Approved';
    leaveRequest.approvedAt = new Date();
    leaveRequest.actionBy = actorEmployeeId || actorUserId;
    leaveRequest.adminRemark = comment || 'Approved through workflow engine';
    leaveRequest.meta = {
      ...(leaveRequest.meta || {}),
      workflowFinalStatus: 'APPROVED',
      workflowFinalizedAt: new Date(),
    };
    await leaveRequest.save();
    await syncLeaveToAttendance({ tenantDB, tenantId, leaveRequest });
    await notifyEmployee({ tenantDB, tenantId, leaveRequest, status, comment });

    try {
      const { dispatchEvent } = require('../automationEngine.service');
      await dispatchEvent(tenantId, 'LEAVE_APPROVED', leaveRequest.toObject ? leaveRequest.toObject() : leaveRequest);
    } catch (dispatchErr) {
      console.error('[leaveWorkflow.adapter] LEAVE_APPROVED dispatch error:', dispatchErr);
    }

    return leaveRequest;
  }

  if (status === 'REJECTED') {
    leaveRequest.status = 'Rejected';
    leaveRequest.rejectedAt = new Date();
    leaveRequest.actionBy = actorEmployeeId || actorUserId;
    leaveRequest.rejectionReason = comment || 'Rejected through workflow engine';
    leaveRequest.adminRemark = comment || 'Rejected through workflow engine';
    leaveRequest.meta = {
      ...(leaveRequest.meta || {}),
      workflowFinalStatus: 'REJECTED',
      workflowFinalizedAt: new Date(),
    };
    await leaveRequest.save();
    await notifyEmployee({ tenantDB, tenantId, leaveRequest, status, comment });

    try {
      const { dispatchEvent } = require('../automationEngine.service');
      await dispatchEvent(tenantId, 'LEAVE_REJECTED', leaveRequest.toObject ? leaveRequest.toObject() : leaveRequest);
    } catch (dispatchErr) {
      console.error('[leaveWorkflow.adapter] LEAVE_REJECTED dispatch error:', dispatchErr);
    }

    return leaveRequest;
  }

  return leaveRequest;
}

module.exports = {
  finalizeLeaveWorkflow,
};
