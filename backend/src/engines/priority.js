/**
 * Pure Priority Engine for CivicClean
 * Computes explainable rule-based priority scores with breakdown and legible sentences.
 */

export const PRIORITY_TIERS = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  NORMAL: 'Normal',
  LOW: 'Low',
};

export const SEVERITY_POINTS = {
  1: 10,
  2: 25,
  3: 40,
};

export const SENSITIVE_SITE_POINTS = 15;
export const MAX_WAIT_DAYS = 7;
export const MAX_COMMUNITY_POINTS = 20;
export const POINTS_PER_SUPPORTER = 4;
export const MAX_COUNTED_SUPPORTERS = 5;

/**
 * Computes priority score and breakdown.
 * @param {Object} params
 * @param {number} [params.severity] S1, S2, or S3 (1, 2, 3)
 * @param {Date|string|number} [params.firstReportedAt]
 * @param {number} [params.supportCount=0] Count of unique supporting citizens
 * @param {string} [params.sensitiveSite='NONE'] 'NONE' | 'SCHOOL' | 'HOSPITAL' | 'MARKET' | 'DRAIN'
 * @param {Date|string|number} [params.now=new Date()]
 * @returns {{
 *   score: number,
 *   tier: string,
 *   breakdown: Array<{key: string, label: string, points: number, detail: string}>,
 *   sentence: string
 * }}
 */
export function computePriority({
  severity = 1,
  firstReportedAt = new Date(),
  supportCount = 0,
  sensitiveSite = 'NONE',
  now = new Date(),
}) {
  const breakdown = [];
  let totalScore = 0;

  // 1. Severity
  const sevKey = Number(severity) || 1;
  const sevPoints = SEVERITY_POINTS[sevKey] || 10;
  totalScore += sevPoints;
  const sevLabel = sevKey === 3 ? 'Large pile (S3)' : sevKey === 2 ? 'Medium pile (S2)' : 'Small pile (S1)';
  breakdown.push({
    key: 'severity',
    label: 'Severity',
    points: sevPoints,
    detail: sevLabel,
  });

  // 2. Waiting Time
  const nowMs = new Date(now).getTime();
  const firstMs = new Date(firstReportedAt).getTime();
  const hoursWaiting = Math.max(0, (nowMs - firstMs) / (1000 * 60 * 60));
  const daysWaiting = hoursWaiting / 24;
  const waitFraction = Math.min(daysWaiting / MAX_WAIT_DAYS, 1);
  const waitPoints = Math.round(25 * waitFraction);
  totalScore += waitPoints;
  const waitDetail =
    daysWaiting >= 1
      ? `Waiting ${Math.floor(daysWaiting)} day${Math.floor(daysWaiting) === 1 ? '' : 's'}`
      : `Waiting ${Math.round(hoursWaiting)} hr${Math.round(hoursWaiting) === 1 ? '' : 's'}`;
  breakdown.push({
    key: 'waiting_time',
    label: 'Waiting Time',
    points: waitPoints,
    detail: waitDetail,
  });

  // 3. Community Confirmation
  const supportersCounted = Math.min(Math.max(0, Number(supportCount) || 0), MAX_COUNTED_SUPPORTERS);
  const communityPoints = supportersCounted * POINTS_PER_SUPPORTER;
  totalScore += communityPoints;
  breakdown.push({
    key: 'community',
    label: 'Community Confirmations',
    points: communityPoints,
    detail: `${supportersCounted} confirmation${supportersCounted === 1 ? '' : 's'} (${communityPoints} pts)`,
  });

  // 4. Sensitive Site
  const isSensitive = sensitiveSite && sensitiveSite !== 'NONE';
  const sitePoints = isSensitive ? SENSITIVE_SITE_POINTS : 0;
  totalScore += sitePoints;
  if (isSensitive) {
    const formattedSite = sensitiveSite.charAt(0) + sensitiveSite.slice(1).toLowerCase();
    breakdown.push({
      key: 'sensitive_site',
      label: 'Sensitive Site',
      points: sitePoints,
      detail: `Near ${formattedSite}`,
    });
  }

  // Final score clamped to 0 - 100
  const score = Math.min(100, Math.max(0, totalScore));

  // Tier determination
  let tier = PRIORITY_TIERS.LOW;
  if (score >= 70) {
    tier = PRIORITY_TIERS.CRITICAL;
  } else if (score >= 50) {
    tier = PRIORITY_TIERS.HIGH;
  } else if (score >= 30) {
    tier = PRIORITY_TIERS.NORMAL;
  }

  // Construct legible "why" sentence
  const reasons = [];
  if (sevKey === 3) reasons.push('it is a large pile (+40)');
  else if (sevKey === 2) reasons.push('it is a medium pile (+25)');
  else reasons.push('it is a small pile (+10)');

  if (waitPoints > 0) {
    reasons.push(`has been waiting ${Math.max(1, Math.round(daysWaiting))} day(s) (+${waitPoints})`);
  }
  if (communityPoints > 0) {
    reasons.push(`${supportersCounted} neighbour(s) confirmed it (+${communityPoints})`);
  }
  if (isSensitive) {
    reasons.push(`it is near a ${sensitiveSite.toLowerCase()} (+${SENSITIVE_SITE_POINTS})`);
  }

  const sentence = `${tier} because ${reasons.join(', ')}.`;

  return {
    score,
    tier,
    breakdown,
    sentence,
  };
}
