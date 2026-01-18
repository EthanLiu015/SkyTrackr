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
  const ha = lst - ra; // Hour Angle in degrees

  const rad = Math.PI / 180;
  const decRad = dec * rad;
  const latRad = lat * rad;
  const haRad = ha * rad;

  const sinAlt = Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
  const altRad = Math.asin(sinAlt);

  const y = -Math.sin(haRad) * Math.cos(decRad);
  const x = Math.cos(decRad) * Math.sin(latRad) * Math.cos(haRad) - Math.sin(decRad) * Math.cos(latRad);

  let azRad = Math.atan2(y, x);
  let azimuth = azRad / rad;
  let altitude = altRad / rad;

  if (azimuth < 0) azimuth += 360;

  return { altitude, azimuth };
}