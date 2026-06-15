function defaultLeaveDefinition() {
  return {
    steps: [
      {
        key: 'reporting_manager',
        name: 'Reporting Manager',
        order: 1,
        approvalMode: 'ANY',
        minApprovals: 1,
        slaHours: 24,
        approver: { type: 'REPORTING_MANAGER', value: null },
        fallbackApprover: { type: 'HR', value: 'hr' },
        conditions: [],
      },
      {
        key: 'hr',
        name: 'HR',
        order: 2,
        approvalMode: 'ANY',
        minApprovals: 1,
        slaHours: 24,
        approver: { type: 'HR', value: 'hr' },
        fallbackApprover: { type: 'ROLE', value: 'admin' },
        conditions: [{ field: 'leaveDays', operator: 'gt', value: 3 }],
      },
      {
        key: 'department_head',
        name: 'Department Head',
        order: 3,
        approvalMode: 'ANY',
        minApprovals: 1,
        slaHours: 24,
        approver: { type: 'DEPARTMENT_HEAD', value: null },
        fallbackApprover: { type: 'HR_HEAD', value: 'hr_head' },
        conditions: [{ field: 'leaveDays', operator: 'gt', value: 10 }],
      },
    ],
    rules: [],
    settings: {
      allowRequesterApproval: false,
      rejectPolicy: 'ANY_REJECTS',
    },
  };
}

function defaultRecruitmentLetterDefinition() {
  return {
    steps: [
      {
        key: 'department_head',
        name: 'Department Head',
        order: 1,
        approvalMode: 'ANY',
        minApprovals: 1,
        slaHours: 24,
        approver: { type: 'DEPARTMENT_HEAD', value: null },
        fallbackApprover: { type: 'HR_HEAD', value: 'hr_head' },
        conditions: [],
      },
      {
        key: 'ceo',
        name: 'CEO',
        order: 2,
        approvalMode: 'ANY',
        minApprovals: 1,
        slaHours: 24,
        approver: { type: 'CEO', value: null },
        fallbackApprover: { type: 'ROLE', value: 'admin' },
        conditions: [],
      },
    ],
    rules: [],
    settings: {
      allowRequesterApproval: false,
      rejectPolicy: 'ANY_REJECTS',
    },
  };
}

function defaultManpowerRequisitionDefinition() {
  return {
    steps: [
      {
        key: 'hr_head',
        name: 'HR Head Verification',
        order: 1,
        approvalMode: 'ANY',
        minApprovals: 1,
        slaHours: 24,
        approver: { type: 'HR_HEAD', value: 'hr_head' },
        fallbackApprover: { type: 'ROLE', value: 'admin' },
        conditions: [],
      },
      {
        key: 'project_head',
        name: 'Project Head / HOD Approval',
        order: 2,
        approvalMode: 'ANY',
        minApprovals: 1,
        slaHours: 48,
        approver: { type: 'DEPARTMENT_HEAD', value: null },
        fallbackApprover: { type: 'ROLE', value: 'admin' },
        conditions: [],
      },
    ],
    rules: [],
    settings: {
      allowRequesterApproval: false,
      rejectPolicy: 'ANY_REJECTS',
    },
  };
}

function getDefaultDefinition(moduleKey, entityType) {
  if (moduleKey === 'leave' && entityType === 'LeaveRequest') {
    return {
      name: 'Default Leave Approval',
      description: 'Reporting Manager followed by HR approval.',
      definition: defaultLeaveDefinition(),
    };
  }

  if ((moduleKey === 'recruitment' || moduleKey === 'letter') && entityType === 'GeneratedLetter') {
    return {
      name: 'Default Recruitment Letter Approval',
      description: 'Department Head followed by CEO approval.',
      definition: defaultRecruitmentLetterDefinition(),
    };
  }

  if (moduleKey === 'recruitment' && entityType === 'ManpowerRequisition') {
    return {
      name: 'Default Manpower Requisition Approval',
      description: 'HR Head verification followed by Project Head/HOD approval.',
      definition: defaultManpowerRequisitionDefinition(),
    };
  }

  return null;
}

module.exports = {
  getDefaultDefinition,
};
