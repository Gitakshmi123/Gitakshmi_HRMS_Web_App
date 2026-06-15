import sys
import codecs

path = 'D:/Project/GT_HRMS/server/controllers/recruitment.workflow.controller.js'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

bgv_old = '''                // --- BGV Automation Hook ---
                if (application.jobId) {
                    const reqDoc = await Requirement.findById(application.jobId);
                    if (reqDoc && reqDoc.workflow) {
                        const bgvStage = reqDoc.workflow.find(w => w.stageName === 'BGV' && w.required);
                        if (bgvStage && !application.bgvStatus) {
                            application.bgvStatus = 'INITIATED';
                            
                            // Initialize BGV History
                            application.bgvHistory = [{
                                status: 'INITIATED',
                                date: new Date(),
                                updatedBy: 'System',
                                comments: 'Automatically initiated upon offer acceptance'
                            }];

                            // Generate BGV ID
                            try {
                                const { generateBGVCaseId } = require('../utils/bgvCaseId');
                                application.bgvId = await generateBGVCaseId(db, tenantId);
                            } catch (err) {
                                console.error('Error generating BGV ID:', err);
                            }
                        }
                    }
                }
                // --------------------------'''

bgv_new = '''                // --- BGV Automation Hook (POST_OFFER) ---
                if (application.jobId) {
                    const reqDoc = await Requirement.findById(application.jobId);
                    if (reqDoc && reqDoc.bgvConfig && reqDoc.bgvConfig.isEnabled && reqDoc.bgvConfig.triggerStage === 'POST_OFFER') {
                        if (!application.bgvStatus) {
                            application.bgvStatus = 'INITIATED';
                            
                            // Initialize BGV History
                            application.bgvHistory = [{
                                status: 'INITIATED',
                                date: new Date(),
                                updatedBy: 'System',
                                comments: 'Automatically initiated upon offer acceptance (POST_OFFER)'
                            }];

                            // Store specific checks requested
                            if (reqDoc.bgvConfig.checks && reqDoc.bgvConfig.checks.length > 0) {
                                application.bgvChecks = reqDoc.bgvConfig.checks;
                            }

                            // Generate BGV ID
                            try {
                                const { generateBGVCaseId } = require('../utils/bgvCaseId');
                                application.bgvId = await generateBGVCaseId(db, tenantId);
                            } catch (err) {
                                console.error('Error generating BGV ID:', err);
                            }
                        }
                    }
                }
                // ------------------------------------------'''

onboard_old = '''        // --- Onboarding Automation Hook ---
        if (application.jobId) {
            const reqDoc = await Requirement.findById(application.jobId);
            if (reqDoc && reqDoc.workflow) {
                const onboardingStage = reqDoc.workflow.find(w => w.stageName === 'Onboarding' && w.required);
                if (onboardingStage) {
                    // Try to trigger onboarding tasks from default template
                    try {
                        const Task = db.model('Task');
                        const TaskTemplate = db.model('TaskTemplate');
                        const defaultTemplate = await TaskTemplate.findOne({ name: 'Default Onboarding', tenant: tenantId });
                        if (defaultTemplate) {
                            const tasks = defaultTemplate.tasks.map(t => ({
                                tenant: tenantId,
                                title: t.title,
                                description: t.description,
                                assignee: employee._id, // Assign to the new employee
                                dueDate: new Date(Date.now() + (t.daysToComplete * 24 * 60 * 60 * 1000)),
                                status: 'Pending',
                                taskType: 'Onboarding',
                                relatedTo: {
                                    model: 'Employee',
                                    id: employee._id
                                }
                            }));
                            await Task.insertMany(tasks, { session });
                        }
                    } catch (taskErr) {
                        console.error('Error generating onboarding tasks:', taskErr);
                    }
                }
            }
        }
        // ---------------------------------'''

onboard_new = '''        // --- BGV & Onboarding Automation Hooks ---
        if (application.jobId) {
            const reqDoc = await Requirement.findById(application.jobId);
            if (reqDoc) {
                // 1. Post-Joining BGV Trigger
                if (reqDoc.bgvConfig && reqDoc.bgvConfig.isEnabled && reqDoc.bgvConfig.triggerStage === 'POST_JOINING') {
                    if (!application.bgvStatus) {
                        application.bgvStatus = 'INITIATED';
                        application.bgvHistory = [{
                            status: 'INITIATED',
                            date: new Date(),
                            updatedBy: 'System',
                            comments: 'Automatically initiated upon employee conversion (POST_JOINING)'
                        }];
                        if (reqDoc.bgvConfig.checks && reqDoc.bgvConfig.checks.length > 0) {
                            application.bgvChecks = reqDoc.bgvConfig.checks;
                        }
                        try {
                            const { generateBGVCaseId } = require('../utils/bgvCaseId');
                            application.bgvId = await generateBGVCaseId(db, tenantId);
                        } catch (err) {
                            console.error('Error generating BGV ID:', err);
                        }
                        await application.save({ session });
                    }
                }

                // 2. Onboarding Tasks Trigger
                if (reqDoc.onboardingConfig && reqDoc.onboardingConfig.templateId) {
                    try {
                        const Task = db.model('Task');
                        const TaskTemplate = db.model('TaskTemplate');
                        
                        // Fetch the SPECIFIC template chosen in the UI
                        const template = await TaskTemplate.findOne({ 
                            _id: reqDoc.onboardingConfig.templateId, 
                            tenant: tenantId 
                        });
                        
                        if (template) {
                            const tasks = template.tasks.map(t => ({
                                tenant: tenantId,
                                title: t.title,
                                description: t.description,
                                assignee: employee._id, // Assign to the new employee
                                dueDate: new Date(Date.now() + (t.daysToComplete * 24 * 60 * 60 * 1000)),
                                status: 'Pending',
                                taskType: 'Onboarding',
                                relatedTo: {
                                    model: 'Employee',
                                    id: employee._id
                                }
                            }));
                            if (tasks.length > 0) {
                                await Task.insertMany(tasks, { session });
                            }
                        }
                    } catch (taskErr) {
                        console.error('Error generating onboarding tasks:', taskErr);
                    }
                }
            }
        }
        // -----------------------------------------'''

content = content.replace(bgv_old, bgv_new)
content = content.replace(onboard_old, onboard_new)

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
print('Automation logic successfully updated to use Requirement configs!')
