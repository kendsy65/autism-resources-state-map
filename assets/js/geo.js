// ZIP code lookups and distances. ZIP data: data/<STATE>/zips.json, built from GeoNames (CC BY 4.0).
// Each entry: zip -> [place, county, lat, lon]. Pure functions so they can be tested in Node.

export function lookupZip(zip, zipsByState) {
  for (const [state, zips] of Object.entries(zipsByState)) {
    const z = zips?.[zip];
    if (z) return { zip, state, place: z[0], county: z[1], lat: z[2], lon: z[3] };
  }
  return null;
}

// Center of a town: the average of its ZIP codes' points.
export function placeIndex(zips) {
  const acc = {};
  for (const [place, , lat, lon] of Object.values(zips || {})) {
    const a = (acc[place.toLowerCase()] ||= { lat: 0, lon: 0, n: 0 });
    a.lat += lat; a.lon += lon; a.n++;
  }
  const out = {};
  for (const [k, a] of Object.entries(acc)) out[k] = { lat: a.lat / a.n, lon: a.lon / a.n };
  return city => (city ? out[city.toLowerCase()] || null : null);
}

// Straight-line distance in miles.
export function miles(a, b) {
  const R = 3958.8, rad = d => d * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Region = the region of the nearest town listed in planner-parameters.json "regions".
export function nearestRegion(point, regions, coordsOf) {
  let best = null, bestD = Infinity;
  for (const [region, towns] of Object.entries(regions || {})) {
    for (const t of towns) {
      const c = coordsOf(t);
      if (!c) continue;
      const d = miles(point, c);
      if (d < bestD) { bestD = d; best = region; }
    }
  }
  return best;
}
