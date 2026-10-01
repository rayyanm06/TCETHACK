import { Notification } from '../models/Notification.js';
import { WasteEvent } from '../models/WasteEvent.js';
import { Route } from '../models/Route.js';

/**
 * Ensures real backend state drives persistent notifications with stable deduplication keys.
 */
export async function syncOperatorNotifications() {
  try {
    // 1. Check Active Events for Critical & High Priority Alerts (strictly excluding seed data)
    const activeEvents = await WasteEvent.find({
      status: { $in: ['SUBMITTED', 'VERIFIED', 'SCHEDULED'] },
      isSeed: { $ne: true },
    }).lean();

    for (const ev of activeEvents) {
      const tier = ev.priority?.tier || 'Low';
      const isCriticalOrHigh = tier === 'Critical' || tier === 'High';

      if (isCriticalOrHigh) {
        const dedupKey = `prio_${ev._id}_${tier.toLowerCase()}`;
        const existing = await Notification.findOne({ dedupKey });
        if (!existing) {
          const areaName = ev.addressText || 'Municipal Sector';
          const title =
            tier === 'Critical'
              ? `CRITICAL ATTENTION: ${ev.code} Requires Urgent Dispatch`
              : `HIGH PRIORITY: ${ev.code} Verified in ${areaName.split(',')[0]}`;
          const message =
            ev.priority?.sentence ||
            `Urgent ${ev.category.toLowerCase()} waste incident with score ${ev.priority?.score}/100. Verification confirmed at ${ev.addressText}.`;

          await Notification.create({
            recipientRole: 'OPERATOR',
            type: 'HIGH_PRIORITY',
            title,
            message,
            severity: tier === 'Critical' ? 'CRITICAL' : 'HIGH',
            eventId: ev._id,
            eventCode: ev.code,
            locationText: ev.addressText,
            coordinates: {
              lat: ev.location.coordinates[1],
              lng: ev.location.coordinates[0],
            },
            isRead: false,
            isSeed: false,
            dedupKey,
          });
        }
      }

      // Check newly verified events awaiting collection scheduling
      if (ev.status === 'VERIFIED' && !ev.assignedRouteId && !isCriticalOrHigh) {
        const dedupKey = `verif_${ev._id}`;
        const existing = await Notification.findOne({ dedupKey });
        if (!existing) {
          await Notification.create({
            recipientRole: 'OPERATOR',
            type: 'NEW_VERIFIED',
            title: `New Verified Waste Incident: ${ev.code}`,
            message: `Event in ${ev.addressText || 'Sector'} has been operator-verified (${ev.estimatedWeightKg || 0} kg ${ev.category.toLowerCase()}). Ready for route inclusion.`,
            severity: 'NORMAL',
            eventId: ev._id,
            eventCode: ev.code,
            locationText: ev.addressText,
            coordinates: {
              lat: ev.location.coordinates[1],
              lng: ev.location.coordinates[0],
            },
            isRead: false,
            isSeed: false,
            dedupKey,
          });
        }
      }
      // Check overdue verified events
      const hoursPending = (Date.now() - new Date(ev.firstReportedAt).getTime()) / (1000 * 60 * 60);
      if (ev.status === 'VERIFIED' && hoursPending > 48 && isCriticalOrHigh) {
        const dedupKey = `overdue_${ev._id}`;
        const existing = await Notification.findOne({ dedupKey });
        if (!existing) {
          await Notification.create({
            recipientRole: 'OPERATOR',
            type: 'OVERDUE',
            title: `OVERDUE NOTICE: ${ev.code} Pending > 48h`,
            message: `High-priority incident at ${ev.addressText || 'Sector'} has remained unresolved beyond the standard SLA window. Immediate assignment advised.`,
            severity: 'HIGH',
            eventId: ev._id,
            eventCode: ev.code,
            locationText: ev.addressText,
            coordinates: {
              lat: ev.location.coordinates[1],
              lng: ev.location.coordinates[0],
            },
            isRead: false,
            isSeed: false,
            dedupKey,
          });
        }
      }
    }

    // 2. Check Recently Resolved Events (strictly excluding seed data)
    const recentResolved = await WasteEvent.find({ status: 'RESOLVED', isSeed: { $ne: true } })
      .sort({ resolvedAt: -1 })
      .limit(10)
      .lean();
    for (const resEv of recentResolved) {
      const dedupKey = `res_${resEv._id}`;
      const existing = await Notification.findOne({ dedupKey });
      if (!existing) {
        await Notification.create({
          recipientRole: 'OPERATOR',
          type: 'RESOLUTION',
          title: `Collection Completed: ${resEv.code}`,
          message: `Waste event ${resEv.code} has been cleared and verified in ${resEv.addressText || 'Municipal Sector'}.`,
          severity: 'NORMAL',
          eventId: resEv._id,
          eventCode: resEv.code,
          locationText: resEv.addressText,
          coordinates: {
            lat: resEv.location.coordinates[1],
            lng: resEv.location.coordinates[0],
          },
          isRead: false,
          isSeed: false,
          dedupKey,
        });
      }
    }

    // 3. Check Routes for Capacity & Replanning Events (strictly excluding seed data)
    const routes = await Route.find({ isSeed: { $ne: true } }).sort({ updatedAt: -1 }).limit(10).lean();
    for (const r of routes) {
      // Capacity issues
      if (r.deferred && r.deferred.length > 0) {
        for (const def of r.deferred) {
          if (def.reason === 'CAPACITY') {
            const dedupKey = `route_cap_${r._id}_${def.eventId}`;
            const existing = await Notification.findOne({ dedupKey });
            if (!existing) {
              const ev = await WasteEvent.findById(def.eventId).lean();
              if (!ev || ev.isSeed) continue;
              await Notification.create({
                recipientRole: 'OPERATOR',
                type: 'CAPACITY_EXCEEDED',
                title: `Payload Limit Exceeded: ${ev?.code || 'Incident'} Deferred`,
                message: `${def.detail || 'Incident load exceeds vehicle capacity'}. Retained in queue for next dispatch cycle.`,
                severity: 'HIGH',
                eventId: def.eventId,
                eventCode: ev?.code,
                locationText: ev?.addressText,
                coordinates: ev
                  ? { lat: ev.location.coordinates[1], lng: ev.location.coordinates[0] }
                  : undefined,
                isRead: false,
                isSeed: false,
                dedupKey,
              });
            }
          }
        }
      }

      // Replanned routes with congestion
      if (r.congestionZones && r.congestionZones.length > 0 && r.planVersion > 1) {
        const dedupKey = `route_replan_${r._id}_v${r.planVersion}`;
        const existing = await Notification.findOne({ dedupKey });
        if (!existing) {
          await Notification.create({
            recipientRole: 'OPERATOR',
            type: 'ROUTE_CHANGE',
            title: `Route Dynamic Re-sequence: Vehicle ${r.vehicle?.name || 'A'}`,
            message: `Route replanned due to simulated roadworks congestion. Remaining sequence adjusted to minimize road transit delay.`,
            severity: 'HIGH',
            isRead: false,
            dedupKey,
          });
        }
      }
    }
  } catch (err) {
    console.warn('[NotificationSync] Warning during sync:', err.message);
  }
}

/**
 * Creates or updates a citizen-facing notification with deduplication
 */
export async function createCitizenNotification({
  recipientUserId,
  reportId = null,
  eventId = null,
  eventCode = null,
  type,
  title,
  message,
  severity = 'NORMAL',
  coordinates = null,
  locationText = null,
  dedupKey,
}) {
  if (!recipientUserId) return null;
  const existing = await Notification.findOne({ dedupKey });
  if (existing) return existing;

  return await Notification.create({
    recipientRole: 'CITIZEN',
    recipientUserId,
    reportId,
    eventId,
    eventCode,
    type,
    title,
    message,
    severity,
    coordinates: coordinates || undefined,
    locationText,
    isRead: false,
    dedupKey,
  });
}

/**
 * Creates or updates an operator-facing notification with deduplication
 */
export async function createOperatorNotification({
  eventId = null,
  eventCode = null,
  type,
  title,
  message,
  severity = 'NORMAL',
  coordinates = null,
  locationText = null,
  dedupKey,
}) {
  const existing = await Notification.findOne({ dedupKey });
  if (existing) return existing;

  return await Notification.create({
    recipientRole: 'OPERATOR',
    eventId,
    eventCode,
    type,
    title,
    message,
    severity,
    coordinates: coordinates || undefined,
    locationText,
    isRead: false,
    dedupKey,
  });
}

/**
 * Returns citizen notifications for a specific user (strictly excluding seed data)
 */
export async function getCitizenNotifications(userId) {
  const query = {
    $or: [{ recipientUserId: userId }, { recipientRole: 'CITIZEN', recipientUserId: userId }],
    isSeed: { $ne: true },
  };

  const items = await Notification.find(query).sort({ createdAt: -1 }).limit(50).lean();
  const unreadCount = await Notification.countDocuments({
    ...query,
    isRead: false,
  });

  return {
    items: items.map((n) => ({
      id: n._id.toString(),
      type: n.type,
      title: n.title,
      message: n.message,
      severity: n.severity,
      eventId: n.eventId ? n.eventId.toString() : null,
      eventCode: n.eventCode,
      reportId: n.reportId ? n.reportId.toString() : null,
      locationText: n.locationText,
      coordinates: n.coordinates,
      isRead: n.isRead,
      createdAt: n.createdAt,
    })),
    unreadCount,
    criticalCount: 0,
  };
}

/**
 * Returns operator notifications with counts (strictly excluding seed data)
 */
export async function getOperatorNotifications(filter = 'ALL') {
  await syncOperatorNotifications();

  const query = { recipientRole: 'OPERATOR', isSeed: { $ne: true } };
  if (filter === 'HIGH_PRIORITY') {
    query.severity = { $in: ['CRITICAL', 'HIGH'] };
  } else if (filter === 'ROUTE') {
    query.type = { $in: ['ROUTE_CHANGE', 'CAPACITY_EXCEEDED'] };
  } else if (filter === 'COLLECTION') {
    query.type = { $in: ['NEW_VERIFIED', 'RESOLUTION'] };
  } else if (filter === 'SYSTEM') {
    query.type = 'SYSTEM';
  }

  const items = await Notification.find(query).sort({ createdAt: -1 }).limit(50).lean();
  const unreadCount = await Notification.countDocuments({ recipientRole: 'OPERATOR', isRead: false, isSeed: { $ne: true } });
  const criticalCount = await Notification.countDocuments({
    recipientRole: 'OPERATOR',
    isRead: false,
    severity: 'CRITICAL',
    isSeed: { $ne: true },
  });

  return {
    items: items.map((n) => ({
      id: n._id.toString(),
      type: n.type,
      title: n.title,
      message: n.message,
      severity: n.severity,
      eventId: n.eventId ? n.eventId.toString() : null,
      eventCode: n.eventCode,
      locationText: n.locationText,
      coordinates: n.coordinates,
      isRead: n.isRead,
      createdAt: n.createdAt,
    })),
    unreadCount,
    criticalCount,
  };
}

export async function markNotificationRead(id, userId, role) {
  const query = { _id: id };
  if (role === 'CITIZEN') {
    query.recipientUserId = userId;
  }
  const updated = await Notification.findOneAndUpdate(query, { isRead: true }, { new: true }).lean();
  return updated;
}

export async function markAllNotificationsRead(userId, role) {
  if (role === 'CITIZEN') {
    await Notification.updateMany({ recipientUserId: userId, isRead: false }, { isRead: true });
  } else {
    await Notification.updateMany({ recipientRole: 'OPERATOR', isRead: false }, { isRead: true });
  }
  return { ok: true };
}
