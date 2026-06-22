# Enterprise Hiring to Employee Conversion Workflow

## State Flow

Job Created -> Candidate Applies -> Pipeline Process -> Finalized -> Document Request Sent -> Profile Submitted -> External Record Approved -> Draft Employee -> Offer Generated -> Offer Accepted/Signed -> Joining Generated -> Joining Signed -> Active Employee.

## MongoDB Collections

### CandidateDocumentRequest

- `candidateId`, `applicantId`, `jobId`, `tenant`
- `token` stores a SHA-256 hash of the secure token sent by email
- `status`: `Pending`, `Submitted`, `Approved`, `Rejected`
- `sentBy`, `sentAt`, `submittedAt`, `approvedAt`, `rejectedAt`
- `expiresAt`, `remarks`

### ExternalEmployeeRecord

- `candidateId`, `applicantId`, `jobId`, `tenant`, `documentRequestId`
- Form sections: `personalDetails`, `familyDetails`, `communicationDetails`, `educationDetails`, `experienceDetails`, `documentDetails`, `bankDetails`, `statutoryDetails`, `salaryDetails`
- `rawEmployeePayload` stores the complete reused Employee Form payload
- `completionPercentage`
- `status`: `Pending`, `Submitted`, `Approved`, `Rejected`
- `draftEmployeeId`, approval/rejection metadata, remarks

## API Structure

### HR

- `POST /api/applications/:id/request-documents`
- `GET /api/applications/external-records/list`
- `POST /api/applications/external-records/:id/approve`
- `POST /api/applications/external-records/:id/reject`
- `POST /api/applications/external-records/:id/request-changes`
- `POST /api/letters/generate-offer`
- `POST /api/letters/generate-joining`
- `POST /api/applications/:id/convert-to-employee`

### Candidate

- `GET /api/candidate/document-upload/:token`
- `PUT /api/candidate/document-upload/:token/draft`
- `POST /api/candidate/document-upload/:token/submit`

## Role Matrix

- HR: send documents, review external records, approve/reject/request changes, generate offer and joining, activate employee after signed joining.
- Recruiter: manage candidate pipeline and send document requests when allowed.
- Hiring Manager: participate in pipeline evaluation and offer approval workflows where configured.
- Admin: all HR/recruitment/document permissions.
- Candidate: complete profile, save draft, submit profile, accept/sign offer and joining letters.

## Activity Timeline

Timeline/audit events are written for candidate status changes, document request sent, profile draft/submission, profile approval/rejection/change request, draft creation, offer generation, joining signing, and employee activation.

## Notifications and Email

Document requests send candidate email with subject `Complete Your Employment Profile` and a secure `/candidate/document-upload/:token` link. Candidate in-app notifications are also created for document requests.

## Enforcement Rules

- Finalized candidates receive `Send Documents`; direct offer generation is blocked.
- `Generate Offer` requires an approved external record and linked `Draft` employee.
- `convert-to-employee` requires signed joining and activates the existing draft employee instead of creating a duplicate employee.
