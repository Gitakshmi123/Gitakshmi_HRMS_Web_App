# RBAC & Security Matrix

## 🔑 Permissions by Role

| Role | Initiate | View Status | Upload Docs | Verify | Internal Remarks | Config Vendors |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Candidate** | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Recruiter** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **HR Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Verifier** | ❌ | ✅ (Assigned) | ❌ | ✅ | ✅ | ❌ |
| **Manager** | ❌ | ✅ (Summary) | ❌ | ❌ | ❌ | ❌ |

## 🛡️ Security Measures

### 1. Document Versioning
- When a candidate re-uploads a document (prior to submission), the old document is maintained in the `documents` array with a version tag.
- Deleted documents are never purged from storage; they are merely marked as `inactive`.

### 2. Immutable Audit Logs
- Every status transition (e.g., `PENDING` -> `VERIFIED`) creates a log entry in the `BGVCase`.
- Logs include `timestamp`, `userId`, `action_type`, and `request_ip`.

### 3. Multi-Tenant Isolation
- Queries are strictly scoped to `req.tenantId`.
- Cross-tenant access attempts trigger a SEV-1 audit alert.

### 4. Data Retention
- BGV data must survive candidate deletion (for compliance/legal reasons).
- A reference record is maintained in the `Employee` model after conversion.
