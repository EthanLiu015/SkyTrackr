import React from 'react';
import type { Star } from '../../utils/starDataLoader';

interface StarAltAz {
  altitude: number;
  azimuth: number;
}

interface StarInfoBoxProps {
  star: Star | null;
  altAz: StarAltAz | null;
}

export const StarInfoBox: React.FC<StarInfoBoxProps> = ({ star, altAz }) => {
  if (!star) return null;

  return (
    <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 text-white p-3 rounded border border-blue-500">
      <p className="text-lg font-semibold">{star.display_name}</p>
      <p className="text-sm text-gray-300">Magnitude: {star.Vmag.toFixed(2)}</p>
      <p className="text-sm text-gray-300">RA: {star.RAJ2000.toFixed(2)}°</p>
      <p className="text-sm text-gray-300">Dec: {star.DEJ2000.toFixed(2)}°</p>
      {altAz && (
        <>
          <p className="text-sm text-gray-300">Alt: {altAz.altitude.toFixed(2)}°</p>
          <p className="text-sm text-gray-300">Az: {altAz.azimuth.toFixed(2)}°</p>
        </>
      )}
    </div>
  );
};
