export const J2000 = 2451545.0;

/**
 * Calculates the Julian Date from a standard JavaScript Date object.
 */
export function getJulianDate(date: Date): number {
  return date.getTime() / 86400000.0 + 2440587.5;
}

/**
 * Calculates Greenwich Mean Sidereal Time (GMST) in degrees.
 */
export function getGreenwichSiderealTime(date: Date): number {
  const jd = getJulianDate(date);
  const d = jd - J2000;
  
  // GMST formula in degrees: 280.46061837 + 360.98564736629 * d
  let gmst = 280.46061837 + 360.98564736629 * d;
  
  // Normalize to 0-360 range
  gmst = gmst % 360;
  if (gmst < 0) gmst += 360;
  
  return gmst;
}

/**
 * Calculates Local Sidereal Time (LST) in degrees based on longitude.
 */
export function getLocalSiderealTime(date: Date, longitude: number): number {
  const gmst = getGreenwichSiderealTime(date);
  let lst = gmst + longitude;
  
  // Normalize to 0-360 range
  lst = lst % 360;
  if (lst < 0) lst += 360;
  
  return lst;
}

/**
 * Calculates Altitude and Azimuth from RA/Dec, location, and time.
 * @param coords Object containing ra and dec in degrees
 * @param location Object containing lat and lon in degrees
 * @param date The date/time for calculation
 */
export function calculateAltAz(
  coords: { ra: number; dec: number },
  location: { lat: number; lon: number },
  date: Date
): { altitude: number; azimuth: number } {
  const { ra, dec } = coords;
  const { lat, lon } = location;

  const lst = getLocalSiderealTime(date, lon);
  let ha = lst - ra; // Hour Angle in degrees
  if (ha < 0) ha += 360;

  const rad = Math.PI / 180;
  const decRad = dec * rad;
  const latRad = lat * rad;
  const haRad = ha * rad;

  const sinAlt = Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
  const altRad = Math.asin(sinAlt);

  const y = -Math.cos(decRad) * Math.sin(haRad);
  const x = Math.cos(latRad) * Math.sin(decRad) - Math.sin(latRad) * Math.cos(decRad) * Math.cos(haRad);

  let azRad = Math.atan2(y, x);
  let azimuth = azRad / rad;
  let altitude = altRad / rad;

  if (azimuth < 0) azimuth += 360;

  return { altitude, azimuth };
}

// Orbital elements for planets (Mean elements J2000)
const planetsData = [
  { name: 'Mercury', a: 0.387098, e: 0.205630, I: 7.00487, L: 252.250845, longPeri: 77.45645, longNode: 48.33167, color: '#A5A5A5', size: 0.38, magnitude: -2.2 },
  { name: 'Venus',   a: 0.723332, e: 0.006773, I: 3.39471, L: 181.97973, longPeri: 131.53298, longNode: 76.68069, color: '#E3BB76', size: 0.95, magnitude: -4.6 },
  { name: 'Earth',   a: 1.000000, e: 0.016708, I: 0.00005, L: 100.46435, longPeri: 102.94719, longNode: 0,        color: '#0000FF', size: 1.00, magnitude: 0 },
  { name: 'Mars',    a: 1.523679, e: 0.093405, I: 1.85061, L: 355.45332, longPeri: 336.04084, longNode: 49.57854, color: '#FF4500', size: 0.53, magnitude: -2.3 },
  { name: 'Jupiter', a: 5.20260,  e: 0.048498, I: 1.303,   L: 34.40438,  longPeri: 14.75385,  longNode: 100.55615, color: '#D9A066', size: 11.2, magnitude: -2.9 },
  { name: 'Saturn',  a: 9.554909, e: 0.055546, I: 2.485,   L: 49.94432,  longPeri: 92.43194,  longNode: 113.71504, color: '#F4D03F', size: 9.45, magnitude: -0.55 },
  { name: 'Uranus',  a: 19.218446, e: 0.047318, I: 0.773,  L: 313.23218, longPeri: 170.96424, longNode: 74.22988, color: '#40E0D0', size: 4.0, magnitude: 5.5 },
  { name: 'Neptune', a: 30.110387, e: 0.008606, I: 1.770,  L: 304.88003, longPeri: 44.97135,  longNode: 131.72169, color: '#4169E1', size: 3.88, magnitude: 7.8 }
];

export function getPlanets(date: Date) {
  const d = getJulianDate(date) - 2451545.0;
  
  const positions: Record<string, {x: number, y: number, z: number}> = {};

  // Calculate heliocentric coordinates
  planetsData.forEach(p => {
    const N = (p.longNode * Math.PI) / 180;
    const i = (p.I * Math.PI) / 180;
    const w = ((p.longPeri - p.longNode) * Math.PI) / 180;
    const a = p.a;
    const e = p.e;
    
    const n = 0.9856076686 / (a * Math.sqrt(a));
    
    let M = (p.L - p.longPeri + n * d) % 360;
    if (M < 0) M += 360;
    const M_rad = (M * Math.PI) / 180;
    
    let E = M_rad;
    for (let k = 0; k < 5; k++) {
      E = M_rad + e * Math.sin(E);
    }
    
    const x_orb = a * (Math.cos(E) - e);
    const y_orb = a * Math.sqrt(1 - e * e) * Math.sin(E);
    
    const x = x_orb * (Math.cos(w) * Math.cos(N) - Math.sin(w) * Math.sin(N) * Math.cos(i)) - 
              y_orb * (Math.sin(w) * Math.cos(N) + Math.cos(w) * Math.sin(N) * Math.cos(i));
    const y = x_orb * (Math.cos(w) * Math.sin(N) + Math.sin(w) * Math.cos(N) * Math.cos(i)) - 
              y_orb * (Math.sin(w) * Math.sin(N) - Math.cos(w) * Math.cos(N) * Math.cos(i));
    const z = x_orb * (Math.sin(w) * Math.sin(i)) + 
              y_orb * (Math.cos(w) * Math.sin(i));
              
    positions[p.name] = { x, y, z };
  });
  
  const earth = positions['Earth'];
  const results = [];
  
  const eps = (23.43928 * Math.PI) / 180;
  
  for (const p of planetsData) {
    if (p.name === 'Earth') continue;
    
    const pos = positions[p.name];
    
    const X = pos.x - earth.x;
    const Y = pos.y - earth.y;
    const Z = pos.z - earth.z;
    
    const Xeq = X;
    const Yeq = Y * Math.cos(eps) - Z * Math.sin(eps);
    const Zeq = Y * Math.sin(eps) + Z * Math.cos(eps);
    
    const dist = Math.sqrt(Xeq*Xeq + Yeq*Yeq + Zeq*Zeq);
    
    let ra = Math.atan2(Yeq, Xeq) * 180 / Math.PI;
    if (ra < 0) ra += 360;
    
    const dec = Math.asin(Zeq / dist) * 180 / Math.PI;
    
    results.push({
      name: p.name,
      ra,
      dec,
      dist,
      color: p.color,
      size: p.size,
      magnitude: p.magnitude
    });
  }
  
  return results;
}