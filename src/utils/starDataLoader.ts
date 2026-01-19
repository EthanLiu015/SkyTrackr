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
  if (magnitude >= 5) {
    return 0.05;
  }
  // Stars with magnitude >= 4 (dimmer stars) get the minimum size
  if (magnitude >= 4.0) {
    return 0.1;
  }

  // For brighter stars (magnitude < 4), we scale up gently.
  // We want the difference between magnitude 1 and -4 to be small (not exponential).
  // Formula: MinSize + (Threshold - Magnitude) * ScaleFactor
  // Example: Mag 1 -> ~0.85, Mag -4 -> ~2.1
  return 0.1 + (4.0 - magnitude) * 0.25;
}
