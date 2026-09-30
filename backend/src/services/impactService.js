import { ImpactTransaction } from '../models/ImpactTransaction.js';
import { WasteEvent } from '../models/WasteEvent.js';
import { Report } from '../models/Report.js';
import { User } from '../models/User.js';
import { deriveUserImpact } from '../engines/impact.js';

export async function getCitizenImpactSummary(userId) {
  const transactions = await ImpactTransaction.find({ citizenId: userId })
    .populate('complaintId')
    .sort({ createdAt: -1 })
    .lean();

  const userReports = await Report.find({ citizenId: userId }).lean();
  const totals = deriveUserImpact(transactions, userReports);

  // Group transactions by complaintId for the "What changed" feed
  const feedMap = new Map();
  for (const tx of transactions) {
    const comp = tx.complaintId;
    if (!comp) continue;
    const compId = comp._id.toString();

    if (!feedMap.has(compId)) {
      feedMap.set(compId, {
        complaintId: compId,
        code: comp.code,
        category: comp.category,
        addressText: comp.addressText,
        status: comp.status,
        resolvedAt: comp.resolvedAt,
        photoUrl: comp.closurePhotoUrl,
        transactions: [],
      });
    }

    const item = feedMap.get(compId);
    item.transactions.push({
      type: tx.type,
      credits: tx.credits,
      status: tx.status,
      reason: tx.reason,
    });
  }

  // Populate photo from report if closure photo not available
  for (const [compId, item] of feedMap.entries()) {
    if (!item.photoUrl) {
      const rep = userReports.find((r) => r.complaintId.toString() === compId);
      if (rep) item.photoUrl = rep.imageUrl;
    }

    // Compose plain-language sentence
    const address = item.addressText || 'Street location';
    if (item.status === 'RESOLVED') {
      const dateStr = item.resolvedAt
        ? new Date(item.resolvedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
        : 'recently';
      item.sentence = `${address} pile — cleared on ${dateStr}. Thank you for your contribution!`;
    } else if (item.status === 'SCHEDULED') {
      item.sentence = `${address} incident — scheduled for municipal collection trip.`;
    } else if (item.status === 'VERIFIED') {
      item.sentence = `${address} incident — verified by municipal inspection team.`;
    } else {
      item.sentence = `${address} report — received and awaiting inspection.`;
    }
  }

  const feed = Array.from(feedMap.values());

  // Neighbourhood map points for this user's contributions
  const neighbourhood = feed.map((f) => {
    return {
      complaintId: f.complaintId,
      code: f.code,
      status: f.status,
    };
  });

  return {
    totals,
    tier: {
      name: totals.verifiedCredits >= 50 ? 'Steward' : totals.verifiedCredits >= 20 ? 'Contributor' : 'Observer',
      nextAt: totals.verifiedCredits < 20 ? 20 : totals.verifiedCredits < 50 ? 50 : 100,
    },
    feed,
    neighbourhood,
  };
}

export async function getOperatorImpactOverview() {
  const allVerifiedTx = await ImpactTransaction.find({ status: 'VERIFIED' }).lean();

  const uniqueEventsIdentified = new Set(
    allVerifiedTx.filter((t) => t.type === 'UNIQUE_REPORT').map((t) => t.complaintId.toString())
  ).size;

  const supportingConfirmations = allVerifiedTx.filter((t) => t.type === 'SUPPORTING_REPORT').length;

  const resolvedThroughCitizenReports = new Set(
    allVerifiedTx.filter((t) => t.type === 'RESOLUTION_BONUS').map((t) => t.complaintId.toString())
  ).size;

  // Aggregate credits by citizen
  const citizenTotals = new Map();
  for (const tx of allVerifiedTx) {
    const cId = tx.citizenId.toString();
    if (!citizenTotals.has(cId)) {
      citizenTotals.set(cId, { verifiedCredits: 0, uniqueCount: 0, resolvedCount: 0 });
    }
    const curr = citizenTotals.get(cId);
    curr.verifiedCredits += tx.credits || 0;
    if (tx.type === 'UNIQUE_REPORT') curr.uniqueCount++;
    if (tx.type === 'RESOLUTION_BONUS') curr.resolvedCount++;
  }

  const users = await User.find({ _id: { $in: Array.from(citizenTotals.keys()) } }).lean();
  const contributors = users.map((u) => {
    const stats = citizenTotals.get(u._id.toString()) || { verifiedCredits: 0, uniqueCount: 0, resolvedCount: 0 };
    const parts = u.name.trim().split(' ');
    const displayName = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];

    return {
      id: u._id.toString(),
      displayName,
      verifiedCredits: stats.verifiedCredits,
      uniqueIncidents: stats.uniqueCount,
      resolved: stats.resolvedCount,
    };
  });

  contributors.sort((a, b) => b.verifiedCredits - a.verifiedCredits);

  return {
    aggregate: {
      verifiedTransactions: allVerifiedTx.length,
      uniqueEventsIdentified,
      supportingConfirmations,
      resolvedThroughCitizenReports,
    },
    contributors: contributors.slice(0, 10),
  };
}
