// FIXED PREVIEW FUNCTION - Copy this to replace lines 1914-2239 in letter.controller.js

exports.previewJoiningLetter = async (req, res) => {
    try {
        const { applicantId, employeeId, templateId } = req.body;
        const Applicant = getApplicantModel(req);
        const { Employee, LetterTemplate } = getModels(req);

        console.log('🔥 [PREVIEW JOINING LETTER] Request received:', { applicantId, employeeId, templateId });

        // Validate input
        if (!templateId || (!applicantId && !employeeId)) {
            return res.status(400).json({ message: "templateId and (applicantId or employeeId) are required" });
        }

        // Fetch target
        let target, targetType;
        if (employeeId) {
            target = await Employee.findById(employeeId);
            targetType = 'employee';
        } else {
            target = await Applicant.findById(applicantId).populate('requirementId');
            targetType = 'applicant';
        }

        if (!target) {
            return res.status(404).json({ message: `${targetType === 'employee' ? 'Employee' : 'Applicant'} not found` });
        }

        // Check salary locked
        if (!target.salaryLocked) {
            return res.status(400).json({ message: "Salary must be confirmed and locked before generating joining letter." });
        }

        // Get template
        const templateQuery = { _id: templateId };
        if (req.user?.tenantId) templateQuery.tenantId = req.user.tenantId;
        const template = await LetterTemplate.findOne(templateQuery);

        if (!template || template.type !== 'joining' || template.templateType !== 'WORD') {
            return res.status(400).json({ message: "Invalid template" });
        }

        // Load template file
        const normalizedFilePath = normalizeFilePath(template.filePath);
        if (!fs.existsSync(normalizedFilePath)) {
            return res.status(404).json({ message: "Template file not found" });
        }

        const content = await fsPromises.readFile(normalizedFilePath);
        const zip = new PizZip(content);
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            nullGetter: function (tag) { return ''; },
            delimiters: { start: '{{', end: '}}' }
        });

        // Fetch salary snapshot from database
        const EmployeeSalarySnapshot = req.tenantDB.model('EmployeeSalarySnapshot');
        const query = employeeId ? { employee: employeeId } : { applicant: applicantId };
        let snapshot = await EmployeeSalarySnapshot.findOne(query).sort({ createdAt: -1 }).lean();

        if (!snapshot) {
            return res.status(400).json({ message: "Salary snapshot not found" });
        }

        console.log('✅ [PREVIEW JOINING LETTER] Found DB Snapshot:', {
            earningsCount: (snapshot.earnings || []).length,
            deductionsCount: (snapshot.employeeDeductions || []).length,
            benefitsCount: (snapshot.benefits || []).length,
            ctc: snapshot.ctc
        });

        // Use CTC structure builder
        const ctcStructureBuilder = require('../utils/ctcStructureBuilder');
        const ctcStructure = ctcStructureBuilder.buildCTCStructure(snapshot);
        const salaryComponents = ctcStructureBuilder.buildSalaryComponentsTable(snapshot);

        console.log('✅ [PREVIEW JOINING LETTER] CTC structure built:', Object.keys(ctcStructure).length, 'placeholders');

        // Prepare basic data
        const normalizedTarget = {
            ...(target.toObject ? target.toObject() : target),
            name: target.name || (target.firstName ? `${target.firstName} ${target.lastName || ''}`.trim() : ''),
            address: target.address || (target.tempAddress ? `${target.tempAddress.line1}, ${target.tempAddress.city}` : '')
        };
        const joiningLetterUtils = require('../utils/joiningLetterUtils');
        const basicData = joiningLetterUtils.mapOfferToJoiningData(normalizedTarget, {}, snapshot);

        // Build final data
        const finalData = {
            ...basicData,
            ...ctcStructure,
            salaryComponents: salaryComponents,
            salary_table_text_block: salaryComponents.map(r => `${r.name}\t${r.monthly}\t${r.yearly}`).join('\n'),
            SALARY_TABLE: salaryComponents.map(r => `${r.name}\t${r.monthly}\t${r.yearly}`).join('\n')
        };

        console.log('✅ [JOINING LETTER] keys injected:', Object.keys(finalData).length);

        // Render
        doc.render(finalData);

        // Generate DOCX
        const buf = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
        const fileName = `Preview_Joining_Letter_${employeeId || applicantId}_${Date.now()}`;
        const outputDir = path.join(__dirname, '../uploads/previews');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        const docxPath = path.join(outputDir, `${fileName}.docx`);
        await fsPromises.writeFile(docxPath, buf);

        // Convert to PDF
        const libreOfficeService = require('../services/LibreOfficeService');
        const pdfAbsolutePath = libreOfficeService.convertToPdfSync(docxPath, outputDir);
        const pdfFileName = path.basename(pdfAbsolutePath);
        const finalPdfUrl = `/uploads/previews/${pdfFileName}`;

        console.log('✅ [PREVIEW JOINING LETTER] PDF Preview Ready:', finalPdfUrl);

        res.json({
            success: true,
            previewUrl: finalPdfUrl,
            pdfUrl: finalPdfUrl
        });

    } catch (error) {
        console.error('🔥 [PREVIEW JOINING LETTER] ERROR:', error);
        res.status(500).json({
            message: `Preview Failed: ${error.message}`,
            error: error.message
        });
    }
};
