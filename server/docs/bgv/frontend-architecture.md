# Frontend UI Structure

## 🎨 Design Theme
- **Primary Color**: `#1E40AF` (Deep Blue)
- **Status Colors**:
  - `VERIFIED`: Green (`#10B981`)
  - `FAILED`: Red (`#EF4444`)
  - `PENDING`: Orange (`#F59E0B`)
  - `IN_PROGRESS`: Blue (`#3B82F6`)

## 1. HR Dashboard Components
### `BGVCaseList.jsx`
- Searchable table of all candidates and their BGV status.
- Filter by: `Overdue SLA`, `Awaiting HR Action`, `Failed`.

### `BGVInitiatorModal.jsx`
- Multi-select checklist of verification types.
- SLA configuration per check.
- Assign verifier dropdown.

### `VerificationForm.jsx` (For Verifiers)
- Grid of documents for high-speed review.
- Toggle switch for `Verified / Failed`.
- Rich text editor for internal remarks.

## 2. Candidate Portal Components
### `BGVChecklist.jsx`
- Vertical timeline/stepper of required checks.
- File upload targets with Drag-and-Drop.
- Previewer for uploaded PDF/Images.
- Read-only status banner at the top.

## 3. Global Components
### `BGVStatusBadge.jsx`
- Reusable component for color-coded status display.

### `BGVTimeline.jsx`
- Audit-trail visualization showing who did what and when.
