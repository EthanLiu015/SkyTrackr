import { SkyViewer, type SkyViewerHandles } from './SkyViewer';
import { forwardRef, useImperativeHandle, useRef } from 'react';

export interface SkyDisplayHandles {
  searchForStar: (starName: string) => void;
}

export const SkyDisplay = forwardRef<SkyDisplayHandles, { onStarDataLoaded: (starNames: string[]) => void }>(({ onStarDataLoaded }, ref) => {
  const skyViewerRef = useRef<SkyViewerHandles>(null);

  useImperativeHandle(ref, () => ({
    searchForStar: (starName: string) => skyViewerRef.current?.searchForStar(starName),
  }));

  return <SkyViewer ref={skyViewerRef} onStarDataLoaded={onStarDataLoaded} />;
});
