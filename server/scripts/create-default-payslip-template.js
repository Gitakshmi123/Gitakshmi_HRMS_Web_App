const mongoose = require('mongoose');
require('dotenv').config();

const getTenantDB = require('../utils/tenantDB');

async function createDefaultTemplate() {
    try {
        console.log('🔍 Creating Default Payslip Template...\n');

        // Connect to main DB
        const mongoUri = process.env.MONGO_URI;
        if (!mongoUri) {
            throw new Error('MONGO_URI not found in .env');
        }
        
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB\n');

        // Get all tenants
        const Tenant = mongoose.model('Tenant');
        const tenants = await Tenant.find().select('_id code name');
        
        if (tenants.length === 0) {
            console.log('❌ No tenants found in database');
            process.exit(1);
        }

        console.log(`📍 Found ${tenants.length} tenant(s)\n`);

        for (const tenant of tenants) {
            console.log(`Processing tenant: ${tenant.code} (${tenant.name})`);

            // Get tenant database
            const tenantDB = await getTenantDB(tenant._id.toString());
            const PayslipTemplate = tenantDB.model('PayslipTemplate');

            // Check if template already exists
            const existingCount = await PayslipTemplate.countDocuments({ tenant: tenant._id });

            if (existingCount > 0) {
                console.log(`  ⚠️  Already has ${existingCount} template(s), skipping...\n`);
                continue;
            }

            // Create a default builder template
            const defaultTemplate = new PayslipTemplate({
                tenant: tenant._id,
                name: 'Standard Payslip (Builder)',
                templateType: 'BUILDER',
                builderConfig: {
                    name: 'Standard Payslip',
                    sections: [
                        {
                            id: 'header-1',
                            type: 'company-header',
                            content: {
                                showLogo: true,
                                logoAlign: 'left',
                                companyNameSize: '24px',
                                showAddress: true
                            },
                            styles: { paddingBottom: '20px', borderBottom: '1px solid #e5e7eb' }
                        },
                        {
                            id: 'details-1',
                            type: 'employee-details-grid',
                            content: {
                                columns: 2,
                                fields: ['EMPLOYEE_NAME', 'EMPLOYEE_CODE', 'DEPARTMENT', 'DESIGNATION', 'DATE_OF_JOINING', 'PAN_NUMBER']
                            },
                            styles: { paddingTop: '20px', paddingBottom: '20px' }
                        },
                        {
                            id: 'earnings-1',
                            type: 'earnings-table',
                            content: {
                                title: 'Earnings',
                                showYTD: true
                            },
                            styles: { marginBottom: '20px' }
                        },
                        {
                            id: 'deductions-1',
                            type: 'deductions-table',
                            content: {
                                title: 'Deductions',
                                showYTD: true
                            },
                            styles: { marginBottom: '20px' }
                        },
                        {
                            id: 'net-pay-1',
                            type: 'net-pay-box',
                            content: {
                                title: 'Net Salary Payable',
                                bgColor: '#f9fafb',
                                textColor: '#111827'
                            },
                            styles: { marginTop: '20px' }
                        }
                    ],
                    styles: {
                        backgroundColor: '#ffffff',
                        fontFamily: 'Inter',
                        fontSize: '12px',
                        color: '#000000',
                        padding: '30px'
                    }
                },
                htmlContent: '<!-- BUILDER_GENERATED -->',
                isActive: true,
                isDefault: true
            });

            await defaultTemplate.save();
            console.log(`  ✅ Created default template!\n`);
        }

        console.log('✅ All tenants processed!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    }
}

createDefaultTemplate();
