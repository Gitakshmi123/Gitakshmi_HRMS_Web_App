/**
 * Strict Hiring Workflow Validator
 *
 * Flow:
 * APPLIED → SHORTLISTED → INTERVIEW → OFFER_PENDING → OFFER_ACCEPTED → OFFER_SIGNED → JOINING_ISSUED → JOINED
 * (REJECTED is allowed as a terminal action)
 */

const HIRING_STATUSES = Object.freeze({
  APPLIED: 'APPLIED',
  SHORTLISTED: 'SHORTLISTED',
  INTERVIEW: 'INTERVIEW',
  OFFER_PENDING: 'OFFER_PENDING',
  OFFER_ACCEPTED: 'OFFER_ACCEPTED',
  OFFER_SIGNED: 'OFFER_SIGNED',
  JOINING_ISSUED: 'JOINING_ISSUED',
  JOINED: 'JOINED',
  REJECTED: 'REJECTED',
});

const STRICT_TRANSITIONS = Object.freeze({
  [HIRING_STATUSES.APPLIED]: [HIRING_STATUSES.SHORTLISTED],
  [HIRING_STATUSES.SHORTLISTED]: [HIRING_STATUSES.INTERVIEW],
  [HIRING_STATUSES.INTERVIEW]: [HIRING_STATUSES.OFFER_PENDING],
  [HIRING_STATUSES.OFFER_PENDING]: [HIRING_STATUSES.OFFER_ACCEPTED],
  [HIRING_STATUSES.OFFER_ACCEPTED]: [HIRING_STATUSES.OFFER_SIGNED],
  [HIRING_STATUSES.OFFER_SIGNED]: [HIRING_STATUSES.JOINING_ISSUED],
  [HIRING_STATUSES.JOINING_ISSUED]: [HIRING_STATUSES.JOINED],
  [HIRING_STATUSES.JOINED]: [],
  [HIRING_STATUSES.REJECTED]: [],
});

function isStrictHiringStatus(status) {
  return Object.values(HIRING_STATUSES).includes(status);
}

/**
 * Validate strict hiring flow transitions.
 * Throws Error("Invalid workflow transition") if invalid.
 *
 * Note: REJECTED is allowed from any non-terminal status.
 */
function validateHiringFlow(currentStatus, nextStatus) {
  if (!currentStatus || !nextStatus) {
    throw new Error('Invalid workflow transition');
  }

  if (!isStrictHiringStatus(currentStatus) || !isStrictHiringStatus(nextStatus)) {
    throw new Error('Invalid workflow transition');
  }

  if (nextStatus === HIRING_STATUSES.REJECTED) {
    if ([HIRING_STATUSES.REJECTED, HIRING_STATUSES.JOINED].includes(currentStatus)) {
      throw new Error('Invalid workflow transition');
    }
    return true;
  }

  const allowed = STRICT_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw new Error('Invalid workflow transition');
  }
  return true;
}

module.exports = {
  HIRING_STATUSES,
  isStrictHiringStatus,
  validateHiringFlow,
};

