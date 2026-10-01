import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { RouteData, WasteEventSummary, RouteStop } from '../../types/api.ts';

/**
 * Calculates bearing in degrees between two coordinates (0 = North, 90 = East, etc.)
 */
export function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLng);

  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

/**
 * Calculates great-circle distance between two points in meters
 */
export function haversineDistanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface GeometryMeta {
  cumulativeDistances: number[];
  totalDistanceM: number;
}

function computeGeometryMeta(geometry: [number, number][]): GeometryMeta {
  if (!geometry || geometry.length === 0) {
    return { cumulativeDistances: [0], totalDistanceM: 0 };
  }

  const cumulativeDistances = [0];
  let total = 0;

  for (let i = 0; i < geometry.length - 1; i++) {
    const d = haversineDistanceM(
      geometry[i][0],
      geometry[i][1],
      geometry[i + 1][0],
      geometry[i + 1][1]
    );
    total += d;
    cumulativeDistances.push(total);
  }

  return { cumulativeDistances, totalDistanceM: Math.max(1, total) };
}

export interface StopWaypoint {
  stop: RouteStop;
  event?: WasteEventSummary;
  distanceM: number;
  coord: [number, number];
}

export function mapStopsToDistances(
  geometry: [number, number][],
  cumulativeDistances: number[],
  stops: RouteStop[],
  events: WasteEventSummary[]
): StopWaypoint[] {
  if (!geometry || geometry.length === 0 || !stops || stops.length === 0) {
    return [];
  }

  let lastIndex = 0;
  const results: StopWaypoint[] = [];

  for (const stop of stops) {
    const ev = events.find((e) => e.id === stop.eventId);
    if (!ev) continue;

    const stopLat = ev.location.lat;
    const stopLng = ev.location.lng;

    // Find nearest vertex along geometry at or after lastIndex
    let bestDist = Infinity;
    let bestIdx = lastIndex;

    for (let i = lastIndex; i < geometry.length; i++) {
      const d = haversineDistanceM(stopLat, stopLng, geometry[i][0], geometry[i][1]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }

    lastIndex = Math.min(geometry.length - 1, bestIdx + 1);
    results.push({
      stop,
      event: ev,
      distanceM: cumulativeDistances[bestIdx] || 0,
      coord: [stopLat, stopLng],
    });
  }

  return results;
}

export interface RouteSimulationState {
  currentDistanceM: number;
  totalDistanceM: number;
  truckPosition: [number, number];
  truckHeading: number;
  completedGeometry: [number, number][];
  remainingGeometry: [number, number][];
  completedStopIds: Set<string>;
  activeStopIndex: number; // index in route.stops, -1 if at depot
  currentLoadKg: number;
  remainingCapacityKg: number;
  isPlaying: boolean;
  isCompleted: boolean;
  speed: number;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  reset: () => void;
  stepNextStop: () => void;
  setSpeed: (speed: number) => void;
}

export function useRouteSimulation(
  route: RouteData | null,
  events: WasteEventSummary[] = [],
  onStopCompleted?: (stop: RouteStop, event?: WasteEventSummary) => void
): RouteSimulationState {
  const [currentDistanceM, setCurrentDistanceM] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(3); // default 3x speed for fluid demo
  const [completedStopIds, setCompletedStopIds] = useState<Set<string>>(new Set());

  const geometry = route?.geometry || [];
  const meta = useMemo(() => computeGeometryMeta(geometry), [geometry]);
  const stopWaypoints = useMemo(
    () => mapStopsToDistances(geometry, meta.cumulativeDistances, route?.stops || [], events),
    [geometry, meta.cumulativeDistances, route?.stops, events]
  );

  // Initialize or reconcile when route changes
  useEffect(() => {
    if (!route) {
      setCurrentDistanceM(0);
      setIsPlaying(false);
      setCompletedStopIds(new Set());
      return;
    }

    // If route has pre-existing DONE stops (e.g. after replanning), find distance of last DONE stop
    const doneStops = (route.stops || []).filter((s) => s.state === 'DONE');
    if (doneStops.length > 0) {
      const doneIds = new Set(doneStops.map((s) => s.eventId));
      setCompletedStopIds(doneIds);

      // Find highest distance among done stops
      let highestDoneDist = 0;
      for (const sw of stopWaypoints) {
        if (doneIds.has(sw.stop.eventId)) {
          highestDoneDist = Math.max(highestDoneDist, sw.distanceM);
        }
      }
      setCurrentDistanceM(highestDoneDist);
    } else {
      setCurrentDistanceM(0);
      setCompletedStopIds(new Set());
    }
  }, [route?.id, route?.planVersion]);

  // RequestAnimationFrame Simulation Loop
  const lastTimeRef = useRef<number | null>(null);
  const currentDistRef = useRef<number>(currentDistanceM);
  currentDistRef.current = currentDistanceM;

  const isPlayingRef = useRef<boolean>(isPlaying);
  isPlayingRef.current = isPlaying;

  const speedRef = useRef<number>(speed);
  speedRef.current = speed;

  const completedIdsRef = useRef<Set<string>>(completedStopIds);
  completedIdsRef.current = completedStopIds;

  useEffect(() => {
    let animId: number;

    const step = (time: number) => {
      if (lastTimeRef.current !== null && isPlayingRef.current && meta.totalDistanceM > 0) {
        const deltaSec = (time - lastTimeRef.current) / 1000;
        // Base vehicle speed: 45 km/h ≈ 12.5 m/s
        const speedMultiplier = speedRef.current;
        const advanceM = 12.5 * speedMultiplier * deltaSec;

        const nextDist = Math.min(meta.totalDistanceM, currentDistRef.current + advanceM);
        setCurrentDistanceM(nextDist);

        // Check for newly reached stops
        const newlyDone: StopWaypoint[] = [];
        const nextCompleted = new Set(completedIdsRef.current);

        for (const sw of stopWaypoints) {
          if (!nextCompleted.has(sw.stop.eventId) && nextDist >= sw.distanceM) {
            nextCompleted.add(sw.stop.eventId);
            newlyDone.push(sw);
          }
        }

        if (newlyDone.length > 0) {
          setCompletedStopIds(nextCompleted);
          if (onStopCompleted) {
            newlyDone.forEach((item) => onStopCompleted(item.stop, item.event));
          }
        }

        if (nextDist >= meta.totalDistanceM) {
          setIsPlaying(false);
        }
      }

      lastTimeRef.current = time;
      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [meta.totalDistanceM, stopWaypoints, onStopCompleted]);

  // Compute interpolated position and heading along polyline
  const { truckPosition, truckHeading, completedGeometry, remainingGeometry } = useMemo(() => {
    if (!geometry || geometry.length === 0) {
      const defaultCoord: [number, number] = [19.2071, 72.876];
      return {
        truckPosition: defaultCoord,
        truckHeading: 0,
        completedGeometry: [],
        remainingGeometry: [],
      };
    }

    if (geometry.length === 1 || currentDistanceM <= 0) {
      const heading =
        geometry.length > 1
          ? calculateBearing(geometry[0][0], geometry[0][1], geometry[1][0], geometry[1][1])
          : 0;
      return {
        truckPosition: geometry[0],
        truckHeading: heading,
        completedGeometry: [geometry[0]],
        remainingGeometry: geometry,
      };
    }

    if (currentDistanceM >= meta.totalDistanceM) {
      const last = geometry[geometry.length - 1];
      const prev = geometry[geometry.length - 2];
      const heading = calculateBearing(prev[0], prev[1], last[0], last[1]);
      return {
        truckPosition: last,
        truckHeading: heading,
        completedGeometry: geometry,
        remainingGeometry: [last],
      };
    }

    // Binary search for segment where cumulativeDistances[i] <= currentDistanceM <= cumulativeDistances[i+1]
    const dists = meta.cumulativeDistances;
    let segIdx = 0;
    for (let i = 0; i < dists.length - 1; i++) {
      if (currentDistanceM >= dists[i] && currentDistanceM <= dists[i + 1]) {
        segIdx = i;
        break;
      }
    }

    const d0 = dists[segIdx];
    const d1 = dists[segIdx + 1];
    const segLen = d1 - d0;
    const ratio = segLen > 0 ? (currentDistanceM - d0) / segLen : 0;

    const p0 = geometry[segIdx];
    const p1 = geometry[segIdx + 1];

    const lat = p0[0] + ratio * (p1[0] - p0[0]);
    const lng = p0[1] + ratio * (p1[1] - p0[1]);
    const currentPoint: [number, number] = [lat, lng];

    const heading = calculateBearing(p0[0], p0[1], p1[0], p1[1]);

    const compGeom = [...geometry.slice(0, segIdx + 1), currentPoint];
    const remGeom = [currentPoint, ...geometry.slice(segIdx + 1)];

    return {
      truckPosition: currentPoint,
      truckHeading: heading,
      completedGeometry: compGeom,
      remainingGeometry: remGeom,
    };
  }, [geometry, currentDistanceM, meta]);

  // Compute active stop index and current capacity
  const { activeStopIndex, currentLoadKg, remainingCapacityKg } = useMemo(() => {
    let nextIdx = 0;
    let accumulatedKg = 0;

    const stops = route?.stops || [];
    for (let i = 0; i < stops.length; i++) {
      const s = stops[i];
      if (completedStopIds.has(s.eventId)) {
        accumulatedKg += s.weightKg || 0;
        nextIdx = i + 1;
      }
    }

    const vehicleCapacity = route?.totals?.capacityKg || 1000;
    const remainingCap = Math.max(0, vehicleCapacity - accumulatedKg);

    return {
      activeStopIndex: nextIdx < stops.length ? nextIdx : stops.length,
      currentLoadKg: accumulatedKg,
      remainingCapacityKg: remainingCap,
    };
  }, [route?.stops, route?.totals?.capacityKg, completedStopIds]);

  const play = useCallback(() => {
    if (currentDistanceM >= meta.totalDistanceM) {
      setCurrentDistanceM(0);
      setCompletedStopIds(new Set());
    }
    setIsPlaying(true);
  }, [currentDistanceM, meta.totalDistanceM]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, pause, play]);

  const reset = useCallback(() => {
    setIsPlaying(false);
    setCurrentDistanceM(0);
    setCompletedStopIds(new Set());
  }, []);

  const stepNextStop = useCallback(() => {
    if (stopWaypoints.length === 0) return;

    // Find the next incomplete waypoint
    const nextWaypoint = stopWaypoints.find((sw) => !completedStopIds.has(sw.stop.eventId));
    if (nextWaypoint) {
      setCurrentDistanceM(nextWaypoint.distanceM);
      const nextCompleted = new Set(completedStopIds);
      nextCompleted.add(nextWaypoint.stop.eventId);
      setCompletedStopIds(nextCompleted);
      if (onStopCompleted) {
        onStopCompleted(nextWaypoint.stop, nextWaypoint.event);
      }
    } else {
      // All stops done, step to depot end
      setCurrentDistanceM(meta.totalDistanceM);
      setIsPlaying(false);
    }
  }, [stopWaypoints, completedStopIds, meta.totalDistanceM, onStopCompleted]);

  return {
    currentDistanceM,
    totalDistanceM: meta.totalDistanceM,
    truckPosition,
    truckHeading,
    completedGeometry,
    remainingGeometry,
    completedStopIds,
    activeStopIndex,
    currentLoadKg,
    remainingCapacityKg,
    isPlaying,
    isCompleted: currentDistanceM >= meta.totalDistanceM && meta.totalDistanceM > 0,
    speed,
    play,
    pause,
    togglePlay,
    reset,
    stepNextStop,
    setSpeed,
  };
}
