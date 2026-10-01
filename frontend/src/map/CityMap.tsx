import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  WasteEventSummary,
  RouteData,
  CongestionZone,
  ForecastCell,
  HotspotBlock,
} from '../types/api.ts';
import {
  createWasteMarker,
  createDepotMarker,
  createStopTransitIcon,
  createGarbageTruckMarker,
} from './markerUtils.ts';
import '../styles/map.css';

interface CityMapProps {
  events?: WasteEventSummary[];
  depot?: { name: string; lat: number; lng: number };
  selectedEventId?: string | null;
  onSelectEvent?: (eventId: string) => void;
  blocks?: HotspotBlock[];
  selectedBlockId?: string | null;
  onSelectBlock?: (block: HotspotBlock) => void;
  route?: RouteData | null;
  completedGeometry?: [number, number][];
  remainingGeometry?: [number, number][];
  completedStopIds?: Set<string>;
  truckPosition?: [number, number] | null;
  truckHeading?: number;
  isTruckMoving?: boolean;
  onSelectTruck?: () => void;
  congestionZones?: CongestionZone[];
  onMapClick?: (lat: number, lng: number) => void;
  focusLocation?: { lat: number; lng: number; zoom?: number } | null;
  forecastMode?: 'NOW' | 'FORECAST';
  forecastCells?: ForecastCell[];
  historyCells?: Array<{ cellId: string; center: { lat: number; lng: number }; count: number }>;
  height?: string;
  interactive?: boolean;
  center?: [number, number];
  zoom?: number;
}

export const CityMap: React.FC<CityMapProps> = ({
  events = [],
  depot = { name: 'North Municipal Central Depot', lat: 19.2071, lng: 72.876 },
  selectedEventId,
  onSelectEvent,
  blocks = [],
  selectedBlockId,
  onSelectBlock,
  route,
  completedGeometry,
  remainingGeometry,
  completedStopIds = new Set(),
  truckPosition,
  truckHeading = 0,
  isTruckMoving = false,
  onSelectTruck,
  congestionZones = [],
  onMapClick,
  focusLocation,
  forecastMode,
  forecastCells = [],
  historyCells = [],
  height = '100%',
  interactive = true,
  center = [19.2071, 72.876],
  zoom = 11,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const truckLayerRef = useRef<L.LayerGroup | null>(null);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center,
      zoom,
      zoomControl: interactive,
      dragging: interactive,
      touchZoom: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      attributionControl: true,
    });

    const tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    const attribution =
      '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors · CivicClean Municipal Operations';

    L.tileLayer(tileUrl, {
      attribution,
      maxZoom: 19,
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    const truckLayer = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    layerGroupRef.current = layerGroup;
    truckLayerRef.current = truckLayer;

    if (onMapClick) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });
    }

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update base layers whenever data changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layers = layerGroupRef.current;
    if (!map || !layers) return;

    layers.clearLayers();

    // 1. Draw Service Area Boundary (Greater Mumbai / MMR operational perimeter)
    const serviceAreaBbox: [number, number][] = [
      [18.95, 72.78],
      [19.34, 72.78],
      [19.34, 73.18],
      [18.95, 73.18],
    ];
    L.polygon(serviceAreaBbox, {
      color: '#2E6B4E',
      weight: 1,
      dashArray: '4, 6',
      fill: false,
      opacity: 0.35,
    }).addTo(layers);

    // 2. Draw Hotspot Blocks (Localized municipal operational sectors)
    if (blocks && blocks.length > 0) {
      blocks.forEach((b) => {
        const isSelected = selectedBlockId === b.id;
        const isCritical = b.priorityTier === 'Critical';
        const isHigh = b.priorityTier === 'High';
        const isNormal = b.priorityTier === 'Normal';

        const strokeColor = isSelected
          ? '#0E6A78'
          : isCritical
          ? '#C4492F'
          : isHigh
          ? '#C48A12'
          : isNormal
          ? '#2E6B4E'
          : '#5F6D64';

        const fillColor = strokeColor;
        const fillOpacity = isSelected ? 0.25 : isCritical ? 0.16 : isHigh ? 0.13 : 0.08;
        const weight = isSelected ? 2.5 : isCritical || isHigh ? 1.8 : 1.2;

        const polygon = L.polygon(b.polygon, {
          color: strokeColor,
          weight,
          dashArray: isCritical ? undefined : '3, 4',
          fillColor,
          fillOpacity,
        });

        // Tooltip on hover
        polygon.bindTooltip(
          `<div class="p-1 font-sans text-xs">
            <div class="font-bold text-ink">${b.name}</div>
            <div class="text-[10px] text-ink-3">${b.area} · Code: ${b.code}</div>
            <div class="mt-1 flex items-center gap-1.5 text-[10px]">
              <span class="font-bold text-ink">${b.eventCount} incidents</span>
              <span>·</span>
              <span class="font-mono text-ink-2">${b.estimatedLoadKg} kg</span>
              <span>·</span>
              <span class="font-bold ${
                isCritical ? 'text-clay' : isHigh ? 'text-ochre' : 'text-moss'
              }">${b.priorityTier} priority</span>
            </div>
          </div>`,
          {
            sticky: true,
            className: 'hotspot-block-tooltip',
          }
        );

        // Click popup
        const statusBadgeBg = isCritical
          ? 'bg-clay text-surface'
          : isHigh
          ? 'bg-ochre text-surface'
          : 'bg-moss text-surface';

        polygon.bindPopup(
          `<div class="p-3 font-sans text-xs min-w-[220px]">
            <div class="flex items-center justify-between mb-1">
              <span class="text-[10px] font-mono font-bold text-ink-3">${b.code}</span>
              <span class="text-[9px] uppercase px-1.5 py-0.5 rounded font-bold ${statusBadgeBg}">${b.priorityTier}</span>
            </div>
            <h4 class="font-bold text-ink text-sm leading-tight">${b.name}</h4>
            <p class="text-[11px] text-ink-2 mb-2">${b.area}</p>
            <p class="text-[10px] text-ink-3 mb-2.5 leading-snug">${b.description}</p>
            <div class="grid grid-cols-2 gap-1.5 p-2 bg-surface-2 rounded border border-line mb-2 text-center">
              <div>
                <span class="block text-[10px] text-ink-3">Active Incidents</span>
                <span class="font-bold text-xs text-ink">${b.eventCount}</span>
              </div>
              <div>
                <span class="block text-[10px] text-ink-3">Estimated Load</span>
                <span class="font-bold text-xs text-ink">${b.estimatedLoadKg} kg</span>
              </div>
            </div>
          </div>`,
          { className: 'hotspot-block-popup' }
        );

        polygon.on('click', () => {
          if (onSelectBlock) onSelectBlock(b);
        });

        polygon.addTo(layers);
      });
    }

    // 3. Draw Depot
    if (depot) {
      const depotMarker = L.marker([depot.lat, depot.lng], {
        icon: createDepotMarker(depot.name),
        zIndexOffset: 1000,
      });
      depotMarker.bindPopup(`<b>${depot.name}</b><br/>Municipal Fleet Dispatch Base`);
      depotMarker.addTo(layers);
    }

    // 4. Draw Congestion Zones
    for (const zone of congestionZones) {
      const circle = L.circle([zone.center.lat, zone.center.lng], {
        radius: zone.radiusM,
        color: '#C4492F',
        weight: 1.5,
        dashArray: '3, 4',
        fillColor: '#C4492F',
        fillOpacity: 0.15,
      });
      circle.bindTooltip(`<b>${zone.label}</b><br/>Congestion factor: ×${zone.factor}`, {
        permanent: true,
        direction: 'center',
        className: 'bg-surface text-clay font-bold text-xs px-2 py-0.5 rounded shadow border border-clay/30',
      });
      circle.addTo(layers);
    }

    // 5. Draw Route Ribbon (Completed trail vs Remaining road ahead)
    if (route && route.geometry && route.geometry.length > 1) {
      // Previous route ghost line if replanned
      if (route.previousGeometry && route.previousGeometry.length > 1) {
        L.polyline(route.previousGeometry, {
          color: '#5F6D64',
          weight: 2.5,
          dashArray: '6, 6',
          opacity: 0.35,
        }).addTo(layers);
      }

      if (completedGeometry && completedGeometry.length > 1) {
        // Subtle muted/completed trail behind the moving vehicle
        L.polyline(completedGeometry, {
          color: '#5F6D64',
          weight: 4,
          dashArray: '4, 4',
          opacity: 0.5,
        }).addTo(layers);
      }

      const forwardGeom =
        remainingGeometry && remainingGeometry.length > 1 ? remainingGeometry : route.geometry;

      // Outer casing (crisp white boundary)
      L.polyline(forwardGeom, {
        color: '#FFFFFF',
        weight: 7,
        opacity: 0.9,
      }).addTo(layers);

      // Route ribbon body (Lagoon color following road network)
      const routePoly = L.polyline(forwardGeom, {
        color: '#0E6A78',
        weight: 4.5,
        opacity: 0.95,
      }).addTo(layers);

      routePoly.bindTooltip(
        `<b>Active Route</b>: ${route.vehicle?.name || 'Municipal Compactor'}<br/>Estimated travel: ${route.totals?.durationMin || 0} min (${route.costSource || 'OSRM'} road geometry)`,
        { sticky: true }
      );

      // Stop transit number badges along the route
      if (route.stops) {
        route.stops.forEach((stop, idx) => {
          const ev = events.find((e) => e.id === stop.eventId);
          if (ev) {
            const isDone = completedStopIds.has(stop.eventId) || stop.state === 'DONE';
            L.marker([ev.location.lat, ev.location.lng], {
              icon: createStopTransitIcon(idx + 1, isDone),
              zIndexOffset: isDone ? 550 : 650,
            }).addTo(layers);
          }
        });
      }
    }

    // 6. Forecast / Historical Layers
    if (forecastMode === 'FORECAST' && forecastCells.length > 0) {
      forecastCells.forEach((cell) => {
        const ring = L.circle([cell.center.lat, cell.center.lng], {
          radius: 280,
          color: '#6B4F8F',
          weight: 2,
          dashArray: '4, 4',
          fillColor: '#6B4F8F',
          fillOpacity: 0.12,
          className: 'forecast-breathe',
        });
        ring.bindTooltip(`<b>Predicted Hotspot</b><br/>≈ ${cell.expected} incidents expected`, {
          permanent: true,
          direction: 'top',
          className:
            'text-xs bg-surface text-plum font-semibold px-2 py-1 rounded shadow border border-plum/30',
        });
        ring.addTo(layers);
      });
    } else if (forecastMode === 'NOW' && historyCells.length > 0) {
      historyCells.forEach((cell) => {
        const radius = Math.min(450, 150 + cell.count * 60);
        L.circle([cell.center.lat, cell.center.lng], {
          radius,
          color: cell.count >= 4 ? '#C48A12' : '#2E6B4E',
          weight: 0,
          fillColor: cell.count >= 4 ? '#C48A12' : '#2E6B4E',
          fillOpacity: Math.min(0.35, 0.1 + cell.count * 0.05),
        }).addTo(layers);
      });
    }

    // 7. Draw Waste Event Markers
    const markerOpacity = forecastMode === 'FORECAST' ? 0.35 : 1.0;

    events.forEach((ev) => {
      let stopSeq: number | undefined;
      if (route?.stops) {
        const found = route.stops.find((s) => s.eventId === ev.id);
        if (found) stopSeq = found.seq;
      }

      const marker = L.marker([ev.location.lat, ev.location.lng], {
        icon: createWasteMarker(
          ev.category,
          ev.status,
          ev.priority?.tier || 'Low',
          ev.code,
          stopSeq
        ),
        opacity: markerOpacity,
        zIndexOffset:
          selectedEventId === ev.id
            ? 900
            : ev.priority?.tier === 'Critical'
            ? 700
            : ev.priority?.tier === 'High'
            ? 600
            : 300,
      });

      marker.on('click', () => {
        if (onSelectEvent) onSelectEvent(ev.id);
      });

      marker.addTo(layers);
    });
  }, [
    events,
    depot,
    selectedEventId,
    blocks,
    selectedBlockId,
    route,
    completedGeometry,
    remainingGeometry,
    completedStopIds,
    congestionZones,
    forecastMode,
    forecastCells,
    historyCells,
  ]);

  // Update dynamic truck position on dedicated lightweight layer without rebuilding the entire map
  useEffect(() => {
    const truckLayer = truckLayerRef.current;
    if (!truckLayer) return;

    truckLayer.clearLayers();

    if (route && (truckPosition || (route.geometry && route.geometry.length > 0))) {
      const pos = truckPosition || route.geometry[0];
      if (pos) {
        const truckMarker = L.marker(pos, {
          icon: createGarbageTruckMarker(
            truckHeading,
            route.vehicle?.name || 'MH-02-PILOT-01',
            isTruckMoving
          ),
          zIndexOffset: 1200,
        });

        truckMarker.bindPopup(
          `<div class="p-2 font-sans text-xs">
            <div class="flex items-center gap-1.5 font-bold text-ink">
              <span>🚚</span>
              <span>${route.vehicle?.name || 'Municipal Compactor'}</span>
            </div>
            <div class="text-[11px] text-ink-3 mt-1">
              Status: <b>${isTruckMoving ? 'In Transit Along Road' : 'Stationary / Loading'}</b>
            </div>
            <div class="text-[10px] text-ink-2 mt-0.5 font-mono">
              GPS Heading: ${Math.round(truckHeading)}°
            </div>
          </div>`
        );

        truckMarker.on('click', () => {
          if (onSelectTruck) onSelectTruck();
        });

        truckMarker.addTo(truckLayer);
      }
    }
  }, [route, truckPosition, truckHeading, isTruckMoving]);

  // Pan to selected event if changed
  useEffect(() => {
    if (!selectedEventId || !mapInstanceRef.current) return;
    const ev = events.find((e) => e.id === selectedEventId);
    if (ev) {
      mapInstanceRef.current.panTo([ev.location.lat, ev.location.lng], {
        animate: true,
        duration: 0.5,
      });
    }
  }, [selectedEventId, events]);

  // Handle programmatic focus locations (e.g. from notification click or cluster jump)
  useEffect(() => {
    if (!focusLocation || !mapInstanceRef.current) return;
    const targetZoom = focusLocation.zoom || 14;
    mapInstanceRef.current.flyTo([focusLocation.lat, focusLocation.lng], targetZoom, {
      duration: 1.2,
      easeLinearity: 0.25,
    });
  }, [focusLocation]);

  return <div ref={mapContainerRef} style={{ width: '100%', height }} className="relative z-0" />;
};
