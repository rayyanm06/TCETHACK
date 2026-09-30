/**
 * Pure Impact Credit Engine for CivicClean
 * Implements the verified-outcome credit ledger, transaction state transitions, and balance derivations.
 */

export const CREDIT_VALUES = {
  UNIQUE_REPORT: 10,
  SUPPORTING_REPORT: 3,
  SUPPORT_CREDIT_CAP: 3, // only first 3 supporters get credits
  CLASSIFICATION_CORRECTION: 4,
  RESOLUTION_PRIMARY_BONUS: 5,
  RESOLUTION_SUPPORTING_BONUS: 2,
};

export const TRANSACTION_TYPES = {
  UNIQUE_REPORT: 'UNIQUE_REPORT',
  SUPPORTING_REPORT: 'SUPPORTING_REPORT',
  CLASSIFICATION_CORRECTION: 'CLASSIFICATION_CORRECTION',
  RESOLUTION_BONUS: 'RESOLUTION_BONUS',
};

export const TRANSACTION_STATUSES = {
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
  REVOKED: 'REVOKED',
};

/**
 * Calculates user aggregate totals from transaction list.
 * Balances are derived from ledger rows, never directly overwritten.
 * @param {Array<Object>} transactions
 * @param {Array<Object>} [userReports=[]]
 * @param {Array<Object>} [userEvents=[]]
 * @returns {{
 *   verifiedCredits: number,
 *   pendingCredits: number,
 *   uniqueIncidents: number,
 *   supportingContributions: number,
 *   resolvedIncidents: number
 * }}
 */
export function deriveUserImpact(transactions = [], userReports = [], userEvents = []) {
  let verifiedCredits = 0;
  let pendingCredits = 0;

  const uniqueEventIds = new Set();
  const supportingCount = { count: 0 };
  const resolvedEventIds = new Set();

  for (const tx of transactions) {
    if (tx.status === TRANSACTION_STATUSES.VERIFIED) {
      verifiedCredits += tx.credits || 0;

      if (tx.type === TRANSACTION_TYPES.UNIQUE_REPORT && tx.complaintId) {
        uniqueEventIds.add(tx.complaintId.toString());
      }
      if (tx.type === TRANSACTION_TYPES.SUPPORTING_REPORT) {
        supportingCount.count += 1;
      }
      if (tx.type === TRANSACTION_TYPES.RESOLUTION_BONUS && tx.complaintId) {
        resolvedEventIds.add(tx.complaintId.toString());
      }
    } else if (tx.status === TRANSACTION_STATUSES.PENDING) {
      pendingCredits += tx.credits || 0;
    }
  }

  // Cross-reference with resolved events if provided
  for (const ev of userEvents) {
    if (ev.status === 'RESOLVED') {
      const evId = (ev._id || ev.id)?.toString();
      if (evId && uniqueEventIds.has(evId)) {
        resolvedEventIds.add(evId);
      }
    }
  }

  return {
    verifiedCredits,
    pendingCredits,
    uniqueIncidents: uniqueEventIds.size,
    supportingContributions: supportingCount.count,
    resolvedIncidents: resolvedEventIds.size,
  };
}

/**
 * Determines credit amount for a supporting report given current supporter count.
 * @param {number} currentSupporterCount
 * @returns {{credits: number, reason: string}}
 */
export function calculateSupportCredits(currentSupporterCount = 0) {
  if (currentSupporterCount < CREDIT_VALUES.SUPPORT_CREDIT_CAP) {
    return {
      credits: CREDIT_VALUES.SUPPORTING_REPORT,
      reason: 'Confirmed existing report with additional photographic evidence',
    };
  }
  return {
    credits: 0,
    reason: 'Event already well-confirmed by neighbours (support recorded)',
  };
}
