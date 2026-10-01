import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Navigation, MapPin, AlertCircle, CheckCircle, RefreshCw, Compass } from 'lucide-react';
import { api } from '../../lib/api.ts';
import 'leaflet/dist/leaflet.css';

interface CitizenLocationPickerProps {
  location: { lat: number; lng: number } | null;
  locationAccuracyM?: number;
  locationSource: 'GPS' | 'MAP_PIN' | null;
  onLocationChange: (loc: { lat: number; lng: number }, source: 'GPS' | 'MAP_PIN', accuracyM?: number) => void;
  onAddressResolved?: (address: string) => void;
  serviceAreaBbox?: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
}

// Bounding box covering Greater Mumbai: [minLng, minLat, maxLng, maxLat]
const DEFAULT_BBOX: [number, number, number, number] = [72.75, 18.85, 73.05, 19.35];

function isInsideBbox(lat: number, lng: number, bbox: [number, number, number, number]): boolean {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
}

export const CitizenLocationPicker: React.FC<CitizenLocationPickerProps> = ({
  location,
  locationAccuracyM,
  locationSource,
  onLocationChange,
  onAddressResolved,
  serviceAreaBbox = DEFAULT_BBOX,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);

  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);

  // Reference center of Greater Mumbai
  const defaultCenter: [number, number] = [19.0760, 72.8777];

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialCenter = location ? [location.lat, location.lng] : defaultCenter;
    const initialZoom = location ? 15 : 11;
    const map = L.map(mapContainerRef.current, {
      center: initialCenter as [number, number],
      zoom: initialZoom,
      zoomControl: true,
      touchZoom: true,
      scrollWheelZoom: true,
    });

    // Use OpenStreetMap tile layer directly
    const tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    const attribution = '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors';

    L.tileLayer(tileUrl, { attribution, maxZoom: 19 }).addTo(map);

    // Draw municipal service boundary polygon
    const [minLng, minLat, maxLng, maxLat] = serviceAreaBbox;
    const bboxPolygon: [number, number][] = [
      [minLat, minLng],
      [maxLat, minLng],
      [maxLat, maxLng],
      [minLat, maxLng],
    ];

    L.polygon(bboxPolygon, {
      color: '#2E6B4E',
      weight: 2,
      dashArray: '5, 5',
      fillColor: '#2E6B4E',
      fillOpacity: 0.04,
    })
      .bindTooltip('Greater Mumbai Municipal Service Boundary', {
        permanent: false,
        direction: 'center',
      })
      .addTo(map);

    // Handle map click to place/drag pin
    map.on('click', (e: L.LeafletMouseEvent) => {
      const lat = Math.round(e.latlng.lat * 100000) / 100000;
      const lng = Math.round(e.latlng.lng * 100000) / 100000;
      onLocationChange({ lat, lng }, 'MAP_PIN', undefined);
    });

    mapInstanceRef.current = map;
    (mapContainerRef.current as any)._leaflet_map = map;

    // Invalidate size to guarantee tile rendering on mount
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Reverse geocoding on location change
  useEffect(() => {
    if (!location) {
      setResolvedAddress(null);
      return;
    }

    let isMounted = true;
    async function reverseGeocode() {
      setGeocoding(true);
      try {
        const res = await api.get<{ ok: boolean; address: string }>(
          `/geocode/reverse?lat=${location!.lat}&lng=${location!.lng}`
        );
        if (isMounted) {
          if (res.ok && res.address) {
            setResolvedAddress(res.address);
            if (onAddressResolved) {
              onAddressResolved(res.address);
            }
          } else {
            setResolvedAddress(null);
          }
        }
      } catch (err) {
        if (isMounted) {
          setResolvedAddress(null);
        }
      } finally {
        if (isMounted) setGeocoding(false);
      }
    }

    reverseGeocode();

    return () => {
      isMounted = false;
    };
  }, [location?.lat, location?.lng]);

  // Sync marker and accuracy circle on location changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!location) {
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      if (accuracyCircleRef.current) {
        map.removeLayer(accuracyCircleRef.current);
        accuracyCircleRef.current = null;
      }
      return;
    }

    const customPinIcon = L.divIcon({
      className: 'custom-map-pin',
      html: `
        <div style="
          width: 34px;
          height: 34px;
          background: #C4492F;
          border: 2.5px solid #FFFFFF;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 4px 10px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: grab;
        ">
          <div style="
            width: 10px;
            height: 10px;
            background: #FFFFFF;
            border-radius: 50%;
          "></div>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
    });

    if (markerRef.current) {
      markerRef.current.setLatLng([location.lat, location.lng]);
    } else {
      const marker = L.marker([location.lat, location.lng], {
        icon: customPinIcon,
        draggable: true,
      }).addTo(map);

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        const lat = Math.round(pos.lat * 100000) / 100000;
        const lng = Math.round(pos.lng * 100000) / 100000;
        onLocationChange({ lat, lng }, 'MAP_PIN', undefined);
      });

      markerRef.current = marker;
    }

    // Accuracy circle for GPS
    if (locationSource === 'GPS' && locationAccuracyM) {
      if (accuracyCircleRef.current) {
        accuracyCircleRef.current.setLatLng([location.lat, location.lng]);
        accuracyCircleRef.current.setRadius(locationAccuracyM);
      } else {
        accuracyCircleRef.current = L.circle([location.lat, location.lng], {
          radius: locationAccuracyM,
          color: '#0E6A78',
          weight: 1.5,
          fillColor: '#0E6A78',
          fillOpacity: 0.12,
        }).addTo(map);
      }
    } else if (accuracyCircleRef.current) {
      map.removeLayer(accuracyCircleRef.current);
      accuracyCircleRef.current = null;
    }
  }, [location, locationSource, locationAccuracyM]);

  // Real GPS positioning with permissions handling
  const handleAcquireGPS = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        const lat = Math.round(pos.coords.latitude * 100000) / 100000;
        const lng = Math.round(pos.coords.longitude * 100000) / 100000;
        const acc = Math.round(pos.coords.accuracy);

        onLocationChange({ lat, lng }, 'GPS', acc);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([lat, lng], 16, { animate: true, duration: 1 });
        }
      },
      (err) => {
        setGpsLoading(false);
        let msg = 'Could not acquire GPS position.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'GPS permission denied. Please tap directly on the street map to place your pin.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'GPS signal unavailable. Please position the pin on the street map.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'GPS request timed out. Please tap on the map to set your location.';
        }
        setGpsError(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  const isInside = location ? isInsideBbox(location.lat, location.lng, serviceAreaBbox) : false;

  return (
    <div className="space-y-3">
      {/* Map Action Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-ink-2 flex items-center gap-1.5 font-medium">
          <MapPin className="w-4 h-4 text-clay shrink-0" />
          <span>Tap street to place pin, or drag to adjust</span>
        </div>
        <button
          type="button"
          disabled={gpsLoading}
          onClick={handleAcquireGPS}
          className="px-3 py-1.5 bg-surface hover:bg-surface-2 border border-line rounded-card text-xs font-semibold text-ink flex items-center gap-1.5 shadow-sm transition active:scale-98"
        >
          <Navigation className={`w-3.5 h-3.5 text-moss ${gpsLoading ? 'animate-spin' : ''}`} />
          <span>{gpsLoading ? 'Acquiring GPS...' : 'Use My GPS'}</span>
        </button>
      </div>

      {gpsError && (
        <div className="p-2.5 bg-ochre-100/70 border border-ochre/40 rounded-card text-xs text-ochre flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{gpsError}</span>
        </div>
      )}

      {/* Leaflet Map Canvas */}
      <div className="relative rounded-card overflow-hidden border border-line h-64 sm:h-72 w-full shadow-inner bg-surface-2">
        <div ref={mapContainerRef} className="w-full h-full relative z-0" />
      </div>

      {/* Live Geocoded Address & Pilot Area Status */}
      {location ? (
        <div className="space-y-2">
          <div
            className={`p-3 rounded-card border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
              isInside
                ? 'bg-moss-100/40 border-moss/40 text-moss-800'
                : 'bg-clay-100/50 border-clay/40 text-clay'
            }`}
          >
            <div className="flex items-start gap-2">
              {isInside ? (
                <CheckCircle className="w-4 h-4 text-moss shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-clay shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-semibold text-ink flex items-center gap-1.5">
                  <span>{resolvedAddress || 'Resolving address...'}</span>
                  {geocoding && <RefreshCw className="w-3 h-3 text-ink-3 animate-spin" />}
                </div>
                <div className="text-[11px] text-ink-3 font-mono mt-0.5">
                  {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                  {locationAccuracyM ? ` (GPS accuracy ±${locationAccuracyM}m)` : ' (Pin dropped on street)'}
                </div>
              </div>
            </div>

            <span
              className={`self-start sm:self-center font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-pill ${
                isInside ? 'bg-moss text-surface' : 'bg-clay text-surface'
              }`}
            >
              {isInside ? 'Inside Mumbai Service Area' : 'Outside Mumbai Area'}
            </span>
          </div>

          {!isInside && (
            <p className="text-[11px] text-clay font-medium px-1">
              Warning: This pin is outside the Greater Mumbai municipal service boundary. You must place the pin within Mumbai to submit.
            </p>
          )}
        </div>
      ) : (
        <div className="p-3 bg-surface-2 rounded-card border border-dashed border-line text-xs text-ink-3 text-center flex items-center justify-center gap-2">
          <Compass className="w-4 h-4 text-ink-3" />
          <span>No location selected. Tap <b>Use My GPS</b> or click anywhere inside the dashed green box on the map.</span>
        </div>
      )}
    </div>
  );
};
