import { useMemo } from 'react';
import { useSimulationTime } from '../contexts/SimulationTimeContext';
import { getLocalSiderealTime } from './astroUtils';

/**
 * Returns the current rotation of the celestial sphere in degrees.
 * @param longitude Observer's longitude in degrees (East is positive).
 */
export function useSkyRotation(longitude: number) {
  const { simulationTime } = useSimulationTime();

  const rotation = useMemo(() => {
    // Calculate Local Sidereal Time (LST)
    // The sky appears to rotate from East to West.
    // To simulate this, we rotate the celestial sphere by -LST.
    const lst = getLocalSiderealTime(simulationTime, longitude);
    return -lst; 
  }, [simulationTime, longitude]);

  return rotation;
}