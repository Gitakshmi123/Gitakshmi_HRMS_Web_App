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

        // Read with raw=true to handle Excel date serial numbers,
        // then also with raw=false for string fallback
        const dataRaw = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });
        const dataFmt = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, dateNF: 'dd-mm-yyyy' });

        const holidays = [];
        const errors = [];

        // Month name map for formats like "12-Nov-2026" or "12 November 2026"
        const MONTHS = {
            jan:1,feb:2,mar:3,apr:4,may:5,jun:6,
            jul:7,aug:8,sep:9,oct:10,nov:11,dec:12,
            january:1,february:2,march:3,april:4,june:6,
            july:7,august:8,september:9,october:10,november:11,december:12
        };

        /**
         * Parse a date from any common format:
         * - DD-MM-YYYY  (01-01-2026)
         * - DD/MM/YYYY  (01/01/2026)
         * - MM/DD/YYYY  (01/31/2026) — fallback when day > 12 in slot 0 vs 1
         * - DD-Mon-YYYY (12-Nov-2026)
         * - DD Mon YYYY (12 Nov 2026)
         * - YYYY-MM-DD  (ISO, 2026-11-12)
         * - Excel serial number (numeric)
         * - JS Date object
         * Returns a Date or null
         */
        const parseAnyDate = (rawVal, fmtStr) => {
            // Already a JS Date
            if (rawVal instanceof Date && !isNaN(rawVal.getTime())) {
                return rawVal;
            }

            // Excel serial number (number type)
            if (typeof rawVal === 'number' && rawVal > 1) {
                // SheetJS can convert serial to Date
                const d = XLSX.SSF.parse_date_code(rawVal);
                if (d) return new Date(d.y, d.m - 1, d.d, 12, 0, 0);
            }

            // Use the formatted string for text parsing
            const s = String(fmtStr || rawVal || '').trim();
            if (!s) return null;

            // Try ISO YYYY-MM-DD
            let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
            if (m) {
                const [, y, mo, d] = m.map(Number);
                return new Date(y, mo - 1, d, 12, 0, 0);
            }

            // Try DD-MM-YYYY or DD/MM/YYYY
            m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
            if (m) {
                const [, d, mo, y] = m.map(Number);
                if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
                    return new Date(y, mo - 1, d, 12, 0, 0);
                }
            }

            // Try DD-Mon-YYYY or DD Mon YYYY (e.g. 12-Nov-2026, 12 Nov 2026)
            m = s.match(/^(\d{1,2})[-\s]+([A-Za-z]+)[-\s]+(\d{4})$/);
            if (m) {
                const day = parseInt(m[1], 10);
                const monKey = m[2].toLowerCase().slice(0, 3);
                const year = parseInt(m[3], 10);
                const month = MONTHS[monKey] || MONTHS[m[2].toLowerCase()];
                if (month && day >= 1 && day <= 31 && year >= 1900) {
                    return new Date(year, month - 1, day, 12, 0, 0);
                }
            }

            // Try Mon DD YYYY or Month DD, YYYY
            m = s.match(/^([A-Za-z]+)[-\s]+(\d{1,2})[,\s]*(\d{4})$/);
            if (m) {
                const monKey = m[1].toLowerCase().slice(0, 3);
                const day = parseInt(m[2], 10);
                const year = parseInt(m[3], 10);
                const month = MONTHS[monKey] || MONTHS[m[1].toLowerCase()];
                if (month && day >= 1 && day <= 31 && year >= 1900) {
                    return new Date(year, month - 1, day, 12, 0, 0);
                }
            }

            // Last resort: native Date parse
            const nd = new Date(s);
            if (!isNaN(nd.getTime())) return nd;

            return null;
        };

        const validateDate = (d, raw, fmt, rowNum, fieldName) => {
            if (!d || isNaN(d.getTime())) {
                errors.push({ row: rowNum, error: `Invalid ${fieldName} format: "${fmt || raw}". Use DD-MM-YYYY, DD-Mon-YYYY, or similar.` });
                return null;
            }
            const y = d.getFullYear();
            if (y < 1900 || y > 2100) {
                errors.push({ row: rowNum, error: `Year ${y} out of range (1900-2100)` });
                return null;
            }
            d.setHours(0, 0, 0, 0);
            return d;
        };

        // Expected columns (0-indexed):
        // 0: Holiday Name
        // 1: Date (start)
        // 2: End Date (optional)
        // 3: Type
        // 4: Description
        const validTypes = ['Public', 'Optional', 'Company', 'National', 'Festival', 'Regional'];

        for (let i = 1; i < dataRaw.length; i++) {
            const rowR = dataRaw[i];
            const rowF = dataFmt[i] || [];
            if (!rowR || rowR.length === 0 || (!rowR[0] && !rowF[0])) continue;

            try {
                const name = String(rowF[0] || rowR[0] || '').trim();

                if (!name) {
                    errors.push({ row: i + 1, error: 'Holiday name is required' });
                    continue;
                }

                if (!rowR[1] && !rowF[1]) {
                    errors.push({ row: i + 1, error: 'Date is required' });
                    continue;
                }

                // Parse start date
                const startDate = validateDate(
                    parseAnyDate(rowR[1], rowF[1]),
                    rowR[1], rowF[1], i + 1, 'date'
                );
                if (!startDate) continue;

                // Parse optional end date (col 2)
                let endDate = null;
                if (rowR[2] || rowF[2]) {
                    const rawEnd = String(rowF[2] || rowR[2] || '').trim();
                    if (rawEnd && rawEnd.toLowerCase() !== 'end date') {
                        const parsed = parseAnyDate(rowR[2], rowF[2]);
                        endDate = validateDate(parsed, rowR[2], rowF[2], i + 1, 'end date');
                        // endDate errors are non-fatal — just skip end date
                        if (!endDate) errors.pop(); // remove non-fatal end date error
                    }
                }

                // Type is col 3, Description is col 4
                const typeRaw = String(rowF[3] || rowR[3] || 'Public').trim();
                const description = String(rowF[4] || rowR[4] || '').trim();

                const holidayType = validTypes.includes(typeRaw) ? typeRaw : 'Public';

                holidays.push({
                    name,
                    date: startDate.toISOString(),
                    endDate: endDate ? endDate.toISOString() : null,
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
            query.$or = [
                { date: { $gte: startOfYear, $lte: endOfYear } },
                { endDate: { $gte: startOfYear, $lte: endOfYear } },
                { date: { $lte: startOfYear }, endDate: { $gte: endOfYear } }
            ];
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
        const { name, date, endDate, type, description } = req.body;

        if (!name || !date) {
            return res.status(400).json({ error: "Holiday name and date are required" });
        }

        const holiday = new Holiday({
            tenant: req.tenantId,
            name,
            date,
            endDate: endDate || null,
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
        const { name, date, endDate, type, description } = req.body;

        const holiday = await Holiday.findOne({ _id: id, tenant: req.tenantId });
        if (!holiday) {
            return res.status(404).json({ error: "Holiday not found" });
        }

        const before = holiday.toObject();

        // Update fields
        if (name) holiday.name = name;
        if (date) holiday.date = date;
        if (endDate !== undefined) holiday.endDate = endDate;
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
