import { ENV } from '../../config/env.js';

export async function fetchOsrmTable(points) {
  // points is array of {lat, lng}
  // OSRM expects coordinates in lng,lat format joined by semicolons
  const coordString = points.map((p) => `${p.lng},${p.lat}`).join(';');
  const url = `${ENV.OSRM_BASE_URL}/table/v1/driving/${coordString}?annotations=duration,distance`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ENV.OSRM_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`OSRM table returned ${res.status}`);
    }

    const data = await res.json();
    if (data.code !== 'Ok' || !data.durations || !data.distances) {
      throw new Error(`OSRM table error code: ${data.code}`);
    }

    return {
      durations: data.durations, // in seconds
      distances: data.distances, // in meters
      costSource: 'OSRM',
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

export async function fetchOsrmRoute(orderedPoints) {
  const coordString = orderedPoints.map((p) => `${p.lng},${p.lat}`).join(';');
  const url = `${ENV.OSRM_BASE_URL}/route/v1/driving/${coordString}?overview=full&geometries=geojson`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ENV.OSRM_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`OSRM route returned ${res.status}`);
    }

    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.[0]?.geometry?.coordinates) {
      throw new Error(`OSRM route error code: ${data.code}`);
    }

    // Convert GeoJSON [lng, lat] coordinates to Leaflet [lat, lng] format
    const coordinates = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    return {
      geometry: coordinates,
      legs: data.routes[0].legs || [],
      costSource: 'OSRM',
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}
