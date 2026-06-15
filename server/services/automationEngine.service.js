const mongoose = require('mongoose');
const { sendTemplatedEmail } = require('./template.service');
// You can also require workflow/approval services here later for TRIGGER_APPROVAL action

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
                    let toEmail = contextData[toEmailField] || toEmailField; // Fallback to direct string if it's not a field
                    
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
                    // Logic to create an approval workflow instance
                    console.log('[AutomationEngine] TRIGGER_APPROVAL action fired');
                    // Example: await approvalService.initiateApproval(tenantId, action.config.workflowId, contextData.entityId);
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
        // Find all active automations for this tenant and event
        const Automation = mongoose.model('Automation');
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
                // Execute in background
                executeActions(tenantId, automation.actions, contextData).catch(err => {
                    console.error('[AutomationEngine] executeActions background error:', err);
                });
            }
        }
    } catch (err) {
        console.error('[AutomationEngine] Error dispatching event:', err);
    }
}

module.exports = {
    dispatchEvent
};
