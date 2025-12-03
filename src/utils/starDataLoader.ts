export interface Star {
  HR: number;
  Name: string;
  HD: number;
  RAJ2000: number; // Right Ascension in degrees
  DEJ2000: number; // Declination in degrees
  Vmag: number; // Visual magnitude (brightness)
  display_name: string;
}

export async function loadStarData(): Promise<Star[]> {
  try {
    const response = await fetch('/star_data.csv');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const csv = await response.text();
    const lines = csv.split('\n');
    const headerLine = lines[0];
    const headers = headerLine.split(',').map(h => h.trim());
    
    console.log('CSV Headers:', headers);
    
    // Find column indices
    const hrIndex = headers.indexOf('HR');
    const nameIndex = headers.indexOf('Name');
    const hdIndex = headers.indexOf('HD');
    const raIndex = headers.indexOf('RAJ2000');
    const decIndex = headers.indexOf('DEJ2000');
    const vmIndex = headers.indexOf('Vmag');
    const displayNameIndex = headers.indexOf('display_name');
    
    const stars: Star[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(',').map(v => v.trim());
      
      const hr = parseInt(values[hrIndex] || '0') || 0;
      const hd = parseInt(values[hdIndex] || '0') || 0;
      const ra = parseFloat(values[raIndex] || '0') || 0;
      const dec = parseFloat(values[decIndex] || '0') || 0;
      const vmag = parseFloat(values[vmIndex] || '99') || 99;
      const displayName = values[displayNameIndex] || `HD ${hd}` || `HR ${hr}` || 'Unknown Star';
      
      // Only include valid stars with valid coordinates
      if (ra >= 0 && ra <= 360 && dec >= -90 && dec <= 90 && vmag < 99) {
        const star: Star = {
          HR: hr,
          Name: values[nameIndex]?.trim() || '',
          HD: hd,
          RAJ2000: ra,
          DEJ2000: dec,
          Vmag: vmag,
          display_name: displayName,
        };
        
        stars.push(star);
      }
    }
    
    console.log(`Loaded ${stars.length} stars before filtering`);
    
    // Sort by magnitude (brightness) and take the 100 brightest
    stars.sort((a, b) => a.Vmag - b.Vmag);
    const brightestStars = stars.slice(0, 200);
    console.log(`Using ${brightestStars.length} brightest stars`);
    
    return brightestStars;
  } catch (error) {
    console.error('Error loading star data:', error);
    return [];
  }
}

export function celestialToCartesian(
  ra: number, // Right Ascension in degrees (0-360)
  dec: number, // Declination in degrees (-90 to +90)
  distance: number = 1,
  latitude: number = 0, // Observer latitude in degrees
  longitude: number = 0, // Observer longitude in degrees
  lstHours: number = 0 // Local Sidereal Time in hours
): [number, number, number] {
  // Convert RA from hours to degrees if needed, but it's already in degrees
  const raRad = (ra * Math.PI) / 180;
  const decRad = (dec * Math.PI) / 180;
  const latRad = (latitude * Math.PI) / 180;
  const lonRad = (longitude * Math.PI) / 180;
  
  // Convert LST from hours to degrees, then to radians
  const lstDeg = lstHours * 15; // 15 degrees per hour
  const lstRad = (lstDeg * Math.PI) / 180;

  // Compute Hour Angle (HA = LST - RA), normalized to [-π, π]
  let hourAngle = lstRad - raRad;
  
  // Normalize hour angle to [-π, π]
  while (hourAngle > Math.PI) hourAngle -= 2 * Math.PI;
  while (hourAngle < -Math.PI) hourAngle += 2 * Math.PI;

  // Compute Altitude: sin(Alt) = sin(Dec) sin(lat) + cos(Dec) cos(lat) cos(HA)
  const sinAlt = Math.sin(decRad) * Math.sin(latRad) + 
                 Math.cos(decRad) * Math.cos(latRad) * Math.cos(hourAngle);
  const altitude = Math.asin(sinAlt);
  const cosAlt = Math.cos(altitude);

  // Compute Azimuth: Az = atan2(-cos(Dec) sin(HA) / cos(Alt), (sin(Dec) - sin(Alt) sin(lat)) / (cos(Alt) cos(lat)))
  const numerator = -Math.cos(decRad) * Math.sin(hourAngle) / cosAlt;
  const denominator = (Math.sin(decRad) - sinAlt * Math.sin(latRad)) / (cosAlt * Math.cos(latRad));
  let azimuth = Math.atan2(numerator, denominator);
  
  // Normalize azimuth to [0, 2π]
  if (azimuth < 0) azimuth += 2 * Math.PI;

  // Convert Alt/Az to ENU (East-North-Up) unit vector
  // x = cos(Alt) sin(Az)  (East)
  // y = sin(Alt)          (Up)
  // z = cos(Alt) cos(Az)  (North)
  const sinAz = Math.sin(azimuth);
  const cosAz = Math.cos(azimuth);
  
  const x_enu = cosAlt * sinAz;   // East
  const y_enu = sinAlt;            // Up
  const z_enu = cosAlt * cosAz;    // North

  // Convert ENU to Three.js world coordinates: east→x, up→y, north→−z
  const x = distance * x_enu;      // East
  const y = distance * y_enu;      // Up (Zenith)
  const z = -distance * z_enu;     // Negative North (so North is negative Z in Three.js)

  return [x, y, z];
}

export function magnitudeToSize(magnitude: number): number {
  // Convert apparent magnitude to point size
  // Brighter stars (lower magnitude) = larger size
  // Formula: size = 2^(-magnitude/2.5)
  const size = Math.pow(2, -magnitude / 2.5);
  return Math.max(0.5, Math.min(size * 2, 10)); // Clamp between 0.5 and 10
}
