import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GeoLocation } from '../types/api';

export function LocationPicker({
  value,
  onChange,
  bbox,
}: {
  value: GeoLocation | null;
  onChange: (v: GeoLocation) => void;
  bbox?: number[];
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const change = useRef(onChange);
  change.current = onChange;
  useEffect(() => {
    if (!el.current) return;
    const instance = L.map(el.current).setView([19.12, 72.88], 11);
    L.tileLayer(
      import.meta.env.VITE_TILE_URL ||
        'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      {
        attribution:
          import.meta.env.VITE_TILE_ATTRIBUTION || '© OpenStreetMap contributors © CARTO',
        maxZoom: 19,
      },
    ).addTo(instance);
    instance.on('click', (e: L.LeafletMouseEvent) =>
      change.current({ lat: e.latlng.lat, lng: e.latlng.lng }),
    );
    map.current = instance;
    return () => {
      instance.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);
  useEffect(() => {
    if (!map.current || !bbox) return;
    const area = L.rectangle(
      [
        [bbox[1], bbox[0]],
        [bbox[3], bbox[2]],
      ],
      { color: '#2E6B4E', weight: 1, fillOpacity: 0.02 },
    ).addTo(map.current);
    return () => {
      area.remove();
    };
  }, [bbox]);
  useEffect(() => {
    if (!map.current || !value) return;
    if (!marker.current) {
      marker.current = L.marker([value.lat, value.lng], {
        draggable: true,
        icon: L.divIcon({
          html: '<div style="background:#2E6B4E;border:3px solid white;border-radius:50%;width:24px;height:24px;box-shadow:0 2px 8px #0005"></div>',
          className: '',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      }).addTo(map.current);
      marker.current.on('dragend', () => {
        const p = marker.current!.getLatLng();
        change.current({ lat: p.lat, lng: p.lng });
      });
    } else marker.current.setLatLng([value.lat, value.lng]);
    map.current.setView([value.lat, value.lng], Math.max(16, map.current.getZoom()));
  }, [value]);
  return (
    <div
      ref={el}
      className="h-72 rounded-card border border-line relative z-0"
      aria-label="Tap the map to select waste location"
    />
  );
}
