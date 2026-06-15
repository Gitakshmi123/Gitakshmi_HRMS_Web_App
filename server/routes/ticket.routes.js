const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticket.controller');
const { authenticate } = require('../middleware/auth.jwt');
const { checkPermission } = require('../middleware/rbac.middleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '..', 'uploads', 'tickets');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `ticket-${Date.now()}-${file.originalname.replace(/[^a-z0-9]/gi, '_')}${ext}`);
    }
});
const upload = multer({ storage });

// Routes prefixed with /api/tickets in index.js

// 1. Management (Static routes MUST come before dynamic :id)
router.get('/admin/all', authenticate, checkPermission('support.tickets', 'view'), ticketController.getAllTickets);
router.get('/my-tickets', authenticate, checkPermission('employee.tickets', 'view'), ticketController.getMyTickets);

// 2. Resource Management
router.get('/', authenticate, checkPermission('employee.tickets', 'view'), ticketController.getMyTickets);
router.post('/create', authenticate, checkPermission('employee.tickets', 'create'), upload.single('attachment'), ticketController.createTicket);
router.post('/', authenticate, checkPermission('employee.tickets', 'create'), upload.single('attachment'), ticketController.createTicket);

// 3. Specific Ticket Actions (Dynamic :id)
router.get('/:id', authenticate, checkPermission(['employee.tickets', 'support.tickets'], 'view'), ticketController.getTicketDetails);
router.post('/:id/comments', authenticate, checkPermission(['employee.tickets', 'support.tickets'], 'edit'), upload.single('attachment'), ticketController.addComment);
router.patch('/:id/status', authenticate, checkPermission('support.tickets', 'edit'), ticketController.updateTicketStatus);
router.patch('/:id/assign', authenticate, checkPermission('support.tickets', 'edit'), ticketController.assignTicket);

module.exports = router;

