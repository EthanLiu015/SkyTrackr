import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import * as THREE from 'three';
import { loadStarData, type Star, magnitudeToSize } from '../utils/starDataLoader';
import { getUserLocation, type UserLocation } from '../utils/geolocation';
import { calculateAltAz, getLocalSiderealTime, getPlanets } from '../utils/astroUtils';
import { type Planet } from './planetData';
import { useSimulationTime, SimulationTimeProvider } from '../contexts/SimulationTimeContext';
import { StarInfoBox } from './ui/StarInfoBox';
import { HorizonWarning } from './ui/HorizonWarning';
import { createSkySphere, createGround, createDirectionalMarkers } from './three/SceneSetup';
import { createStarField } from './three/StarrySky';
import { useCameraControls } from './three/hooks/useCameraControls';
import { TimeController } from './TimeController';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

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

const createCrosshairTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(64, 64, 40, 0, 2 * Math.PI);
    ctx.moveTo(64, 10);
    ctx.lineTo(64, 44);
    ctx.moveTo(64, 84);
    ctx.lineTo(64, 118);
    ctx.moveTo(10, 64);
    ctx.lineTo(44, 64);
    ctx.moveTo(84, 64);
    ctx.lineTo(118, 64);
    ctx.stroke();
  }
  return new THREE.CanvasTexture(canvas);
};

/**
 * Main SkyViewer component that renders the 3D sky scene.
 * Handles star visualization, camera controls, and user interaction.
 */
const SkyViewerInner = forwardRef<SkyViewerHandles, SkyViewerProps>(function SkyViewerComponent({ searchedStarName, onStarDataLoaded }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const starsRef = useRef<Map<number, Star>>(new Map());
  const starsByNameRef = useRef<Map<string, Star>>(new Map());
  const starAltAzRef = useRef<Map<number, StarAltAz>>(new Map());
  const starMeshRef = useRef<THREE.Points | null>(null);
  const starSpriteGroupRef = useRef<THREE.Group | null>(null);
  const celestialGroupRef = useRef<THREE.Group | null>(null);
  const planetsRef = useRef<Planet[]>([]);
  const planetGroupRef = useRef<THREE.Group | null>(null);
  const crosshairSpriteRef = useRef<THREE.Sprite | null>(null);
  const crosshairTargetRef = useRef<{ type: 'star' | 'planet', data: Star | Planet } | null>(null);
  const labelRendererRef = useRef<CSS2DRenderer | null>(null);
  const brightestLabelsRef = useRef<CSS2DObject[]>([]);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const [hoveredStar, setHoveredStar] = useState<Star | null>(null);
  const [hoveredStarAltAz, setHoveredStarAltAz] = useState<StarAltAz | null>(null);
  const hoveredStarRef = useRef<Star | null>(null);
  const [belowHorizonWarning, setBelowHorizonWarning] = useState<string | null>(null);
  const [observer, setObserver] = useState({
    latitude: 0,
    longitude: 0,
  });
  const observerRef = useRef({ latitude: 0, longitude: 0 });
  const [sceneReady, setSceneReady] = useState(false);
  
  const [planetTextures] = useState(() => ({
    map: createCircleTexture(),
    glow: createGlowTexture()
  }));

  const { simulationTime } = useSimulationTime();
  const cameraControlRef = useCameraControls(containerRef, cameraRef);

  // Ref to access current simulation time inside closures (like event listeners)
  const simulationTimeRef = useRef(simulationTime);
  useEffect(() => { 
    simulationTimeRef.current = simulationTime; 
  }, [simulationTime]);

  /**
   * Moves the camera to look at a specific target (star or planet).
   * Checks if the target is below the horizon and sets a warning if so.
   */
  const navigateToTarget = useCallback((target: { ra: number, dec: number, name: string }) => {
    if (!cameraRef.current) return;
    const altAz = calculateAltAz(
      { ra: target.ra, dec: target.dec },
      { lat: observer.latitude, lon: observer.longitude },
      simulationTimeRef.current
    );

    setBelowHorizonWarning(null);
    
    const altRad = (altAz.altitude * Math.PI) / 180;
    const azRad = (altAz.azimuth * Math.PI) / 180;

    cameraControlRef.current.phi = Math.PI / 2 - altRad;
    cameraControlRef.current.theta = azRad;
    
    cameraControlRef.current.fov = 30;
    cameraRef.current.fov = 30;
    cameraRef.current.updateProjectionMatrix();
  }, [cameraControlRef, observer]);

  const performSearch = useCallback((starName: string) => {
    const lowerName = starName.trim().toLowerCase();
    const star = starsByNameRef.current.get(lowerName);
    if (star) {
      crosshairTargetRef.current = { type: 'star', data: star };
      navigateToTarget({ ra: star.RAJ2000, dec: star.DEJ2000, name: star.display_name });
      return;
    }
    
    const planet = planetsRef.current.find(p => p.name.trim().toLowerCase() === lowerName);
    if (planet) {
      crosshairTargetRef.current = { type: 'planet', data: planet };
      navigateToTarget({ ra: planet.ra, dec: planet.dec, name: planet.name });
    }
  }, [navigateToTarget]);

  useImperativeHandle(ref, () => ({
    /**
     * Exposed method to search for a star by name and navigate to it.
     */
    searchForStar: (starName: string) => {
      performSearch(starName);
    }
  }), [performSearch]);

  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | undefined;

    /**
     * Initializes the THREE.js scene, camera, renderer, and objects.
     * Loads star data and sets up event listeners.
     */
    const initScene = async () => {
      if (!containerRef.current) return;

      try {
        const location: UserLocation = await getUserLocation();
        if (!active) return;

        const stars = await loadStarData();
        if (!active) return;

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

        const ground = createGround() as THREE.Mesh;
        // Enable transparency for fading
        if (ground.material) {
          (ground.material as THREE.Material).transparent = true;
        }
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

        // Create Crosshair Sprite
        const crosshairTexture = createCrosshairTexture();
        const crosshairMaterial = new THREE.SpriteMaterial({
          map: crosshairTexture,
          color: 0x00ff00,
          transparent: true,
          depthTest: false,
          depthWrite: false,
        });
        const crosshairSprite = new THREE.Sprite(crosshairMaterial);
        crosshairSprite.scale.set(40, 40, 1);
        crosshairSprite.visible = false;
        scene.add(crosshairSprite);
        crosshairSpriteRef.current = crosshairSprite;

        // Setup Label Renderer
        const labelRenderer = new CSS2DRenderer();
        labelRenderer.setSize(width, height);
        labelRenderer.domElement.style.position = 'absolute';
        labelRenderer.domElement.style.top = '0px';
        labelRenderer.domElement.style.pointerEvents = 'none';
        containerRef.current.appendChild(labelRenderer.domElement);
        labelRendererRef.current = labelRenderer;

        // Create a pool of labels for the brightest objects
        for (let i = 0; i < 10; i++) {
          const labelDiv = document.createElement('div');
          labelDiv.className = 'celestial-label';
          labelDiv.style.color = 'rgba(255, 255, 255, 0.7)';
          labelDiv.style.fontSize = '12px';
          labelDiv.style.textShadow = '0 0 4px black';
          labelDiv.style.marginTop = '-25px';
          const label = new CSS2DObject(labelDiv);
          label.visible = false;
          scene.add(label);
          brightestLabelsRef.current.push(label);
        }

        const textureLoader = new THREE.TextureLoader();

        const now = new Date();
        const latitude = location.latitude || 0;
        const longitude = location.longitude || 0;
        const observerCoords = { lat: latitude, lon: longitude };

        setObserver({ latitude, longitude });
        observerRef.current = { latitude, longitude };

        // Create a Celestial Group to hold stars and planets
        // This group will be rotated to simulate sky rotation
        const celestialGroup = new THREE.Group();
        scene.add(celestialGroup);
        celestialGroupRef.current = celestialGroup;

        // Create Planets as Sprites
        const planetGroup = new THREE.Group();
        celestialGroup.add(planetGroup);
        planetGroupRef.current = planetGroup;

        stars.forEach((star) => {
          starsByNameRef.current.set(star.display_name.trim().toLowerCase(), star);
        });

        const { starMesh } = createStarField(stars, observerCoords, now, starsRef, starAltAzRef);
        
        // Dispose of the original starMesh as we are replacing it with sprites
        starMesh.geometry.dispose();
        (starMesh.material as THREE.Material).dispose();

        // Create Star Sprites
        const starSpriteGroup = new THREE.Group();
        celestialGroup.add(starSpriteGroup);
        starSpriteGroupRef.current = starSpriteGroup;

        stars.forEach((star, i) => {
          // Position stars using Horizontal Coordinates (Alt/Az)
          const altAz = calculateAltAz(
            { ra: star.RAJ2000, dec: star.DEJ2000 },
            { lat: latitude, lon: longitude },
            now
          );

          const radius = 500;
          const altRad = THREE.MathUtils.degToRad(altAz.altitude);
          const azRad = THREE.MathUtils.degToRad(altAz.azimuth);

          // Convert Alt/Az to Cartesian (x, y, z)
          // Y is Up (Zenith), -Z is North, +X is East
          const rPlane = radius * Math.cos(altRad);
          const x = rPlane * Math.sin(azRad);
          const y = radius * Math.sin(altRad);
          const z = -rPlane * Math.cos(azRad);

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
            map: planetTextures.map,
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
            map: planetTextures.glow,
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
          glowSprite.userData = { star, isGlow: true };
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
        };

        containerRef.current.addEventListener('mousemove', handleMouseMove);

        const handleUserInteraction = () => {
          crosshairTargetRef.current = null;
          if (crosshairSpriteRef.current) {
            crosshairSpriteRef.current.visible = false;
          }
        };
        containerRef.current.addEventListener('mousedown', handleUserInteraction);
        containerRef.current.addEventListener('touchstart', handleUserInteraction);

        setSceneReady(true);

        let lastLabelUpdate = 0;
        let currentTop10: { name: string; magnitude: number; data: Star | Planet }[] = [];

        /**
         * Animation loop for rendering the scene.
         */
        const animate = () => {
          const phi = cameraControlRef.current.phi;
          const theta = cameraControlRef.current.theta;

          const lookAtPoint = new THREE.Vector3().setFromSphericalCoords(100, phi, Math.PI - theta);

          if (cameraRef.current) {
            cameraRef.current.position.set(0, 1.6, 0);
            cameraRef.current.lookAt(lookAtPoint.add(cameraRef.current.position));

            if (typeof cameraControlRef.current.fov === 'number' && Math.abs(cameraRef.current.fov - cameraControlRef.current.fov) > 0.01) {
              cameraRef.current.fov = cameraControlRef.current.fov;
              cameraRef.current.updateProjectionMatrix();
            }
          }

          // Fade ground when looking below horizon
          const horizonPhi = Math.PI / 2;
          const fadeRange = THREE.MathUtils.degToRad(60); // Fade out over 60 degrees
          
          let groundOpacity = 1.0;
          if (phi > horizonPhi) {
            const delta = phi - horizonPhi;
            groundOpacity = Math.max(0, 1.0 - (delta / fadeRange));
          }
          
          if (ground.material) {
            (ground.material as THREE.Material).opacity = groundOpacity;
            ground.visible = groundOpacity > 0;
          }
          
          // Update Sky Rotation
          // Instead of rotating the group, we update star positions based on Alt/Az
          if (starSpriteGroupRef.current) {
            const lat = observerRef.current.latitude;
            const lon = observerRef.current.longitude;
            const time = simulationTimeRef.current;
            const radius = 500;

            // Calculate LST once per frame
            const lst = getLocalSiderealTime(time, lon);
            const latRad = THREE.MathUtils.degToRad(lat);
            const sinLat = Math.sin(latRad);
            const cosLat = Math.cos(latRad);

            starSpriteGroupRef.current.children.forEach((child) => {
              if (child.userData.star) {
                const star = child.userData.star;
                const ra = star.RAJ2000;
                const dec = star.DEJ2000;

                const ha = (lst - ra + 360) % 360;
                const haRad = THREE.MathUtils.degToRad(ha);
                const decRad = THREE.MathUtils.degToRad(dec);

                const sinDec = Math.sin(decRad);
                const cosDec = Math.cos(decRad);
                const cosHa = Math.cos(haRad);
                const sinHa = Math.sin(haRad);

                const sinAlt = sinLat * sinDec + cosLat * cosDec * cosHa;
                const altRad = Math.asin(sinAlt);

                const yVal = -cosDec * sinHa;
                const xVal = cosLat * sinDec - sinLat * cosDec * cosHa;
                const azRad = Math.atan2(yVal, xVal);

                const rPlane = radius * Math.cos(altRad);
                const xPos = rPlane * Math.sin(azRad);
                const yPos = radius * sinAlt;
                const zPos = -rPlane * Math.cos(azRad);

                child.position.set(xPos, yPos, zPos);
              }
            });
          }

          // Update Planet Positions in animate loop for smooth rotation
          if (planetGroupRef.current) {
            planetGroupRef.current.children.forEach((child) => {
              const name = child.userData.planetName;
              const planet = planetsRef.current.find(p => p.name === name);
              if (planet) {
                const altAz = calculateAltAz({ ra: planet.ra, dec: planet.dec }, { lat: observerRef.current.latitude, lon: observerRef.current.longitude }, simulationTimeRef.current);
                const radius = 500;
                const altRad = THREE.MathUtils.degToRad(altAz.altitude);
                const azRad = THREE.MathUtils.degToRad(altAz.azimuth);
                const rPlane = radius * Math.cos(altRad);
                const x = rPlane * Math.sin(azRad);
                const y = radius * Math.sin(altRad);
                const z = -rPlane * Math.cos(azRad);
                child.position.set(x, y, z);
              }
            });
          }

          // Update Crosshair
          if (crosshairSpriteRef.current && crosshairTargetRef.current) {
             const target = crosshairTargetRef.current;
             let ra = 0, dec = 0;
             if (target.type === 'star') {
                 ra = (target.data as Star).RAJ2000;
                 dec = (target.data as Star).DEJ2000;
             } else {
                 ra = (target.data as Planet).ra;
                 dec = (target.data as Planet).dec;
             }
             
             const altAz = calculateAltAz({ ra, dec }, { lat: observerRef.current.latitude, lon: observerRef.current.longitude }, simulationTimeRef.current);
             const radius = 480;
             const altRad = THREE.MathUtils.degToRad(altAz.altitude);
             const azRad = THREE.MathUtils.degToRad(altAz.azimuth);

             const rPlane = radius * Math.cos(altRad);
             const x = rPlane * Math.sin(azRad);
             const y = radius * Math.sin(altRad);
             const z = -rPlane * Math.cos(azRad);
             
             crosshairSpriteRef.current.position.set(x, y, z);
             crosshairSpriteRef.current.visible = true;
          } else if (crosshairSpriteRef.current) {
             crosshairSpriteRef.current.visible = false;
          }

          // Update labels selection (throttled)
          const now = Date.now();
          if (now - lastLabelUpdate > 1000) {
            lastLabelUpdate = now;

            const allObjects = [
              ...Array.from(starsByNameRef.current.values()),
              ...planetsRef.current
            ];

            const visibleObjects = allObjects.map(obj => {
              const isStar = 'Vmag' in obj;
              const ra = isStar ? (obj as Star).RAJ2000 : (obj as Planet).ra;
              const dec = isStar ? (obj as Star).DEJ2000 : (obj as Planet).dec;
              const magnitude = isStar ? (obj as Star).Vmag : (obj as any).magnitude;
              const name = isStar ? (obj as Star).display_name : (obj as Planet).name;

              if (typeof magnitude !== 'number') return null;

              const altAz = calculateAltAz({ ra, dec }, { lat: observerRef.current.latitude, lon: observerRef.current.longitude }, simulationTimeRef.current);
              if (altAz.altitude <= 0) return null;

              return { name, magnitude, data: obj };
            }).filter(Boolean) as { name: string; magnitude: number; data: Star | Planet }[];

            visibleObjects.sort((a, b) => a.magnitude - b.magnitude);
            currentTop10 = visibleObjects.slice(0, 10);

            brightestLabelsRef.current.forEach((label, i) => {
              if (i < currentTop10.length) {
                (label.element as HTMLDivElement).textContent = currentTop10[i].name;
                label.visible = true;
              } else {
                label.visible = false;
              }
            });
          }

          // Update label positions every frame
          currentTop10.forEach((item, i) => {
             const label = brightestLabelsRef.current[i];
             if (label && label.visible) {
                 const obj = item.data;
                 const isStar = 'Vmag' in obj;
                 const ra = isStar ? (obj as Star).RAJ2000 : (obj as Planet).ra;
                 const dec = isStar ? (obj as Star).DEJ2000 : (obj as Planet).dec;

                 const altAz = calculateAltAz({ ra, dec }, { lat: observerRef.current.latitude, lon: observerRef.current.longitude }, simulationTimeRef.current);
                 
                 const radius = 500;
                 const altRad = THREE.MathUtils.degToRad(altAz.altitude);
                 const azRad = THREE.MathUtils.degToRad(altAz.azimuth);

                 const rPlane = radius * Math.cos(altRad);
                 const x = rPlane * Math.sin(azRad);
                 const y = radius * Math.sin(altRad);
                 const z = -rPlane * Math.cos(azRad);

                 label.position.set(x, y, z);
             }
          });

          if (cameraRef.current) {
            // Render first to ensure matrices are updated
            renderer.render(scene, cameraRef.current);
            labelRendererRef.current?.render(scene, cameraRef.current);

            // Perform Raycasting using the updated matrices
            raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
            
            let planetHovered = false;
            let newHoveredStar: Star | null = null;
            let newHoveredAltAz: StarAltAz | null = null;

            // Check planets
            if (planetGroupRef.current) {
              const intersects = raycasterRef.current.intersectObjects(planetGroupRef.current.children, true);
              const hit = intersects.find(intersect => intersect.object.userData.isPlanet);
              if (hit) {
                const planetContainer = hit.object.parent;
                const index = planetContainer ? planetGroupRef.current.children.indexOf(planetContainer) : -1;
                if (index !== -1 && planetsRef.current[index]) {
                  const planet = planetsRef.current[index];
                  newHoveredStar = {
                    id: -1,
                    display_name: planet.name,
                    constellation: 'Solar System',
                    magnitude: (planet as any).magnitude,
                    mag: (planet as any).magnitude,
                    vmag: (planet as any).magnitude,
                    Vmag: (planet as any).magnitude,
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

                  newHoveredAltAz = calculateAltAz(
                    { ra: planet.ra, dec: planet.dec },
                    { lat: observerRef.current.latitude, lon: observerRef.current.longitude },
                    simulationTimeRef.current
                  );
                  planetHovered = true;
                }
              }
            }

            // Check stars if no planet hovered
            if (!planetHovered && starSpriteGroupRef.current) {
              const intersects = raycasterRef.current.intersectObjects(starSpriteGroupRef.current.children);
              const hit = intersects.find(intersect => intersect.object.userData && intersect.object.userData.star && !intersect.object.userData.isGlow);

              if (hit) {
                const { star } = hit.object.userData;
                if (star) {
                  newHoveredStar = star;
                  newHoveredAltAz = calculateAltAz(
                    { ra: star.RAJ2000, dec: star.DEJ2000 },
                    { lat: observerRef.current.latitude, lon: observerRef.current.longitude },
                    simulationTimeRef.current
                  );
                }
              }
            }

            // Update state only if changed
            if (newHoveredStar !== hoveredStarRef.current) {
              hoveredStarRef.current = newHoveredStar;
              setHoveredStar(newHoveredStar);
              setHoveredStarAltAz(newHoveredAltAz);
            } else if (newHoveredStar && newHoveredAltAz) {
               // If still hovering the same star, update AltAz as time passes
               setHoveredStarAltAz(newHoveredAltAz);
            }
          }

          requestAnimationFrame(animate);
        };

        animate();

        cleanup = () => {
          window.removeEventListener('resize', handleResize);
          containerRef.current?.removeEventListener('mousemove', handleMouseMove);
          containerRef.current?.removeEventListener('mousedown', handleUserInteraction);
          containerRef.current?.removeEventListener('touchstart', handleUserInteraction);
          if (crosshairSpriteRef.current) {
             crosshairSpriteRef.current.material.dispose();
             crosshairTexture.dispose();
          }
          if (labelRendererRef.current) {
            containerRef.current?.removeChild(labelRendererRef.current.domElement);
          }
          brightestLabelsRef.current = [];
          renderer.dispose();
          skySphere.geometry.dispose();
          (skySphere.material as THREE.Material).dispose();
          ground.geometry.dispose();
          (ground.material as THREE.Material).dispose();
          
          planetGroup.children.forEach((child) => {
            child.children.forEach((grandChild) => {
              if (grandChild instanceof THREE.Sprite) {
                (grandChild.material as THREE.Material).dispose();
              }
            });
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
    return () => {
      active = false;
      if (cleanup) cleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update planets when time changes
  useEffect(() => {
    if (!sceneReady) return;
    
    const updatePlanets = () => {
      if (!planetGroupRef.current) return;
      
      // Calculate planet positions locally
      const planets = getPlanets(simulationTimeRef.current);

      planetsRef.current = planets;

      if (onStarDataLoaded && starsByNameRef.current.size > 0) {
        const starNames = Array.from(starsByNameRef.current.values()).map(s => s.display_name);
        onStarDataLoaded([...starNames, ...planets.map(p => p.name)]);
      }

      const planetGroup = planetGroupRef.current;
      const radius = 500;
      
      // Map existing planets by name for reuse
      const existingPlanets = new Map<string, THREE.Group>();
      planetGroup.children.forEach((child) => {
        if (child.userData.planetName) {
          existingPlanets.set(child.userData.planetName, child as THREE.Group);
        }
      });

      const currentPlanetNames = new Set<string>();

      planets.forEach((planet: Planet) => {
        currentPlanetNames.add(planet.name);
        let planetContainer = existingPlanets.get(planet.name);

        // Position planet using Alt/Az
        const altAz = calculateAltAz({ ra: planet.ra, dec: planet.dec }, { lat: observerRef.current.latitude, lon: observerRef.current.longitude }, simulationTimeRef.current);
        const altRad = THREE.MathUtils.degToRad(altAz.altitude);
        const azRad = THREE.MathUtils.degToRad(altAz.azimuth);

        const rPlane = radius * Math.cos(altRad);
        const x = rPlane * Math.sin(azRad);
        const y = radius * Math.sin(altRad);
        const z = -rPlane * Math.cos(azRad);

        if (!planetContainer) {
          planetContainer = new THREE.Group();
          planetContainer.userData.planetName = planet.name;

          const planetColor = new THREE.Color(planet.color);
          planetColor.lerp(new THREE.Color(0xffffff), 0.6);

          const material = new THREE.SpriteMaterial({
            map: planetTextures.map,
            color: planetColor,
            transparent: true,
            depthTest: false,
            depthWrite: false,
          });

          const sprite = new THREE.Sprite(material);
          sprite.userData = { isPlanet: true };
          
          const scale = magnitudeToSize((planet as any).magnitude) * 6.0;
          sprite.scale.set(scale, scale, 1);
          planetContainer.add(sprite);

          const glowMaterial = new THREE.SpriteMaterial({
            map: planetTextures.glow,
            color: planetColor,
            transparent: true,
            opacity: 0.6,
            depthTest: false,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          });
          const glowSprite = new THREE.Sprite(glowMaterial);
          const glowScale = scale * 4.0;
          glowSprite.scale.set(glowScale, glowScale, 1);
          planetContainer.add(glowSprite);

          planetGroup.add(planetContainer);
        }

        // Update position
        planetContainer.position.set(x, y, z);

        // Update scale
        const scale = magnitudeToSize((planet as any).magnitude) * 6.0;
        const sprite = planetContainer.children[0] as THREE.Sprite;
        if (sprite) sprite.scale.set(scale, scale, 1);
        
        const glowSprite = planetContainer.children[1] as THREE.Sprite;
        if (glowSprite) {
          const glowScale = scale * 4.0;
          glowSprite.scale.set(glowScale, glowScale, 1);
        }
      });

      // Remove planets that are no longer present
      existingPlanets.forEach((group, name) => {
        if (!currentPlanetNames.has(name)) {
          planetGroup.remove(group);
          group.children.forEach((child) => {
            if (child instanceof THREE.Sprite) {
              child.material.dispose();
            }
          });
        }
      });
    };

    updatePlanets();
    const interval = setInterval(updatePlanets, 2000);

    return () => { 
      clearInterval(interval);
    };
  }, [observer, sceneReady, planetTextures, onStarDataLoaded]);

  useEffect(() => {
    if (searchedStarName && sceneReady) {
      performSearch(searchedStarName);
    }
  }, [searchedStarName, performSearch, sceneReady]);

  return (
    <div className="w-full h-full flex flex-col bg-black overflow-hidden relative">
      <div ref={containerRef} className="flex-1 relative" style={{ overflow: 'hidden' }}></div>

      <StarInfoBox star={hoveredStar} altAz={hoveredStarAltAz} />
      <TimeController />
      <HorizonWarning message={belowHorizonWarning} />
    </div>
  );
});

export const SkyViewer = forwardRef<SkyViewerHandles, SkyViewerProps>((props, ref) => (
  <SimulationTimeProvider>
    <SkyViewerInner {...props} ref={ref} />
  </SimulationTimeProvider>
));