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
    // Fetch from the FastAPI backend
    const response = await fetch('http://127.0.0.1:8000/stars');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // API returns full star objects
    const data = await response.json();
    
    // Map API data to the existing Star interface
    const stars: Star[] = data.map((item: any) => ({
      HR: item.HR,
      Name: item.Name,
      HD: item.HD,
      RAJ2000: item.RAJ2000,
      DEJ2000: item.DEJ2000,
      Vmag: item.Vmag,
      display_name: item.display_name || item.Name
    }));
    
    console.log(`Loaded ${stars.length} stars from API`);
    
    // Sort by magnitude (brightness) and take the 600 brightest
    stars.sort((a, b) => a.Vmag - b.Vmag);
    const brightestStars = stars.slice(0, 2000);
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
  const size = Math.pow(7.0, -magnitude / 3.5);
  return Math.max(0.05, Math.min(size * 0.8, 5.0)); // Clamp between 0.05 and 5.0
}
