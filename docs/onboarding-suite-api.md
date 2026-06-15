# Onboarding Suite API

Production-ready onboarding module for dynamic workflows, DMS, attendance face registration, notifications, and admin operations.

## Mounting

Add this to `server/app.js` after authentication middleware is available:

```js
const { createOnboardingSuiteRouter } = require('./modules/onboarding-suite');
const authJwt = require('./middleware/auth.jwt');
const { checkPermission } = require('./middleware/rbac.middleware');

app.use('/api/onboarding-suite', createOnboardingSuiteRouter({
  authenticate: authJwt.authenticate,
  authorizeAdmin: checkPermission('onboarding.dashboard', 'edit'),
}));
```

## Templates

### `GET /api/onboarding-suite/templates`

Returns all workflow templates for the current tenant.

```json
{
  "success": true,
  "templates": []
}
```

### `POST /api/onboarding-suite/templates`

Creates a versioned workflow template.

```json
{
  "name": "Developer Onboarding",
  "code": "DEV_ONBOARDING",
  "description": "Developer onboarding workflow",
  "targetRoles": ["developer"],
  "targetDepartments": ["IT"],
  "targetLocations": ["Ahmedabad", "Remote"],
  "employeeTypes": ["full_time"],
  "status": "active",
  "steps": [
    {
      "key": "personal_info",
      "title": "Personal Information",
      "phase": "pre_onboarding",
      "type": "form",
      "order": 1,
      "assignedRole": "employee",
      "conditions": {
        "roles": ["developer"],
        "departments": ["IT"]
      },
      "dependencies": [],
      "config": {
        "formSchema": [
          { "name": "firstName", "label": "First name", "type": "text", "required": true }
        ]
      }
    },
    {
      "key": "kyc_documents",
      "title": "Upload KYC Documents",
      "phase": "pre_onboarding",
      "type": "document",
      "order": 2,
      "assignedRole": "employee",
      "dependencies": [{ "stepKey": "personal_info", "status": "completed" }],
      "config": {
        "requiredDocuments": ["AADHAAR", "PAN", "BANK_PROOF"]
      }
    }
  ]
}
```

## Assignments

### `POST /api/onboarding-suite/assignments`

Assigns the best matching active template, or a specific `templateId`, to an employee.

```json
{
  "employeeId": "665f...",
  "templateId": "optional-template-id",
  "meta": {
    "source": "offer_accepted"
  }
}
```

### `GET /api/onboarding-suite/assignments`

Query params:

- `status`
- `employeeId`
- `limit`

### `GET /api/onboarding-suite/assignments/:assignmentId`

Returns assignment, steps, approvals, and documents.

## Step Execution

### `POST /api/onboarding-suite/assignments/:assignmentId/steps/:stepKey/start`

Moves a pending step to `in_progress`.

### `POST /api/onboarding-suite/assignments/:assignmentId/steps/:stepKey/complete`

Completes form, document, training, API trigger, or face-registration steps.

```json
{
  "payload": {
    "firstName": "Nitesh",
    "mobile": "9999999999"
  }
}
```

### `POST /api/onboarding-suite/assignments/:assignmentId/steps/:stepKey/retry`

Reopens a failed or rejected step if retry policy allows it.

## Approvals

### `POST /api/onboarding-suite/approvals/:approvalId/approve`

```json
{
  "remarks": "Verified"
}
```

### `POST /api/onboarding-suite/approvals/:approvalId/reject`

```json
{
  "reason": "PAN image is not readable"
}
```

## DMS

### `POST /api/onboarding-suite/documents/upload`

Multipart form data:

- `file`
- `assignmentId`
- `employeeId`
- `stepProgressId`
- `documentType`
- `category`

The DMS stores immutable versions, calculates checksums, and classifies the document.

### `PATCH /api/onboarding-suite/documents/:documentId/review`

```json
{
  "status": "approved",
  "reason": ""
}
```

## Attendance + Face

### `POST /api/onboarding-suite/face/register`

```json
{
  "assignmentId": "665f...",
  "employeeId": "665f...",
  "descriptor": [0.12, 0.44],
  "geo": { "lat": 23.0225, "lng": 72.5714, "accuracy": 20 },
  "liveness": { "score": 0.91 },
  "deviceId": "browser-device"
}
```

### `POST /api/onboarding-suite/face/:faceProfileId/approve`

```json
{
  "approved": true,
  "reason": ""
}
```

### `POST /api/onboarding-suite/face/verify`

Returns a verification result and a short-lived session token placeholder.

### `POST /api/onboarding-suite/attendance/punch_in`

### `POST /api/onboarding-suite/attendance/punch_out`

```json
{
  "employeeId": "665f...",
  "verification": {
    "method": "face_gps",
    "confidence": 0.92,
    "sessionToken": "..."
  },
  "geo": { "lat": 23.0225, "lng": 72.5714, "accuracy": 20 },
  "deviceId": "browser-device"
}
```

## Notifications

### `POST /api/onboarding-suite/notification-templates`

```json
{
  "code": "ONBOARDING_STEP_REJECTED",
  "channel": "email",
  "subject": "Action required: {{stepTitle}}",
  "bodyText": "Hello {{employeeName}}, {{stepTitle}} was rejected.",
  "variables": ["employeeName", "stepTitle"]
}
```

## State Model

Step statuses:

- `locked`
- `pending`
- `in_progress`
- `completed`
- `rejected`
- `failed`
- `skipped`

Assignment statuses:

- `pending`
- `in_progress`
- `blocked`
- `completed`
- `cancelled`

