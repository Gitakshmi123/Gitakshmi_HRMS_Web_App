import sys
path = 'D:/Project/GT_HRMS/server/controllers/recruitment.workflow.controller.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

bgv_old = '''            const application = await Application.findById(offer.applicationId);
            if (application) {
                application.acceptOffer();
                application.offerAcceptedDate = new Date();
                await application.save({ session });
            }'''

bgv_new = '''            const application = await Application.findById(offer.applicationId);
            if (application) {
                application.acceptOffer();
                application.offerAcceptedDate = new Date();
                
                // --- BGV Automation Hook ---
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
                // --------------------------

                await application.save({ session });
            }'''

onboard_old = '''        const employee = new Employee(employeeData);
        await employee.save({ session });

        // Update application
        application.changeStatus('JOINED', user._id, user.name, 'Converted to Employee');
        application.employeeId = employee._id;'''

onboard_new = '''        const employee = new Employee(employeeData);
        await employee.save({ session });

        // --- Onboarding Automation Hook ---
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
        // ---------------------------------

        // Update application
        application.changeStatus('JOINED', user._id, user.name, 'Converted to Employee');
        application.employeeId = employee._id;'''

content = content.replace(bgv_old, bgv_new)
content = content.replace(onboard_old, onboard_new)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Automation logic added')
