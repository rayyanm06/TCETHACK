import { HistoryIncident } from '../models/HistoryIncident.js';
import { WasteEvent } from '../models/WasteEvent.js';
import { computeHotspotForecast } from '../engines/forecast.js';

export async function getHotspotAnalytics(weeks = 12) {
  const incidents = await HistoryIncident.find().lean();
  if (!incidents || incidents.length === 0) {
    const err = new Error('Historical dataset not seeded. Please run npm run seed.');
    err.status = 404;
    err.code = 'HISTORY_NOT_SEEDED';
    throw err;
  }

  // Format incidents for pure forecast engine
  const formatted = incidents.map((inc) => ({
    weekIndex: inc.weekIndex,
    location: {
      lat: inc.location.coordinates[1],
      lng: inc.location.coordinates[0],
    },
    category: inc.category,
  }));

  const forecastResult = computeHotspotForecast(formatted, Number(weeks) || 12, 12);

  // Live this week unique active events count
  const liveCount = await WasteEvent.countDocuments({
    status: { $in: ['SUBMITTED', 'VERIFIED', 'SCHEDULED'] },
  });

  return {
    ...forecastResult,
    liveThisWeek: {
      uniqueEvents: liveCount,
      note: 'Live events for the current incomplete week (excluded from baseline model).',
    },
  };
}
