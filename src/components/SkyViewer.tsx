import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import * as THREE from 'three';
import { loadStarData, type Star, magnitudeToSize } from '../utils/starDataLoader';
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
  const starSpriteGroupRef = useRef<THREE.Group | null>(null);
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

        const textureLoader = new THREE.TextureLoader();

        const now = new Date();
        const latitude = location.latitude || 0;
        const longitude = location.longitude || 0;
        const observerCoords = { lat: latitude, lon: longitude };

        setObserver({ latitude, longitude });
        observerRef.current = { latitude, longitude };

        // Create Planets as Sprites
        const planetGroup = new THREE.Group();
        scene.add(planetGroup);
        planetGroupRef.current = planetGroup;

        // Helper to create a fallback circle texture
        const createCircleTexture = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 64;
          canvas.height = 64;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.beginPath();
            ctx.arc(32, 32, 28, 0, 2 * Math.PI);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
          }
          return new THREE.CanvasTexture(canvas);
        };
        const fallbackTexture = createCircleTexture();

        const createGlowTexture = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 32;
          canvas.height = 32;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
            gradient.addColorStop(0.15, 'rgba(255, 255, 255, 1)');
            gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)');
            gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
            gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.1)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 32, 32);
          }
          return new THREE.CanvasTexture(canvas);
        };
        const glowTexture = createGlowTexture();

        planets.forEach((planet) => {
          // Use Sprite for 2D images to ensure they are visible and not distorted
          const material = new THREE.SpriteMaterial({ 
            map: fallbackTexture,
            color: planet.color,
            transparent: true,
            depthTest: false,
            depthWrite: false,
          });

          const sprite = new THREE.Sprite(material);
          sprite.renderOrder = 999;
          
          // Scale sprite based on planet size. 
          // Adjusted multiplier for visibility.
          const scale = 4.0 * planet.size; 
          sprite.scale.set(scale, scale, 1);
          
          planetGroup.add(sprite);
        });

        stars.forEach((star) => {
          starsByNameRef.current.set(star.display_name.toLowerCase(), star);
        });

        const { starMesh } = createStarField(stars, observerCoords, now, starsRef, starAltAzRef);
        
        // Dispose of the original starMesh as we are replacing it with sprites
        starMesh.geometry.dispose();
        (starMesh.material as THREE.Material).dispose();

        // Create Star Sprites
        const starSpriteGroup = new THREE.Group();
        scene.add(starSpriteGroup);
        starSpriteGroupRef.current = starSpriteGroup;

        stars.forEach((star, i) => {
          const altAz = starAltAzRef.current.get(i);
          if (!altAz) return;

          const radius = 500;
          const altRad = THREE.MathUtils.degToRad(altAz.altitude);
          const azRad = THREE.MathUtils.degToRad(altAz.azimuth);
          const phi = Math.PI / 2 - altRad;
          const theta = azRad;

          const x = radius * Math.sin(phi) * Math.sin(theta);
          const y = radius * Math.cos(phi);
          const z = -radius * Math.sin(phi) * Math.cos(theta);

          // Determine color
          let color = 0xffffff;
          if ((star as any).color) {
            color = (star as any).color;
          } else if ((star as any).ci !== undefined) {
             // Simple CI to color approximation
             const ci = (star as any).ci;
             if (ci < 0.0) color = 0x9bb0ff;
             else if (ci < 0.5) color = 0xcad7ff;
             else if (ci < 1.0) color = 0xf8f7ff;
             else if (ci < 1.5) color = 0xfff4ea;
             else color = 0xffd2a1;
          }

          const material = new THREE.SpriteMaterial({
            map: fallbackTexture,
            color: color,
            transparent: true,
            depthTest: false,
            depthWrite: false,
          });

          const sprite = new THREE.Sprite(material);
          sprite.position.set(x, y, z);
          
          // Scale based on magnitude
          // Brighter stars (lower magnitude) should be larger
          const rawMag = (star as any).vmag ?? (star as any).mag ?? (star as any).magnitude ?? (star as any).Vmag ?? 4;
          const magnitude = typeof rawMag === 'string' ? parseFloat(rawMag) : rawMag;
          const scale = magnitudeToSize(magnitude) * 6.0;

          const glowMaterial = new THREE.SpriteMaterial({
            map: glowTexture,
            color: color,
            transparent: true,
            opacity: 0.5,
            depthTest: false,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          });
          const glowSprite = new THREE.Sprite(glowMaterial);
          glowSprite.position.set(x, y, z);
          const glowScale = scale * 4.0;
          glowSprite.scale.set(glowScale, glowScale, 1);
          starSpriteGroup.add(glowSprite);

          sprite.scale.set(scale, scale, 1);
          
          sprite.userData = { star, index: i };
          starSpriteGroup.add(sprite);
        });

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

            if (!planetHovered && starSpriteGroupRef.current) {
              const intersects = raycasterRef.current.intersectObjects(starSpriteGroupRef.current.children);

              if (intersects.length > 0) {
                const sprite = intersects[0].object;
                const { star, index } = sprite.userData;
                if (star) {
                  const altAz = starAltAzRef.current.get(index);
                  setHoveredStar(star);
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
          
          planetGroup.children.forEach((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.dispose();
              (child.material as THREE.Material).dispose();
            } else if (child instanceof THREE.Sprite) {
              (child.material as THREE.Material).dispose();
            }
          });

          starSpriteGroup.children.forEach((child) => {
            if (child instanceof THREE.Sprite) {
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
      <StarInfoBox star={hoveredStar} altAz={hoveredStarAltAz} />
      <HorizonWarning message={belowHorizonWarning} />
    </div>
  );
});