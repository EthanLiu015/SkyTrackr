import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import * as THREE from 'three';
import { loadStarData, type Star } from '../utils/starDataLoader';
import { getUserLocation, type UserLocation } from '../utils/geolocation';
import { calculateAltAz } from '../utils/astroUtils';
import { StarInfoBox } from './ui/StarInfoBox';
import { HorizonWarning } from './ui/HorizonWarning';
import { createSkySphere, createGround, createDirectionalMarkers } from './three/SceneSetup';
import { createStarField } from './three/StarrySky';
import { useCameraControls } from './three/hooks/useCameraControls';

export interface SkyViewerHandles {
  searchForStar: (starName: string) => void;
}

interface SkyViewerProps {
  searchedStarName?: string | null;
  onStarDataLoaded?: (starNames: string[]) => void;
}

interface StarAltAz {
  altitude: number;
  azimuth: number;
}

/**
 * Main SkyViewer component that renders the 3D sky scene.
 * Handles star visualization, camera controls, and user interaction.
 */
export const SkyViewer = forwardRef<SkyViewerHandles, SkyViewerProps>(function SkyViewerComponent({ searchedStarName, onStarDataLoaded }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const starsRef = useRef<Map<number, Star>>(new Map());
  const starsByNameRef = useRef<Map<string, Star>>(new Map());
  const starAltAzRef = useRef<Map<number, StarAltAz>>(new Map());
  const starMeshRef = useRef<THREE.Points | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const [hoveredStar, setHoveredStar] = useState<Star | null>(null);
  const [hoveredStarAltAz, setHoveredStarAltAz] = useState<StarAltAz | null>(null);
  const [belowHorizonWarning, setBelowHorizonWarning] = useState<string | null>(null);
  const [observer, setObserver] = useState({
    latitude: 0,
    longitude: 0,
  });

  const cameraControlRef = useCameraControls(containerRef, cameraRef);

  /**
   * Moves the camera to look at a specific star.
   * Checks if the star is below the horizon and sets a warning if so.
   */
  const navigateToStar = useCallback((star: Star) => {
    if (!cameraRef.current) return;
    const altAz = calculateAltAz(
      { ra: star.RAJ2000, dec: star.DEJ2000 },
      { lat: observer.latitude, lon: observer.longitude },
      new Date()
    );

    if (altAz.altitude <= 0) {
      setBelowHorizonWarning(`${star.display_name} is below the horizon right now.`);
      setTimeout(() => setBelowHorizonWarning(null), 5000);
      return;
    }
    
    setBelowHorizonWarning(null);
    
    const altRad = (altAz.altitude * Math.PI) / 180;
    const azRad = (altAz.azimuth * Math.PI) / 180;

    cameraControlRef.current.phi = Math.PI / 2 - altRad;
    cameraControlRef.current.theta = azRad;
    
    cameraControlRef.current.fov = 30;
    cameraRef.current.fov = 30;
    cameraRef.current.updateProjectionMatrix();
    
    console.log(`Navigating to ${star.display_name}`);
  }, [cameraControlRef, observer]);

  useImperativeHandle(ref, () => ({
    /**
     * Exposed method to search for a star by name and navigate to it.
     */
    searchForStar: (starName: string) => {
      const star = starsByNameRef.current.get(starName.toLowerCase());
      if (star) {
        navigateToStar(star);
      }
    }
  }), [navigateToStar]);

  useEffect(() => {
    /**
     * Initializes the THREE.js scene, camera, renderer, and objects.
     * Loads star data and sets up event listeners.
     */
    const initScene = async () => {
      if (!containerRef.current) return;

      try {
        const location: UserLocation = await getUserLocation();
        const stars = await loadStarData();
        onStarDataLoaded?.(stars.map(star => star.display_name));
        
        if (stars.length === 0) {
          console.error('No stars loaded!');
          return;
        }

        const scene = new THREE.Scene();
        sceneRef.current = scene;

        const skySphere = createSkySphere();
        scene.add(skySphere);

        const hemisphereLight = new THREE.HemisphereLight(0x404060, 0x104010, 1.0);
        scene.add(hemisphereLight);

        const ground = createGround();
        scene.add(ground);

        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 10000);
        camera.position.set(0, 1.6, 0);
        cameraRef.current = camera;

        const directionalMarkers = createDirectionalMarkers(camera);
        scene.add(directionalMarkers);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        const now = new Date();
        const latitude = location.latitude || 0;
        const longitude = location.longitude || 0;
        const observerCoords = { lat: latitude, lon: longitude };

        setObserver({ latitude, longitude });

        stars.forEach((star) => {
          starsByNameRef.current.set(star.display_name.toLowerCase(), star);
        });

        const { starMesh, starGlowMesh } = createStarField(stars, observerCoords, now, starsRef, starAltAzRef);
        
        let baseStarSize = 0.15;
        if (starMesh.material instanceof THREE.PointsMaterial) {
          baseStarSize = starMesh.material.size;
        } else if (starMesh.material instanceof THREE.ShaderMaterial && starMesh.material.uniforms.size) {
          baseStarSize = starMesh.material.uniforms.size.value;
        }

        let baseGlowSize = 0.3;
        if (starGlowMesh instanceof THREE.Points) {
          if (starGlowMesh.material instanceof THREE.PointsMaterial) {
            baseGlowSize = starGlowMesh.material.size;
          } else if (starGlowMesh.material instanceof THREE.ShaderMaterial && starGlowMesh.material.uniforms.size) {
            baseGlowSize = starGlowMesh.material.uniforms.size.value;
          }
        }

        scene.add(starGlowMesh);
        scene.add(starMesh);
        starMeshRef.current = starMesh;

        /**
         * Handles window resize events to update camera aspect ratio and renderer size.
         */
        const handleResize = () => {
          const newWidth = containerRef.current?.clientWidth || width;
          const newHeight = containerRef.current?.clientHeight || height;
          camera.aspect = newWidth / newHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(newWidth, newHeight);
        };

        window.addEventListener('resize', handleResize);

        /**
         * Handles mouse move events for raycasting (hovering over stars).
         */
        const handleMouseMove = (event: MouseEvent) => {
          if (!containerRef.current) return;

          const rect = containerRef.current.getBoundingClientRect();
          mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

          if (starMeshRef.current && cameraRef.current) {
            raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
            const intersects = raycasterRef.current.intersectObject(starMeshRef.current);

            if (intersects.length > 0) {
              const pointIndex = intersects[0].index;
              if (pointIndex !== null && pointIndex !== undefined && starsRef.current.has(pointIndex)) {
                const star = starsRef.current.get(pointIndex);
                const altAz = starAltAzRef.current.get(pointIndex);
                setHoveredStar(star || null);
                setHoveredStarAltAz(altAz || null);
              }
            } else {
              setHoveredStar(null);
              setHoveredStarAltAz(null);
            }
          }
        };

        containerRef.current.addEventListener('mousemove', handleMouseMove);

        /**
         * Animation loop for rendering the scene.
         */
        const animate = () => {
          requestAnimationFrame(animate);

          const phi = cameraControlRef.current.phi;
          const theta = cameraControlRef.current.theta;

          const lookAtPoint = new THREE.Vector3(
            100 * Math.sin(phi) * Math.sin(theta),
            100 * Math.cos(phi),
            -100 * Math.sin(phi) * Math.cos(theta)
          );

          if (cameraRef.current) {
            cameraRef.current.position.set(0, 1.6, 0);
            cameraRef.current.lookAt(lookAtPoint.add(cameraRef.current.position));

            if (typeof cameraControlRef.current.fov === 'number' && Math.abs(cameraRef.current.fov - cameraControlRef.current.fov) > 0.01) {
              cameraRef.current.fov = cameraControlRef.current.fov;
              cameraRef.current.updateProjectionMatrix();
            }

            const initialFov = 75;
            const scale = initialFov / cameraRef.current.fov;

            if (starMesh.material instanceof THREE.PointsMaterial) {
              starMesh.material.size = baseStarSize * scale;
            } else if (starMesh.material instanceof THREE.ShaderMaterial && starMesh.material.uniforms.size) {
              starMesh.material.uniforms.size.value = baseStarSize * scale;
            }
            if (starGlowMesh instanceof THREE.Points) {
              if (starGlowMesh.material instanceof THREE.PointsMaterial) {
                starGlowMesh.material.size = baseGlowSize * scale;
              } else if (starGlowMesh.material instanceof THREE.ShaderMaterial && starGlowMesh.material.uniforms.size) {
                starGlowMesh.material.uniforms.size.value = baseGlowSize * scale;
              }
            }
          }

          renderer.render(scene, cameraRef.current!);
        };

        animate();

        return () => {
          window.removeEventListener('resize', handleResize);
          containerRef.current?.removeEventListener('mousemove', handleMouseMove);
          renderer.dispose();
          skySphere.geometry.dispose();
          (skySphere.material as THREE.Material).dispose();
          ground.geometry.dispose();
          (ground.material as THREE.Material).dispose();
          starMesh.geometry.dispose();
          (starMesh.material as THREE.Material).dispose();
          starGlowMesh.geometry.dispose();
          (starGlowMesh.material as THREE.Material).dispose();
        };
      } catch (error) {
        console.error('Error initializing scene:', error);
      }
    };

    initScene();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (searchedStarName) {
      const star = starsByNameRef.current.get(searchedStarName.toLowerCase());
      if (star) {
        navigateToStar(star);
      }
    }
  }, [searchedStarName, navigateToStar]);

  return (
    <div className="w-full h-full flex flex-col bg-black overflow-hidden">
      <div ref={containerRef} className="flex-1 relative" style={{ overflow: 'hidden' }}></div>
      <StarInfoBox star={hoveredStar} altAz={hoveredStarAltAz} />
      <HorizonWarning message={belowHorizonWarning} />
    </div>
  );
});