# BGV API Specification

## 🚀 Key Endpoints

### 1. Initiation
`POST /api/bgv/initiate`
- **Body**: `{ applicationId, checks: ['IDENTITY', 'EDUCATION'] }`
- **Permissions**: `RECRUITER`, `HR_ADMIN`
- **Action**: Creates `BGVCase` and multiple `BGVCheck` records. Sends notification.

### 2. Retrieval
`GET /api/bgv/candidate/:candidateId`
- **Permissions**: `CANDIDATE` (Own), `HR_ADMIN`, `VERIFIER`
- **Action**: Returns current checks and statuses. Hides internal remarks for candidates.

### 3. Submission (Candidate)
`POST /api/bgv/check/:checkId/upload`
- **Body**: `FormData` with document
- **Permissions**: `CANDIDATE`
- **Action**: Updates `BGVCheck.documents`. Disables editing if check status is `PENDING` or `IN_PROGRESS`.

### 4. Verification (Verifier)
`POST /api/bgv/check/:checkId/verify`
- **Body**: `{ status: 'VERIFIED/FAILED', internalRemarks: '...', report: File }`
- **Permissions**: `VERIFIER`, `HR_ADMIN`
- **Action**: Updates check status. Triggers check if all items in `BGVCase` are terminal.

### 5. Finalize
`POST /api/bgv/case/:caseId/finalize`
- **Permissions**: `HR_ADMIN`
- **Action**: Calculates `overallStatus` and generates `finalReport.pdf`.

### 6. Re-open
`POST /api/bgv/check/:checkId/reopen`
- **Permissions**: `HR_ADMIN`
- **Action**: Resets check to `IN_PROGRESS` and logs the reason.

## 🔐 Security Constants
- **Idempotency**: All update operations must check current status to prevent race conditions.
- **RBAC Middleware**: Ensure `req.user.tenant` matches `resource.tenant`.
