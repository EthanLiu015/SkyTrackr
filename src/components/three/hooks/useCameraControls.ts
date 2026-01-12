import { useRef, useEffect } from 'react';
import * as THREE from 'three';

interface CameraControl {
  phi: number;
  theta: number;
  isDragging: boolean;
  previousMousePosition: { x: number; y: number };
  fov: number;
}

export function useCameraControls(
  containerRef: React.RefObject<HTMLDivElement | null>,
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>
) {
  const cameraControlRef = useRef<CameraControl>({
    phi: Math.PI / 2,
    theta: 0,
    isDragging: false,
    previousMousePosition: { x: 0, y: 0 },
    fov: 75,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseDown = (event: MouseEvent) => {
      cameraControlRef.current.isDragging = true;
      cameraControlRef.current.previousMousePosition = { x: event.clientX, y: event.clientY };
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!cameraControlRef.current.isDragging) return;

      const deltaX = event.clientX - cameraControlRef.current.previousMousePosition.x;
      const deltaY = event.clientY - cameraControlRef.current.previousMousePosition.y;

      cameraControlRef.current.theta -= deltaX * 0.005;
      cameraControlRef.current.phi -= deltaY * 0.005;

      cameraControlRef.current.phi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraControlRef.current.phi));

      cameraControlRef.current.previousMousePosition = { x: event.clientX, y: event.clientY };
    };

    const handleMouseUp = () => {
      cameraControlRef.current.isDragging = false;
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const zoomSpeed = 2;
      if (event.deltaY < 0) {
        cameraControlRef.current.fov = Math.max(5, cameraControlRef.current.fov - zoomSpeed);
      } else {
        cameraControlRef.current.fov = Math.min(120, cameraControlRef.current.fov + zoomSpeed);
      }
      if (cameraRef.current) {
        cameraRef.current.fov = cameraControlRef.current.fov;
        cameraRef.current.updateProjectionMatrix();
      }
    };

    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('mouseleave', handleMouseUp);
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('mouseleave', handleMouseUp);
      container.removeEventListener('wheel', handleWheel);
    };
  }, [containerRef, cameraRef]);

  return cameraControlRef;
}
