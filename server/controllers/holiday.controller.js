const HolidaySchema = require('../models/Holiday');
const AuditLogSchema = require('../models/AuditLog');
const XLSX = require('@sheetjs/xlsx');
const fs = require('fs');
const path = require('path');

const getModels = (req) => {
    const db = req.tenantDB;
    if (!db) throw new Error("Tenant database connection not available");
    return {
        Holiday: db.model('Holiday', HolidaySchema),
        AuditLog: db.model('AuditLog', AuditLogSchema)
    };
};

// Helper: Parse Excel file and extract holidays
const parseExcelFile = (filePath) => {
    try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Read formatted values to strictly check the visual format (DD-MM-YYYY)
        const data = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            raw: false, // Get formatted values as strings
            dateNF: 'dd-mm-yyyy' // Suggest format if possible, but we'll validate strictly
        });

        const holidays = [];
        const errors = [];

        // Date format regex: DD-MM-YYYY
        const ddmmyyyyRegex = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0 || !row[0]) continue;

            try {
                const name = String(row[0] || '').trim();
                const dateStr = String(row[1] || '').trim(); // Formatted date string
                const type = String(row[2] || 'Public').trim();
                const description = String(row[3] || '').trim();

                if (!name) {
                    errors.push({ row: i + 1, error: 'Holiday name is required' });
                    continue;
                }

                if (!dateStr) {
                    errors.push({ row: i + 1, error: 'Date is required' });
                    continue;
                }

                // Strict validation for DD-MM-YYYY
                const match = dateStr.match(ddmmyyyyRegex);
                if (!match) {
                    errors.push({
                        row: i + 1,
                        error: `Invalid date format: "${dateStr}". Please use DD-MM-YYYY.`
                    });
                    continue;
                }

                // Safely parse DD-MM-YYYY
                const day = parseInt(match[1], 10);
                const month = parseInt(match[2], 10);
                const year = parseInt(match[3], 10);

                // Construct date and validate
                // We use noon to avoid any timezone shifting to the previous day during setHours(0)
                const date = new Date(year, month - 1, day, 12, 0, 0);

                if (isNaN(date.getTime()) ||
                    date.getDate() !== day ||
                    date.getMonth() !== (month - 1) ||
                    date.getFullYear() !== year) {
                    errors.push({ row: i + 1, error: `Invalid date: "${dateStr}"` });
                    continue;
                }

                // Normalize to start of day
                date.setHours(0, 0, 0, 0);

                // Range validation
                if (year < 1900 || year > 2100) {
                    errors.push({ row: i + 1, error: `Year ${year} out of range (1900-2100)` });
                    continue;
                }

                const validTypes = ['Public', 'Optional', 'Company', 'National', 'Festival'];
                const holidayType = validTypes.includes(type) ? type : 'Public';

                holidays.push({
                    name,
                    date: date.toISOString(),
                    type: holidayType,
                    description
                });
            } catch (err) {
                errors.push({ row: i + 1, error: err.message || 'Error parsing row' });
            }
        }

        return { holidays, errors };
    } catch (error) {
        throw new Error(`Failed to parse Excel file: ${error.message}`);
    }
};

// GET ALL HOLIDAYS (Branch-aware – returns branch-specific + tenant-wide)
exports.getHolidays = async (req, res) => {
    try {
        const { Holiday } = getModels(req);
        const { year } = req.query;

        let query = { tenant: req.tenantId };

        if (year) {
            const startOfYear = new Date(year, 0, 1);
            const endOfYear = new Date(year, 11, 31, 23, 59, 59);
            query.date = { $gte: startOfYear, $lte: endOfYear };
        }

        const holidays = await Holiday.find(query).sort({ date: 1 });
        res.json(holidays);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// CREATE HOLIDAY (HR Only) - with audit logging
exports.createHoliday = async (req, res) => {
    try {
        const { Holiday, AuditLog } = getModels(req);
        const { name, date, type, description } = req.body;

        if (!name || !date) {
            return res.status(400).json({ error: "Holiday name and date are required" });
        }

        const holiday = new Holiday({
            tenant: req.tenantId,
            name,
            date,
            type: type || 'Public',
            description
        });

        await holiday.save();

        // Audit log the creation
        const auditLog = new AuditLog({
            tenant: req.tenantId,
            entity: 'Holiday',
            entityId: holiday._id,
            action: 'HOLIDAY_CREATED',
            performedBy: req.user.id,
            changes: {
                before: null,
                after: holiday.toObject()
            },
            meta: { holidayName: name, holidayDate: date }
        });
        await auditLog.save();

        res.status(201).json({ message: "Holiday created successfully", data: holiday });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ error: "A holiday already exists for this date in this branch" });
        }
        res.status(500).json({ error: error.message });
    }
};

// UPDATE HOLIDAY (HR Only) - with audit logging
exports.updateHoliday = async (req, res) => {
    try {
        const { Holiday, AuditLog } = getModels(req);
        const { id } = req.params;
        const { name, date, type, description } = req.body;

        const holiday = await Holiday.findOne({ _id: id, tenant: req.tenantId });
        if (!holiday) {
            return res.status(404).json({ error: "Holiday not found" });
        }

        const before = holiday.toObject();

        // Update fields
        if (name) holiday.name = name;
        if (date) holiday.date = date;
        if (type) holiday.type = type;
        if (description !== undefined) holiday.description = description;

        await holiday.save();

        // Audit log the update
        const auditLog = new AuditLog({
            tenant: req.tenantId,
            entity: 'Holiday',
            entityId: holiday._id,
            action: 'HOLIDAY_UPDATED',
            performedBy: req.user.id,
            changes: {
                before,
                after: holiday.toObject()
            },
            meta: { holidayName: holiday.name }
        });
        await auditLog.save();

        res.json({ message: "Holiday updated successfully", data: holiday });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ error: "A holiday already exists for this date" });
        }
        res.status(500).json({ error: error.message });
    }
};

// DELETE HOLIDAY (HR Only) - with audit logging
exports.deleteHoliday = async (req, res) => {
    try {
        const { Holiday, AuditLog } = getModels(req);
        const { id } = req.params;

        const holiday = await Holiday.findOne({ _id: id, tenant: req.tenantId });
        if (!holiday) {
            return res.status(404).json({ error: "Holiday not found" });
        }

        const before = holiday.toObject();
        await Holiday.deleteOne({ _id: id, tenant: req.tenantId });

        // Audit log the deletion
        const auditLog = new AuditLog({
            tenant: req.tenantId,
            entity: 'Holiday',
            entityId: id,
            action: 'HOLIDAY_DELETED',
            performedBy: req.user.id,
            changes: {
                before,
                after: null
            },
            meta: { holidayName: holiday.name, holidayDate: holiday.date }
        });
        await auditLog.save();

        res.json({ message: "Holiday deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// BULK UPLOAD PREVIEW (HR Only) - Parse file and show preview
exports.bulkUploadPreview = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const { Holiday } = getModels(req);
        const filePath = req.file.path;
        const fileExt = path.extname(req.file.originalname).toLowerCase();

        if (!['.xlsx', '.xls', '.csv'].includes(fileExt)) {
            // Clean up uploaded file
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return res.status(400).json({ error: "Only Excel (.xlsx, .xls) and CSV files are supported" });
        }

        // Parse the file
        const { holidays, errors } = parseExcelFile(filePath);

        if (holidays.length === 0 && errors.length === 0) {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return res.status(400).json({ error: "No valid holiday data found in file" });
        }

        // Check for duplicates with existing holidays
        const existingHolidays = await Holiday.find({ tenant: req.tenantId });
        const existingDates = new Set(
            existingHolidays.map(h => new Date(h.date).toISOString().split('T')[0])
        );

        const preview = holidays.map((holiday, index) => {
            const dateStr = new Date(holiday.date).toISOString().split('T')[0];
            const isDuplicate = existingDates.has(dateStr);
            return {
                ...holiday,
                _previewId: `preview-${index}`,
                isDuplicate,
                existingHoliday: isDuplicate ? existingHolidays.find(h =>
                    new Date(h.date).toISOString().split('T')[0] === dateStr
                ) : null
            };
        });

        // Store preview data temporarily (in real app, use Redis or session)
        // For now, we'll pass it back and client will send it to confirm endpoint
        // Clean up file after parsing
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        res.json({
            preview,
            errors,
            summary: {
                total: holidays.length,
                duplicates: preview.filter(p => p.isDuplicate).length,
                new: preview.filter(p => !p.isDuplicate).length,
                errors: errors.length
            }
        });
    } catch (error) {
        // Clean up file on error
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: error.message });
    }
};

// BULK UPLOAD CONFIRM (HR Only) - Save holidays after preview
exports.bulkUploadConfirm = async (req, res) => {
    try {
        const { Holiday, AuditLog } = getModels(req);
        const { holidays, skipDuplicates = true } = req.body;

        if (!holidays || !Array.isArray(holidays) || holidays.length === 0) {
            return res.status(400).json({ error: "No holidays data provided" });
        }

        const saved = [];
        const skipped = [];
        const errors = [];

        for (const holidayData of holidays) {
            try {
                const { name, date, type, description, isDuplicate, _previewId } = holidayData;

                if (!name || !date) {
                    errors.push({ holiday: holidayData, error: "Name and date are required" });
                    continue;
                }

                // Skip duplicates if flag is set
                if (isDuplicate && skipDuplicates) {
                    skipped.push({ holiday: holidayData, reason: "Duplicate date" });
                    continue;
                }

                // Check if holiday already exists
                const dateObj = new Date(date);
                dateObj.setHours(0, 0, 0, 0);
                const existing = await Holiday.findOne({
                    tenant: req.tenantId,
                    date: {
                        $gte: new Date(dateObj),
                        $lt: new Date(dateObj.getTime() + 24 * 60 * 60 * 1000)
                    }
                });

                if (existing && skipDuplicates) {
                    skipped.push({ holiday: holidayData, reason: "Already exists" });
                    continue;
                }

                // Create or update holiday
                let holiday;
                if (existing && !skipDuplicates) {
                    // Update existing
                    existing.name = name;
                    existing.type = type || 'Public';
                    existing.description = description;
                    await existing.save();
                    holiday = existing;
                } else {
                    // Create new
                    holiday = new Holiday({
                        tenant: req.tenantId,
                        name,
                        date: dateObj,
                        type: type || 'Public',
                        description
                    });
                    await holiday.save();
                }

                saved.push(holiday);

                // Audit log (batch log for bulk operations)
            } catch (error) {
                if (error.code === 11000) {
                    skipped.push({ holiday: holidayData, reason: "Duplicate date constraint" });
                } else {
                    errors.push({ holiday: holidayData, error: error.message });
                }
            }
        }

        // Batch audit log for bulk upload
        if (saved.length > 0) {
            const auditLog = new AuditLog({
                tenant: req.tenantId,
                entity: 'Holiday',
                entityId: saved[0]._id, // Use first holiday ID as reference
                action: 'HOLIDAY_BULK_UPLOAD',
                performedBy: req.user.id,
                changes: {
                    before: null,
                    after: { count: saved.length, holidays: saved.map(h => ({ name: h.name, date: h.date })) }
                },
                meta: {
                    totalUploaded: holidays.length,
                    saved: saved.length,
                    skipped: skipped.length,
                    errors: errors.length
                }
            });
            await auditLog.save();
        }

        res.json({
            message: "Bulk upload completed",
            summary: {
                saved: saved.length,
                skipped: skipped.length,
                errors: errors.length
            },
            saved: saved.map(h => ({ _id: h._id, name: h.name, date: h.date })),
            skipped,
            errors
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
