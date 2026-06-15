# Database Schema Design (Mongoose)

## 1. BGVCase (`bgv_cases`)
Tracks the overall verification request for a candidate's application.

| Field | Type | Description |
| :--- | :--- | :--- |
| `caseId` | String | Unique human-readable ID (e.g., BGV-2026-0001) |
| `tenant` | ObjectId | Ref: Tenant |
| `applicationId` | ObjectId | Ref: Application |
| `candidateId` | ObjectId | Ref: Candidate |
| `overallStatus` | Enum | `IN_PROGRESS`, `CLEAR`, `CLEAR_WITH_REMARKS`, `FAILED` |
| `initiatedBy` | ObjectId | Ref: User (HR/Admin) |
| `initiatedAt` | Date | Timestamp of initiation |
| `completedAt` | Date | Timestamp when status became terminal |
| `finalReport` | String | Path to individual PDF report |
| `isImmutable` | Boolean | True once employee record is created |
| `logs` | Array | Audit trail of all actions on this case |

## 2. BGVCheck (`bgv_checks`)
Individual verification items linked to a case.

| Field | Type | Description |
| :--- | :--- | :--- |
| `caseId` | ObjectId | Ref: BGVCase |
| `type` | Enum | `IDENTITY`, `ADDRESS`, `EDUCATION`, `EMPLOYMENT`, `CRIMINAL`, `REFERENCE` |
| `status` | Enum | `NOT_STARTED`, `PENDING`, `IN_PROGRESS`, `VERIFIED`, `FAILED` |
| `mode` | Enum | `MANUAL`, `VENDOR` |
| `slaDays` | Number | Expected TAT (e.g., 5 days) |
| `assignedTo` | ObjectId | Ref: User (Verifier) |
| `documents` | Array | Objects containing `{ name, path, version, uploadedAt, uploadedBy }` |
| `internalRemarks`| String | Private notes for HR/Verifier |
| `verificationReport`| String | Individual check report path |

## 3. BGVVendor (`bgv_vendors`)
Configuration for external API integrations.

| Field | Type | Description |
| :--- | :--- | :--- |
| `name` | String | Vendor Name (e.g., FirstAdvantage, AuthBridge) |
| `apiKey` | String | Encrypted API Key |
| `endpoint` | String | Base URL |
| `supportedChecks`| Array | List of check types they handle |
