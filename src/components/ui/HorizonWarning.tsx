import React from 'react';

interface HorizonWarningProps {
  message: string | null;
}

export const HorizonWarning: React.FC<HorizonWarningProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-yellow-600 bg-opacity-90 text-white px-6 py-3 rounded-lg border border-yellow-400 shadow-lg z-50">
      <p className="text-base font-semibold">{message}</p>
    </div>
  );
};
