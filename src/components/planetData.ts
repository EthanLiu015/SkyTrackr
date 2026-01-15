export interface Planet {
  name: string;
  ra: number; // degrees
  dec: number; // degrees
  color: string;
  size: number;
}

export async function fetchPlanets(latitude: number, longitude: number): Promise<Planet[]> {
  try {
    // Using visibleplanets.dev API which is a RESTful API providing planetary coordinates
    const response = await fetch(`https://api.visibleplanets.dev/v3?latitude=${latitude}&longitude=${longitude}&showCoords=true`);
    const data = await response.json();
    
    if (!data.data) return [];

    return data.data.map((p: any) => {
      let color = '#FFFFFF';
      let size = 1.0;
      
      // Assign colors and relative sizes (bigger than stars)
      switch(p.name.toLowerCase()) {
        case 'mercury': color = '#A5A5A5'; size = 0.8; break; // Gray
        case 'venus': color = '#E3BB76'; size = 1.2; break;   // Yellowish-white
        case 'mars': color = '#DD4C22'; size = 0.9; break;    // Red
        case 'jupiter': color = '#D8CA9D'; size = 2.0; break; // Orange/Striped
        case 'saturn': color = '#C5AB6E'; size = 1.8; break;  // Gold
        case 'uranus': color = '#93B8BE'; size = 1.0; break;  // Light Blue
        case 'neptune': return null; // Exclude Neptune as requested
        default: return null;
      }

      return {
        name: p.name,
        ra: p.rightAscension.hours * 15, // Convert hours to degrees for calculation
        dec: p.declination.degrees,
        color,
        size
      };
    }).filter((p: any) => p !== null);
  } catch (error) {
    console.error("Failed to fetch planets", error);
    return [];
  }
}