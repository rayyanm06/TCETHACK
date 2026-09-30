/**
 * CivicClean Unified Lifecycle & Timeline Presentation
 * Cleanly separates actual historical events from explanatory future next steps.
 * Handles category-specific workflows (compactor collection vs specialist take-back vs household review).
 */

export interface HistoryEventItem {
  stage: string;
  label: string;
  actorRole: 'CITIZEN' | 'OPERATOR' | 'SYSTEM' | string;
  actorLabel: string;
  timestamp: string;
  note?: string;
  isTerminal?: boolean;
}

export interface NextStepExplanation {
  title: string;
  description: string;
  actor: 'CITIZEN' | 'OPERATOR' | 'COLLECTION_TEAM' | 'SPECIALIST_RECYCLER';
  actorLabel: string;
  timelineStepNumber: number;
}

export interface LifecyclePresentation {
  currentStatus: string;
  statusLabel: string;
  statusBadgeClass: string;
  history: HistoryEventItem[];
  nextSteps: NextStepExplanation[];
  categoryHandlingNote: string;
  isSpecialist: boolean;
  isHousehold: boolean;
}

export function getLifecyclePresentation(params: {
  status: string;
  category?: string;
  reportType?: 'PUBLIC' | 'HOUSEHOLD' | string;
  specialistQueue?: string;
  specialistFlag?: boolean;
  assignedRouteId?: string | null;
  timeline?: Array<{
    to: string;
    actorRole?: string;
    createdAt: string;
    note?: string;
  }>;
  closure?: any;
}): LifecyclePresentation {
  const {
    status = 'SUBMITTED',
    category = 'MIXED',
    reportType = 'PUBLIC',
    specialistQueue = 'NONE',
    specialistFlag = false,
    assignedRouteId,
    timeline = [],
    closure,
  } = params;

  const isHousehold = reportType === 'HOUSEHOLD';
  const isEWaste = category === 'E_WASTE' || specialistQueue === 'E_WASTE';
  const isSpecialist = isEWaste || specialistFlag || specialistQueue === 'HAZARDOUS';

  // 1. Build Actual History from persisted StatusEvent records
  const history: HistoryEventItem[] = timeline.map((evt) => {
    let actorLabel = 'System Process';
    if (evt.actorRole === 'OPERATOR') actorLabel = 'Municipal Operations Team';
    else if (evt.actorRole === 'CITIZEN') actorLabel = 'Reporting Citizen';

    let stageLabel = evt.to;
    switch (evt.to) {
      case 'SUBMITTED':
        stageLabel = isHousehold ? 'Disposal Request Submitted' : 'Waste Incident Reported';
        break;
      case 'VERIFIED':
        stageLabel = 'Verified by Operations';
        break;
      case 'SCHEDULED':
        stageLabel = 'Collection Route Assigned';
        break;
      case 'RESOLVED':
        stageLabel = isSpecialist ? 'Specialist Recycler Handoff Recorded' : 'Site Cleared & Resolved';
        break;
      case 'REJECTED':
        stageLabel = 'Incident Reviewed & Closed';
        break;
      case 'REOPENED':
        stageLabel = 'Disputed & Reopened for Inspection';
        break;
    }

    return {
      stage: evt.to,
      label: stageLabel,
      actorRole: evt.actorRole || 'SYSTEM',
      actorLabel,
      timestamp: evt.createdAt,
      note: evt.note,
    };
  });

  // If no timeline array was supplied, synthesize initial submission record
  if (history.length === 0) {
    history.push({
      stage: 'SUBMITTED',
      label: isHousehold ? 'Disposal Request Submitted' : 'Waste Incident Reported',
      actorRole: 'CITIZEN',
      actorLabel: 'Reporting Citizen',
      timestamp: new Date().toISOString(),
    });
  }

  // 2. Derive Current Status & Plain Language Label
  let statusLabel = status;
  let statusBadgeClass = 'bg-surface-2 text-ink-3 border border-line';

  switch (status) {
    case 'SUBMITTED':
      statusLabel = 'Under Review';
      statusBadgeClass = 'bg-ochre-100 text-ochre-700 border border-ochre/30';
      break;
    case 'VERIFIED':
      statusLabel = isSpecialist ? 'Verified (Awaiting Recycler)' : 'Verified for Collection';
      statusBadgeClass = 'bg-moss-100 text-moss-700 border border-moss/30';
      break;
    case 'SCHEDULED':
      statusLabel = 'Collection Scheduled';
      statusBadgeClass = 'bg-lagoon-100 text-lagoon-700 border border-lagoon/30';
      break;
    case 'RESOLVED':
      statusLabel = isSpecialist ? 'Transferred to Recycler' : 'Cleared & Verified';
      statusBadgeClass = 'bg-moss-700 text-surface border border-moss-700';
      break;
    case 'REOPENED':
      statusLabel = 'Disputed / Under Re-inspection';
      statusBadgeClass = 'bg-clay-100 text-clay border border-clay/30';
      break;
    case 'REJECTED':
      statusLabel = 'Closed (No Action)';
      statusBadgeClass = 'bg-surface-2 text-ink-3 border border-line';
      break;
  }

  // 3. Category Handling Explanation
  let categoryHandlingNote = '';
  if (isEWaste) {
    categoryHandlingNote =
      'Electronic waste is strictly segregated under MPCB/CPCB e-waste rules. It is not placed in ordinary compactor trucks; it is directed to authorized recycling channels.';
  } else if (isHousehold) {
    categoryHandlingNote =
      'Household disposal requests remain confidential. Address and device details are shielded from public maps and visible only to authorized field coordinators.';
  } else {
    categoryHandlingNote =
      'Public waste incidents are consolidated into daily collection sector routes once verified by operational inspection.';
  }

  // 4. Expected Future Next Steps (Plain Language, No False Progress)
  const nextSteps: NextStepExplanation[] = [];

  if (status === 'SUBMITTED' || status === 'REOPENED') {
    nextSteps.push({
      title: 'Operational Inspection & Verification',
      description: isHousehold
        ? 'Field coordinators review item quantity and assess authorized take-back capacity. Pickup is not automatically guaranteed.'
        : 'Municipal operations review photographic evidence, check for nearby reports, and verify accessibility.',
      actor: 'OPERATOR',
      actorLabel: 'Field Operations Supervisor',
      timelineStepNumber: 1,
    });
    if (isSpecialist) {
      nextSteps.push({
        title: 'Specialist Recycler Coordination',
        description: 'Awaiting handling arrangements with an authorized recycler for safe transfer and receipt.',
        actor: 'SPECIALIST_RECYCLER',
        actorLabel: 'Authorized Recycler Partner',
        timelineStepNumber: 2,
      });
    } else {
      nextSteps.push({
        title: 'Collection Assignment',
        description: 'Once verified, eligible public waste will be included in the next sector compactor route.',
        actor: 'COLLECTION_TEAM',
        actorLabel: 'Municipal Ward Collection Crew',
        timelineStepNumber: 2,
      });
    }
  } else if (status === 'VERIFIED') {
    if (isSpecialist) {
      nextSteps.push({
        title: 'Awaiting Handling Arrangements',
        description:
          'Specialist take-back arrangements are pending with authorized e-waste facilities. Collection will not occur via ordinary compactor trucks.',
        actor: 'OPERATOR',
        actorLabel: 'Specialist Operations Coordinator',
        timelineStepNumber: 1,
      });
      nextSteps.push({
        title: 'Recorded Handoff & Acceptance Evidence',
        description:
          'Clearance will be completed when the operator records photographic evidence and receiving facility details.',
        actor: 'OPERATOR',
        actorLabel: 'Operator Recording Closure',
        timelineStepNumber: 2,
      });
    } else if (assignedRouteId) {
      nextSteps.push({
        title: 'In Collection Queue',
        description: 'Assigned to active vehicle route. Field crew is scheduled to clear this incident.',
        actor: 'COLLECTION_TEAM',
        actorLabel: 'Ward Compactor Crew',
        timelineStepNumber: 1,
      });
    } else {
      nextSteps.push({
        title: 'Sector Route Planning',
        description: 'Verified incident is queued for inclusion in the next optimized collection schedule.',
        actor: 'OPERATOR',
        actorLabel: 'Route Logistics Planner',
        timelineStepNumber: 1,
      });
    }
  } else if (status === 'SCHEDULED') {
    nextSteps.push({
      title: 'Vehicle Dispatch & Field Collection',
      description: 'Collection vehicle is assigned. Crew will photograph the cleared site upon job completion.',
      actor: 'COLLECTION_TEAM',
      actorLabel: 'Collection Truck Crew',
      timelineStepNumber: 1,
    });
  } else if (status === 'RESOLVED') {
    nextSteps.push({
      title: 'Audit & Citizen Inspection',
      description:
        'Incident closed. Citizen can inspect photographic completion evidence. If waste remains, citizen can dispute and reopen within 7 days.',
      actor: 'CITIZEN',
      actorLabel: 'Reporting Citizen',
      timelineStepNumber: 1,
    });
  }

  return {
    currentStatus: status,
    statusLabel,
    statusBadgeClass,
    history,
    nextSteps,
    categoryHandlingNote,
    isSpecialist,
    isHousehold,
  };
}
