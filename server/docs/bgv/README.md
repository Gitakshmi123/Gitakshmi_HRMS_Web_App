# Background Verification (BGV) Module Design

## 📌 Overview
The BGV module is an enterprise-grade solution integrated directly into the GT-HRMS recruitment and compliance pipeline. It ensures that every candidate is thoroughly vetted before an offer is formalized, maintaining multi-tenant isolation and a strict audit trail.

## 🏗️ Architecture
- **Tenant-Aware**: All BGV data is stored within the specific tenant database using the `req.tenantDB` pattern.
- **Micro-service Ready**: Designed with placeholders for plug-and-play Vendor API integrations.
- **Immutable History**: Logic prevents hard deletes; all status changes are logged with user context.

## 🔄 Core Workflow
1. **Initiation**: HR chooses which checks (Education, Criminal, etc.) are required for the role.
2. **Data Collection**: Candidate receives a notification to upload documents on their portal.
3. **Verification**: Internal verifiers or External vendors review and mark status.
4. **Decisioning**: System evaluates individual check results to compute an `overall_bgv_status`.
5. **Enforcement**: Offer generation and employee creation are blocked if BGV fails.

## 🔗 Integration Points
- **Recruitment**: Linked to `Application` and `Candidate`.
- **Offer Management**: Conditional check on `BGVCase` status.
- **Employee Master**: Data persists and is viewable under the Compliance tab.
