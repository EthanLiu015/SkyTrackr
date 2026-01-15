import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback, Component, type ErrorInfo } from 'react';
import * as THREE from 'three';
import { loadStarData, type Star } from '../utils/starDataLoader';
import { getUserLocation, type UserLocation } from '../utils/geolocation';
import { calculateAltAz } from '../utils/astroUtils';
import { fetchPlanets, type Planet } from './planetData';
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

class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("StarInfoBox crashed:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="absolute bottom-20 left-4 bg-red-900/90 text-white p-4 rounded border border-red-500 z-50 max-w-md">
          <h4 className="font-bold mb-1">Debug: Component Error</h4>
          <p className="text-sm font-mono">{this.state.error?.message}</p>
          <p className="text-xs mt-2 text-gray-300">Check console for object details</p>
        </div>
      );
    }
    return this.props.children;
  }
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
  const planetsRef = useRef<Planet[]>([]);
  const planetGroupRef = useRef<THREE.Group | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const [hoveredStar, setHoveredStar] = useState<Star | null>(null);
  const [hoveredStarAltAz, setHoveredStarAltAz] = useState<StarAltAz | null>(null);
  const [belowHorizonWarning, setBelowHorizonWarning] = useState<string | null>(null);
  const [observer, setObserver] = useState({
    latitude: 0,
    longitude: 0,
  });
  const observerRef = useRef({ latitude: 0, longitude: 0 });

  const cameraControlRef = useCameraControls(containerRef, cameraRef);

  /**
   * Moves the camera to look at a specific target (star or planet).
   * Checks if the target is below the horizon and sets a warning if so.
   */
  const navigateToTarget = useCallback((target: { ra: number, dec: number, name: string }) => {
    if (!cameraRef.current) return;
    const altAz = calculateAltAz(
      { ra: target.ra, dec: target.dec },
      { lat: observer.latitude, lon: observer.longitude },
      new Date()
    );

    if (altAz.altitude <= 0) {
      setBelowHorizonWarning(`${target.name} is below the horizon right now.`);
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
    
    console.log(`Navigating to ${target.name}`);
  }, [cameraControlRef, observer]);

  useImperativeHandle(ref, () => ({
    /**
     * Exposed method to search for a star by name and navigate to it.
     */
    searchForStar: (starName: string) => {
      const lowerName = starName.toLowerCase();
      const star = starsByNameRef.current.get(lowerName);
      if (star) {
        navigateToTarget({ ra: star.RAJ2000, dec: star.DEJ2000, name: star.display_name });
        return;
      }
      
      const planet = planetsRef.current.find(p => p.name.toLowerCase() === lowerName);
      if (planet) {
        navigateToTarget({ ra: planet.ra, dec: planet.dec, name: planet.name });
      }
    }
  }), [navigateToTarget]);

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
        const planets = await fetchPlanets(location.latitude || 0, location.longitude || 0);
        planetsRef.current = planets;
        onStarDataLoaded?.([...stars.map(star => star.display_name), ...planets.map(p => p.name)]);
        
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
        observerRef.current = { latitude, longitude };

        // Create Planets as Spheres
        const planetGroup = new THREE.Group();
        scene.add(planetGroup);
        planetGroupRef.current = planetGroup;

        planets.forEach((planet) => {
          // Base size multiplier. Stars are small points. Let's make planets significantly larger.
          // planet.size ranges from 0.8 to 2.0.
          const geometry = new THREE.SphereGeometry(2.5 * planet.size, 16, 16);
          const material = new THREE.MeshBasicMaterial({ color: planet.color });
          const mesh = new THREE.Mesh(geometry, material);
          planetGroup.add(mesh);
        });

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
            
            // Check planets first
            let planetHovered = false;
            if (planetGroupRef.current) {
              const intersects = raycasterRef.current.intersectObjects(planetGroupRef.current.children);
              if (intersects.length > 0) {
                const object = intersects[0].object;
                const index = planetGroupRef.current.children.indexOf(object);
                if (index !== -1 && planetsRef.current[index]) {
                  const planet = planetsRef.current[index];
                  const planetStar = {
                    id: -1,
                    display_name: planet.name,
                    constellation: 'Solar System',
                    magnitude: -2.0, // Planets are generally bright
                    mag: -2.0,
                    vmag: -2.0,
                    Vmag: -2.0,
                    color: planet.color,
                    RAJ2000: planet.ra,
                    DEJ2000: planet.dec,
                    ra: planet.ra,
                    dec: planet.dec,
                    dist_ly: 0,
                    dist: 0,
                    spectral_type: 'Planet',
                    proper_name: planet.name,
                    bf_designation: '',
                    abs_mag: 0,
                    ci: 0,
                    vx: 0,
                    vy: 0,
                    vz: 0,
                    x: 0,
                    y: 0,
                    z: 0,
                    rv: 0,
                    pmra: 0,
                    pmdec: 0,
                    lum: 0,
                    parallax: 0,
                    distance: 0,
                    radial_velocity: 0,
                    // Additional properties to prevent crashes
                    temperature: 0,
                    mass: 0,
                    radius: 0,
                    rarad: 0,
                    decrad: 0,
                    bayer: '',
                    flamsteed: '',
                    con: '',
                    comp: 0,
                    base: '',
                    var: '',
                    var_min: 0,
                    var_max: 0,
                    hip: 0,
                    hd: 0,
                    hr: 0,
                    gl: '',
                  } as unknown as Star;

                  const altAz = calculateAltAz(
                    { ra: planet.ra, dec: planet.dec },
                    { lat: observerRef.current.latitude, lon: observerRef.current.longitude },
                    new Date()
                  );

                  setHoveredStar(planetStar);
                  setHoveredStarAltAz(altAz);
                  planetHovered = true;
                }
              }
            }

            if (!planetHovered && starMeshRef.current) {
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
          
          // Update Planets
          if (planetGroupRef.current && planetsRef.current.length > 0) {
            const now = new Date();
            const radius = 500; // Place planets inside the sky sphere

            planetGroupRef.current.children.forEach((child, i) => {
              if (i >= planetsRef.current.length) return;
              const planet = planetsRef.current[i];
              
              // Use local latitude/longitude variables to ensure correct location in closure
              const altAz = calculateAltAz(
                { ra: planet.ra, dec: planet.dec },
                { lat: latitude, lon: longitude },
                now
              );

              const altRad = (altAz.altitude * Math.PI) / 180;
              const azRad = (altAz.azimuth * Math.PI) / 180;
              const phi = Math.PI / 2 - altRad;
              const theta = azRad;

              child.position.set(
                radius * Math.sin(phi) * Math.sin(theta),
                radius * Math.cos(phi),
                -radius * Math.sin(phi) * Math.cos(theta)
              );
            });
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
          
          planetGroup.children.forEach((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.dispose();
              (child.material as THREE.Material).dispose();
            }
          });
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
      const lowerName = searchedStarName.toLowerCase();
      const star = starsByNameRef.current.get(lowerName);
      if (star) {
        navigateToTarget({ ra: star.RAJ2000, dec: star.DEJ2000, name: star.display_name });
        return;
      }
      
      const planet = planetsRef.current.find(p => p.name.toLowerCase() === lowerName);
      if (planet) {
        navigateToTarget({ ra: planet.ra, dec: planet.dec, name: planet.name });
      }
    }
  }, [searchedStarName, navigateToTarget]);

  return (
    <div className="w-full h-full flex flex-col bg-black overflow-hidden">
      <div ref={containerRef} className="flex-1 relative" style={{ overflow: 'hidden' }}></div>
      <ErrorBoundary>
        <StarInfoBox star={hoveredStar} altAz={hoveredStarAltAz} />
      </ErrorBoundary>
      <HorizonWarning message={belowHorizonWarning} />
    </div>
  );
});