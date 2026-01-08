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
    
    // find column indices
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
    const brightestStars = stars.slice(0, 400);
    console.log(`Using ${brightestStars.length} brightest stars`);
    
    return brightestStars;
  } catch (error) {
    console.error('Error loading star data:', error);
    return [];
  }
}

/**
 * @deprecated This function is no longer used for primary calculations.
 * It combines calculation and coordinate conversion. The new approach separates these concerns.
 * See `astroUtils.ts` and `altAzToCartesian` in `SkyViewer.tsx`.
 */
export function celestialToCartesian(
  ra: number, // Right Ascension in degrees (0-360)
  dec: number, // Declination in degrees (-90 to +90)
): { x: number; y: number; z: number } { return {x:0, y:0, z:0}; }

export function magnitudeToSize(magnitude: number): number {
  // Convert apparent magnitude to point size
  // Brighter stars (lower magnitude) = larger size
  // A non-linear scale that gives more prominence to brighter stars
  const size = Math.pow(2.0, -magnitude / 2.5);
  return Math.max(0.2, Math.min(size * 0.8, 3.0)); // Clamp between 0.2 and 3.0
}
