const mongoose = require('mongoose');
const { sendTemplatedEmail } = require('./template.service');

function getByPath(source, pathValue) {
    if (!source || !pathValue) return undefined;
    return String(pathValue).split('.').reduce((value, part) => (value == null ? undefined : value[part]), source);
}

function slugify(value, fallback = 'step') {
    const slug = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return slug || fallback;
}

function buildApprovalDefinition(config = {}) {
    const configuredSteps = Array.isArray(config.approvalSteps) && config.approvalSteps.length
        ? config.approvalSteps
        : [{
            name: config.stepName || 'Reporting Manager Approval',
            approverType: config.approverType || config.relationshipKey || 'REPORTING_MANAGER',
            approverValue: config.approverValue || config.relationshipKey || null,
            slaHours: config.slaHours || 24,
            emailTriggerType: config.emailTriggerType || '',
            emailToField: config.emailToField || 'assignee.email',
        }];

    const steps = configuredSteps.map((step, index) => {
        const approverType = String(step.approverType || step.relationshipKey || 'REPORTING_MANAGER').toUpperCase();
        const approverValue = step.approverValue || step.relationshipKey || null;
        return {
            key: step.key || `${slugify(step.name || approverType, 'approval')}_${index + 1}`,
            name: step.name || `Approval Phase ${index + 1}`,
            order: index + 1,
            approvalMode: step.approvalMode || 'ANY',
            minApprovals: Number(step.minApprovals || 1),
            slaHours: Number(step.slaHours || 24),
            approver: {
                type: approverType === 'ROLE' ? 'ROLE' : approverType,
                value: approverValue,
            },
            fallbackApprover: step.fallbackApproverType ? {
                type: step.fallbackApproverType,
                value: step.fallbackApproverValue || null,
            } : undefined,
            conditions: step.conditions || [],
            notification: {
                enabled: !!step.emailTriggerType,
                triggerType: step.emailTriggerType || '',
                toEmailField: step.emailToField || 'assignee.email',
            },
        };
    });

    return {
        steps,
        rules: config.rules || [],
        settings: {
            allowRequesterApproval: config.allowRequesterApproval === true,
            rejectPolicy: config.rejectPolicy || 'ANY_REJECTS',
        },
    };
}

/**
 * Evaluates a single condition
 */
function evaluateCondition(condition, contextData) {
    const { field, operator, value } = condition;

    // Allow dot notation to fetch nested fields, e.g. "candidate.department"
    let contextValue = contextData;
    if (field) {
        const parts = field.split('.');
        for (const part of parts) {
            if (contextValue === null || contextValue === undefined) break;
            contextValue = contextValue[part];
        }
    }

    switch(operator) {
        case 'equals': return contextValue === value;
        case 'not_equals': return contextValue !== value;
        case 'contains': return String(contextValue || '').includes(String(value || ''));
        case 'greater_than': return Number(contextValue) > Number(value);
        case 'less_than': return Number(contextValue) < Number(value);
        default: return false; // Unknown operator
    }
}

/**
 * Execute actions defined in an automation rule
 */
async function executeActions(tenantId, actions, contextData) {
    // Sort actions by order
    const sortedActions = [...actions].sort((a, b) => (a.order || 0) - (b.order || 0));

    for (const action of sortedActions) {
        try {
            console.log(`[AutomationEngine] Executing action ${action.type}`);
            switch (action.type) {
                case 'SEND_EMAIL': {
                    const { triggerType, toEmailField } = action.config;
                    // resolve toEmail from contextData
                    let toEmail = getByPath(contextData, toEmailField) || toEmailField; // Fallback to direct string if it's not a field

                    if (toEmailField && toEmailField.includes('.')) {
                        const parts = toEmailField.split('.');
                        let val = contextData;
                        for (const part of parts) {
                            if (!val) break;
                            val = val[part];
                        }
                        toEmail = val;
                    }

                    if (toEmail && triggerType) {
                        await sendTemplatedEmail(tenantId, triggerType, contextData, toEmail);
                    }
                    break;
                }
                case 'TRIGGER_APPROVAL': {
                    console.log('[AutomationEngine] TRIGGER_APPROVAL action fired');
                    const config = action.config || {};
                    const moduleKey = config.moduleKey || 'leave';
                    const entityType = config.entityType || 'LeaveRequest';
                    const requesterEmployeeField = config.requesterEmployeeField || 'employeeId';

                    let requesterEmployeeId = null;
                    requesterEmployeeId = getByPath(contextData, requesterEmployeeField);
                    if (!requesterEmployeeId && contextData) {
                        requesterEmployeeId = contextData.employeeId || contextData.employee?._id || contextData.employee || contextData.requesterEmployeeId;
                    }

                    const workflowStartService = require('./workflowStart.service');
                    const getTenantDB = require('../utils/tenantDB');
                    const tenantDB = await getTenantDB(tenantId);

                    if (tenantDB) {
                        const entityId = contextData?._id || contextData?.entityId;
                        const definitionOverride = buildApprovalDefinition(config);
                        console.log(`[AutomationEngine] Starting workflow for module: ${moduleKey}, entity: ${entityType}, id: ${entityId}`);
                        const startResult = await workflowStartService.startWorkflow({
                            tenantDB,
                            tenantId,
                            moduleKey,
                            entityType,
                            entityId,
                            requesterEmployeeId,
                            contextSnapshot: {
                                ...contextData,
                                automationApproval: {
                                    workflowName: config.workflowName,
                                    approvalSteps: definitionOverride.steps.map((step) => ({
                                        key: step.key,
                                        name: step.name,
                                        approver: step.approver,
                                        slaHours: step.slaHours,
                                        notification: step.notification,
                                    })),
                                },
                            },
                            definitionOverride,
                            workflowName: config.workflowName || `Automation: ${moduleKey} ${entityType}`
                        });
                        console.log('[AutomationEngine] Workflow start result:', startResult);

                        if (startResult?.started && startResult?.instance?._id) {
                            const instId = startResult.instance._id;
                            try {
                                if (entityType === 'LeaveRequest') {
                                    const LeaveRequest = tenantDB.model('LeaveRequest');
                                    await LeaveRequest.findByIdAndUpdate(entityId, {
                                        $set: {
                                            'meta.workflowInstanceId': instId,
                                            'meta.workflowStartStatus': 'STARTED'
                                        }
                                    });
                                    console.log('[AutomationEngine] LeaveRequest metadata updated with workflowInstanceId');
                                } else if (entityType === 'GeneratedLetter') {
                                    const GeneratedLetter = tenantDB.model('GeneratedLetter');
                                    await GeneratedLetter.findByIdAndUpdate(entityId, {
                                        $set: {
                                            workflowInstanceId: instId,
                                            workflowStatus: 'PENDING',
                                            approvalStatus: 'PENDING_APPROVAL'
                                        }
                                    });
                                    console.log('[AutomationEngine] GeneratedLetter updated with workflowInstanceId');
                                } else {
                                    const Model = tenantDB.model(entityType);
                                    const doc = await Model.findById(entityId);
                                    if (doc) {
                                        if (doc.meta) {
                                            doc.meta.workflowInstanceId = instId;
                                            doc.meta.workflowStartStatus = 'STARTED';
                                            doc.markModified('meta');
                                        } else {
                                            doc.workflowInstanceId = instId;
                                            doc.workflowStatus = 'PENDING';
                                        }
                                        await doc.save();
                                        console.log(`[AutomationEngine] Generic ${entityType} updated with workflowInstanceId`);
                                    }
                                }
                            } catch (entityErr) {
                                console.error('[AutomationEngine] Error updating entity with workflow instance link:', entityErr);
                            }
                        }
                    }
                    break;
                }
                case 'WEBHOOK': {
                    // Trigger a webhook URL
                    console.log('[AutomationEngine] WEBHOOK action fired');
                    break;
                }
                case 'ASSIGN_TASK': {
                    // Assign a task
                    console.log('[AutomationEngine] ASSIGN_TASK action fired');
                    break;
                }
                default:
                    console.log(`[AutomationEngine] Unhandled action type: ${action.type}`);
            }
        } catch (err) {
            console.error(`[AutomationEngine] Error executing action ${action.type}:`, err);
        }
    }
}

/**
 * Dispatch an event to evaluate and trigger automations
 * @param {ObjectId} tenantId
 * @param {String} triggerEvent e.g., 'OFFER_LETTER_REQUESTED'
 * @param {Object} contextData Data available to evaluate conditions and execute actions
 */
async function dispatchEvent(tenantId, triggerEvent, contextData) {
    console.log(`[AutomationEngine] Dispatching event: ${triggerEvent} for tenant ${tenantId}`);
    try {
        let Automation = null;
        try {
            const getTenantDB = require('../utils/tenantDB');
            const tenantDB = await getTenantDB(tenantId);
            if (tenantDB) {
                if (!tenantDB.models.Automation) {
                    tenantDB.model('Automation', require('../models/Automation'));
                }
                Automation = tenantDB.model('Automation');
            }
        } catch (tenantModelErr) {
            console.warn('[AutomationEngine] Falling back to master Automation model:', tenantModelErr.message);
        }
        if (!Automation) {
            Automation = mongoose.models.Automation
                ? mongoose.model('Automation')
                : mongoose.model('Automation', require('../models/Automation'));
        }

        const automations = await Automation.find({
            tenantId,
            triggerEvent,
            isActive: true
        }).lean();

        for (const automation of automations) {
            // Evaluate conditions. If there are no conditions, it passes by default.
            let allConditionsMet = true;
            if (automation.conditions && automation.conditions.length > 0) {
                allConditionsMet = automation.conditions.every(cond => evaluateCondition(cond, contextData));
            }

            if (allConditionsMet && automation.actions && automation.actions.length > 0) {
                console.log(`[AutomationEngine] Conditions met for automation: ${automation.name}. Executing...`);
                await executeActions(tenantId, automation.actions, contextData);
            }
        }
    } catch (err) {
        console.error('[AutomationEngine] Error dispatching event:', err);
    }
}

module.exports = {
    dispatchEvent
};
