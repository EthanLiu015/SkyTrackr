/**
 * Computes the Altitude and Azimuth of a celestial object.
 * Follows the precise formulas requested for high accuracy.
 */
export function calculateAltAz(
  { ra, dec }: { ra: number; dec: number }, // RA in degrees, Dec in degrees
  { lat, lon }: { lat: number; lon: number }, // Latitude and Longitude in degrees
  date: Date
): { altitude: number; azimuth: number; lst: number } {
  // 1. Convert RA and Dec
  // The provided RA is already in degrees, so we convert to radians directly.
  const raRad = (ra * Math.PI) / 180;
  const decRad = (dec * Math.PI) / 180;

  // 2. Compute Julian Date (JD)
  const unixMilliseconds = date.getTime();
  const jd = unixMilliseconds / 86400000 + 2440587.5;

  // 3. Compute GMST (Greenwich Mean Sidereal Time) in degrees
  const T = (jd - 2451545.0) / 36525.0;
  let gmst =
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    0.000387933 * T * T -
    (T * T * T) / 38710000;

  gmst = gmst % 360;
  if (gmst < 0) {
    gmst += 360;
  }

  // 4. Compute Local Sidereal Time (LST) in degrees
  let lst = gmst + lon;
  lst = lst % 360;
  if (lst < 0) {
    lst += 360;
  }

  // 5. Convert LST to radians and compute the Hour Angle (HA) in radians
  const lstRad = (lst * Math.PI) / 180;
  let hourAngle = lstRad - raRad;

  // Normalize HA to [-π, +π]
  while (hourAngle > Math.PI) hourAngle -= 2 * Math.PI;
  while (hourAngle < -Math.PI) hourAngle += 2 * Math.PI;

  // 6. Convert latitude to radians
  const latRad = (lat * Math.PI) / 180;

  // 7. Compute Altitude
  const sinAlt =
    Math.sin(decRad) * Math.sin(latRad) +
    Math.cos(decRad) * Math.cos(latRad) * Math.cos(hourAngle);
  const altitude = Math.asin(sinAlt);

  // 8. Compute Azimuth
  const cosAlt = Math.cos(altitude);
  const sinAz = -Math.cos(decRad) * Math.sin(hourAngle) / cosAlt;
  const cosAz =
    (Math.sin(decRad) - sinAlt * Math.sin(latRad)) /
    (cosAlt * Math.cos(latRad));
  let azimuth = Math.atan2(sinAz, cosAz);

  // Normalize Az to [0, 2π)
  if (azimuth < 0) {
    azimuth += 2 * Math.PI;
  }

  // 9. Return Alt and Az in degrees
  return {
    altitude: altitude * (180 / Math.PI),
    azimuth: azimuth * (180 / Math.PI),
    lst: lst / 15, // Return LST in hours for other uses
  };
}