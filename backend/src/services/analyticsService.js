import { WasteEvent } from '../models/WasteEvent.js';
import { HistoryIncident } from '../models/HistoryIncident.js';
import { computeHotspotForecast } from '../engines/forecast.js';

export async function getHotspotAnalytics(weeks = 12) {
  // Live unique active events count for current week
  const liveCount = await WasteEvent.countDocuments({
    status: { $in: ['SUBMITTED', 'VERIFIED', 'SCHEDULED'] },
  });

  // Query real reviewed public events (strictly exclude private household locations)
  const realEvents = await WasteEvent.find({
    status: { $in: ['VERIFIED', 'SCHEDULED', 'RESOLVED'] },
    reportType: { $ne: 'HOUSEHOLD' },
  }).lean();

  const now = new Date();
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

  // Determine complete past weeks (excluding current incomplete week)
  const pastEvents = realEvents.filter((ev) => {
    const ageMs = now.getTime() - new Date(ev.firstReportedAt || ev.createdAt).getTime();
    return ageMs >= oneWeekMs; // older than 1 week
  });

  // Check if we have at least 3 distinct past weeks in real data
  const distinctWeeks = new Set(
    pastEvents.map((ev) => Math.floor((now.getTime() - new Date(ev.firstReportedAt || ev.createdAt).getTime()) / oneWeekMs))
  );

  if (distinctWeeks.size >= 3) {
    const minWeek = Math.min(...distinctWeeks);
    const formatted = pastEvents.map((ev) => {
      const wIdx = Math.floor((now.getTime() - new Date(ev.firstReportedAt || ev.createdAt).getTime()) / oneWeekMs);
      return {
        weekIndex: wIdx - minWeek + 1,
        location: {
          lat: ev.location.coordinates[1],
          lng: ev.location.coordinates[0],
        },
        category: ev.category,
      };
    });

    const forecastResult = computeHotspotForecast(formatted, distinctWeeks.size, distinctWeeks.size);
    return {
      ...forecastResult,
      isSynthetic: false,
      label: `Real Operational Incident History (${distinctWeeks.size} complete weeks)`,
      liveThisWeek: {
        uniqueEvents: liveCount,
        note: 'Live events for the current incomplete week (excluded from moving average model).',
      },
    };
  }

  // If real pilot history has not yet reached 3 full weeks, check if demo seed history exists
  const incidents = await HistoryIncident.find().lean();
  if (incidents && incidents.length > 0) {
    const formatted = incidents.map((inc) => ({
      weekIndex: inc.weekIndex,
      location: {
        lat: inc.location.coordinates[1],
        lng: inc.location.coordinates[0],
      },
      category: inc.category,
    }));

    const forecastResult = computeHotspotForecast(formatted, Number(weeks) || 12, 12);
    return {
      ...forecastResult,
      isSynthetic: true,
      label: 'Demo Baseline: 12-week synthetic history (live pilot data is currently accumulating)',
      liveThisWeek: {
        uniqueEvents: liveCount,
        note: 'Live events for the current incomplete week (excluded from baseline model).',
      },
    };
  }

  // Transparent insufficient history response
  return {
    status: 'INSUFFICIENT_HISTORY',
    isSynthetic: false,
    label: 'Real Pilot Operational History',
    message: 'Forecasting requires at least 3 complete historical calendar weeks of reviewed public incident records. Currently collecting live pilot data.',
    weeksAvailable: distinctWeeks.size,
    liveThisWeek: {
      uniqueEvents: liveCount,
      note: 'Operational pilot active. Historical models activate once 3 complete weeks of verified public records are registered.',
    },
  };
}
