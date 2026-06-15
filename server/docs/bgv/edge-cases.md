# Edge Cases & Failure Handling

## ⚠️ Scenario: Candidate Submits Incorrect Document
- **Resolution**: Verifier marks check as `FAILED` or `IN_PROGRESS` with a public remark. System allows re-upload if the check is "re-opened" by HR.

## ⚠️ Scenario: Vendor API Offline
- **Resolution**: Fallback to `MANUAL` verification or retry queue (with exponential backoff). HR is notified if vendor SLA is breached.

## ⚠️ Scenario: Role-based BGV Requirement Changes after Initiation
- **Resolution**: HR can "Add/Remove Checks" dynamically from the BGV Management dashboard.

## ⚠️ Scenario: Offer Sent but BGV Fails midway
- **Resolution**: The "Subject to BGV" clause allows for legal withdrawal. System provides a button to `WITHDRAW_OFFER` immediately upon `overallStatus === 'FAILED'`.

## ⚠️ Scenario: Candidate Deleted
- **Resolution**: `BGVCase` and `BGVChecks` are orphaned but preserved in the database for 7 years (configurable) per compliance standards.

## ⚠️ Scenario: Re-verification on Promotion
- **Resolution**: System allows creating a NEW `BGVCase` for an existing Employee. The previous BGV data remains in history.
