import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { WasteEventSummary, RouteData, CongestionZone, ForecastCell } from '../types/api.ts';
import { createWasteMarker, createDepotMarker, createStopTransitIcon } from './markerUtils.ts';
import '../styles/map.css';

interface CityMapProps {
  events?: WasteEventSummary[];
  depot?: { name: string; lat: number; lng: number };
  selectedEventId?: string | null;
  onSelectEvent?: (eventId: string) => void;
  route?: RouteData | null;
  congestionZones?: CongestionZone[];
  onMapClick?: (lat: number, lng: number) => void;
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
  depot,
  selectedEventId,
  onSelectEvent,
  route,
  congestionZones = [],
  onMapClick,
  forecastMode,
  forecastCells = [],
  historyCells = [],
  height = '100%',
  interactive = true,
  center = [19.2071, 72.876],
  zoom = 14,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

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

    const tileUrl =
      import.meta.env.VITE_TILE_URL ||
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
    const attribution =
      import.meta.env.VITE_TILE_ATTRIBUTION || '© OpenStreetMap contributors © CARTO';

    L.tileLayer(tileUrl, {
      attribution,
      maxZoom: 19,
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    layerGroupRef.current = layerGroup;

    if (onMapClick) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update layers whenever data changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layers = layerGroupRef.current;
    if (!map || !layers) return;

    layers.clearLayers();

    // 2. Draw Depot
    if (depot) {
      const depotMarker = L.marker([depot.lat, depot.lng], {
        icon: createDepotMarker(depot.name),
        zIndexOffset: 1000,
      });
      const label = document.createElement('span');label.textContent = depot.name;depotMarker.bindPopup(label);
      depotMarker.addTo(layers);
    }

    // 3. Draw Congestion Zones
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

    // 4. Draw Route Ribbon (casing, body, previous plan ghost if replanned)
    if (route && route.geometry && route.geometry.length > 1) {
      // Previous route ghost line if present
      if (route.previousGeometry && route.previousGeometry.length > 1) {
        L.polyline(route.previousGeometry, {
          color: '#5F6D64',
          weight: 3,
          dashArray: '6, 6',
          opacity: 0.4,
        }).addTo(layers);
      }

      // Outer casing (surface color)
      L.polyline(route.geometry, {
        color: '#FFFFFF',
        weight: 8,
        opacity: 0.9,
      }).addTo(layers);

      // Route ribbon body (Lagoon color)
      L.polyline(route.geometry, {
        color: '#0E6A78',
        weight: 5,
        opacity: 0.95,
      }).addTo(layers);

      // Stop transit number badges along the route
      if (route.stops) {
        route.stops.forEach((stop, idx) => {
          const ev = events.find((e) => e.id === stop.eventId);
          if (ev) {
            L.marker([ev.location.lat, ev.location.lng], {
              icon: createStopTransitIcon(idx + 1),
              zIndexOffset: 600,
            }).addTo(layers);
          }
        });
      }
    }

    // 5. Forecast / Hotspot Layers
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
          className: 'text-xs bg-surface text-plum font-semibold px-2 py-1 rounded shadow border border-plum/30',
        });
        ring.addTo(layers);
      });
    } else if (forecastMode === 'NOW' && historyCells.length > 0) {
      // Historical heat zone circles
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

    // 6. Draw Waste Event Markers (with opacity dampening in Forecast mode)
    const markerOpacity = forecastMode === 'FORECAST' ? 0.35 : 1.0;

    events.forEach((ev) => {
      // Determine stop sequence if in active route
      let stopSeq: number | undefined;
      if (route?.stops) {
        const found = route.stops.find((s) => s.eventId === ev.id);
        if (found) stopSeq = found.seq;
      }

      const marker = L.marker([ev.location.lat, ev.location.lng], {
        icon: createWasteMarker(ev.category, ev.status, ev.priority?.tier || 'Low', ev.code, stopSeq),
        opacity: markerOpacity,
        zIndexOffset: selectedEventId === ev.id ? 800 : ev.priority?.tier === 'Critical' ? 500 : 100,
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
    route,
    congestionZones,
    forecastMode,
    forecastCells,
    historyCells,
  ]);

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

  return <div ref={mapContainerRef} style={{ width: '100%', height }} className="relative z-0" />;
};
