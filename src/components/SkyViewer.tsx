import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { loadStarData, celestialToCartesian, magnitudeToSize, type Star } from '../utils/starDataLoader';
import { getUserLocation } from '../utils/geolocation';
import { StarSearch } from './StarSearch';

interface SkyViewerProps {
  onSearchStar?: (star: Star | null) => void;
}

export function SkyViewer({ onSearchStar }: SkyViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const starsRef = useRef<Map<number, Star>>(new Map());
  const starsByNameRef = useRef<Map<string, Star>>(new Map());
  const starMeshRef = useRef<THREE.Points | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const [hoveredStar, setHoveredStar] = useState<Star | null>(null);
  const [availableStarNames, setAvailableStarNames] = useState<string[]>([]);
  const searchedStarRef = useRef<Star | null>(null);
  
  // Store observer location for coordinate transformations
  const observerRef = useRef({
    latitude: 0,
    longitude: 0,
    lstHours: 0,
  });
  
  // Mouse control state
  const cameraControlRef = useRef({
    phi: Math.PI / 2, // Vertical angle (starts looking horizontal)
    theta: 0, // Horizontal angle
    isDragging: false,
    previousMousePosition: { x: 0, y: 0 },
    fov: 75, // Field of view for zoom control
  });

  useEffect(() => {
    const initScene = async () => {
      if (!containerRef.current) return;

      try {
        // Get user location
        const location = await getUserLocation();
        console.log('User location:', location);

        // Load star data
        const stars = await loadStarData();
        console.log(`Loaded ${stars.length} brightest stars`);
        
        // Populate available star names for search autocomplete
        setAvailableStarNames(stars.map(star => star.display_name));
        
        if (stars.length === 0) {
          console.error('No stars loaded!');
          return;
        }

        // Create scene
        const scene = new THREE.Scene();
        sceneRef.current = scene;

        // Set background to black space
        scene.background = new THREE.Color(0x000000);

        // Add ambient light so the ground is slightly visible
        const ambientLight = new THREE.AmbientLight(0x1a1a2e, 0.3);
        scene.add(ambientLight);

        // Create camera at the center (ground level perspective)
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        console.log(`Container size: ${width}x${height}`);
        
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 10000);
        camera.position.set(0, 0, 0); // Place camera at center (observer at ground)
        cameraRef.current = camera;

        // Create renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setClearColor(0x000000);
        containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Create stars with brightness based on magnitude
        const starGeometry = new THREE.BufferGeometry();
        const starPositions: number[] = [];
        const starSizes: number[] = [];
        const starColors: number[] = [];

        // Calculate Local Sidereal Time more accurately
        const now = new Date();
        const utcTime = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
        
        // Calculate Julian Day Number at 0h UT
        const year = now.getUTCFullYear();
        const month = now.getUTCMonth() + 1;
        const day = now.getUTCDate();
        let a = Math.floor((14 - month) / 12);
        let y = year + 4800 - a;
        let m = month + 12 * a - 3;
        const JDN = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
        const JD = JDN + (utcTime / 24);
        
        // Greenwich Mean Sidereal Time in seconds
        const T = (JD - 2451545.0) / 36525;
        const GMST_sec = 67310.54841 + (876600 * 3600 + 8640184.812866) * T + 0.093104 * T * T - 6.2e-6 * T * T * T;
        const GMST_hours = (GMST_sec / 3600) % 24;
        
        // Local Sidereal Time
        const longitude = location.longitude || 0;
        let lstHours = GMST_hours + longitude / 15;
        if (lstHours < 0) lstHours += 24;
        if (lstHours >= 24) lstHours -= 24;
        
        const latitude = location.latitude || 0;
        
        console.log(`Observer Location: lat=${latitude.toFixed(4)}°, lon=${longitude.toFixed(4)}°`);
        console.log(`Current Time (UTC): ${now.toUTCString()}`);
        console.log(`Julian Day: ${JD.toFixed(4)}`);
        console.log(`GMST: ${GMST_hours.toFixed(4)}h, LST: ${lstHours.toFixed(4)}h`);
        
        // Store observer location in ref for later use in handleSearchStar
        observerRef.current = { latitude, longitude, lstHours };

        stars.forEach((star, index) => {
          const [x, y, z] = celestialToCartesian(
            star.RAJ2000,
            star.DEJ2000,
            100,
            latitude,
            longitude,
            lstHours
          );
          starPositions.push(x, y, z);
          starsRef.current.set(index, star);
          starsByNameRef.current.set(star.display_name.toLowerCase(), star);
          
          // Debug: log first 5 stars with their positions and calculated angles
          if (index < 5) {
            // Recalculate to get intermediate values for debugging
            const raRad = (star.RAJ2000 * Math.PI) / 180;
            const decRad = (star.DEJ2000 * Math.PI) / 180;
            const latRad = (latitude * Math.PI) / 180;
            const lstRad = (lstHours * 15 * Math.PI) / 180;
            const hourAngle = lstRad - raRad;
            
            const sinAlt = Math.sin(decRad) * Math.sin(latRad) + 
                           Math.cos(decRad) * Math.cos(latRad) * Math.cos(hourAngle);
            const altitude = Math.asin(sinAlt);
            const altDeg = (altitude * 180) / Math.PI;
            
            const y_az = -Math.sin(hourAngle);
            const x_az = Math.tan(decRad) * Math.cos(latRad) - Math.sin(latRad) * Math.cos(hourAngle);
            let azimuth = Math.atan2(y_az, x_az);
            if (azimuth < 0) azimuth += 2 * Math.PI;
            const azDeg = (azimuth * 180) / Math.PI;
            
            console.log(`${star.display_name}: RA=${star.RAJ2000.toFixed(1)}°, Dec=${star.DEJ2000.toFixed(1)}°, HA=${(hourAngle*180/Math.PI).toFixed(1)}°, Alt=${altDeg.toFixed(1)}°, Az=${azDeg.toFixed(1)}° → Cartesian=(${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`);
          }
          
          // Calculate brightness based on magnitude (brighter = lower magnitude)
          // Extreme exponential curve for maximum contrast
          const brightness = Math.max(0.000001, Math.pow(1 - (star.Vmag / 8), 6)) * 400;
          // Size has moderate contrast
          const size = 0.5 + Math.sqrt(brightness) * 0.5;
          starSizes.push(size);
          starColors.push(Math.min(1, brightness), Math.min(1, brightness), Math.min(1, brightness));
        });

        console.log(`Created ${starPositions.length / 3} star positions`);
        console.log(`Observer location: lat=${latitude}, lon=${longitude}, LST=${lstHours}h`);

        starGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(starPositions), 3));
        starGeometry.setAttribute('size', new THREE.BufferAttribute(new Float32Array(starSizes), 1));
        starGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(starColors), 3));

        // Create a circular star texture
        const starCanvas = document.createElement('canvas');
        starCanvas.width = 64;
        starCanvas.height = 64;
        const starCtx = starCanvas.getContext('2d');
        if (starCtx) {
          starCtx.clearRect(0, 0, 64, 64);
          starCtx.fillStyle = 'white';
          starCtx.beginPath();
          starCtx.arc(32, 32, 32, 0, Math.PI * 2);
          starCtx.fill();
        }
        const starTexture = new THREE.CanvasTexture(starCanvas);

        const starMaterial = new THREE.PointsMaterial({
          map: starTexture,
          size: 0.1,
          sizeAttenuation: true,
          transparent: true,
          opacity: 0.9,
          vertexColors: true,
        });

        // Use custom shader to respect per-vertex sizes
        const starMaterial2 = new THREE.ShaderMaterial({
          uniforms: {
            map: { value: starTexture },
          },
          vertexShader: `
            attribute float size;
            attribute vec3 color;
            varying vec3 vColor;
            void main() {
              vColor = color;
              vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
              gl_PointSize = size * (300.0 / -mvPosition.z);
              gl_Position = projectionMatrix * mvPosition;
            }
          `,
          fragmentShader: `
            uniform sampler2D map;
            varying vec3 vColor;
            void main() {
              vec4 texColor = texture2D(map, gl_PointCoord);
              gl_FragColor = vec4(vColor * texColor.rgb, texColor.a);
            }
          `,
          blending: THREE.NormalBlending,
          depthTest: true,
          depthWrite: false,
          transparent: true,
        });

        const starMesh = new THREE.Points(starGeometry, starMaterial2);
        starMeshRef.current = starMesh;
        scene.add(starMesh);
        console.log('Stars added to scene');
        const groundGeometry = new THREE.CircleGeometry(200, 64);
        const groundMaterial = new THREE.MeshPhongMaterial({
          color: 0x1a1a2e,
          emissive: 0x0a0a1a,
          flatShading: false,
          side: THREE.BackSide,
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = Math.PI / 2; // Rotate to be horizontal
        ground.position.y = -0.5; // Position below the camera
        scene.add(ground);
        console.log('Ground added to scene');

        // Create directional indicators (N, S, E, W)
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.font = 'bold 120px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('N', 128, 128);
        }
        const northTexture = new THREE.CanvasTexture(canvas);
        const directionGeometry = new THREE.PlaneGeometry(15, 15);
        
        // Create N indicator
        const northSign = new THREE.Mesh(directionGeometry, new THREE.MeshBasicMaterial({ map: northTexture, transparent: true }));
        northSign.position.set(0, 8, -85);
        northSign.lookAt(camera.position);
        scene.add(northSign);
        
        // Create S indicator - South direction, raised above horizon
        const canvas2 = document.createElement('canvas');
        canvas2.width = 256;
        canvas2.height = 256;
        const ctx2 = canvas2.getContext('2d');
        if (ctx2) {
          ctx2.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx2.font = 'bold 120px Arial';
          ctx2.textAlign = 'center';
          ctx2.textBaseline = 'middle';
          ctx2.fillText('S', 128, 128);
        }
        const southTexture = new THREE.CanvasTexture(canvas2);
        const southSign = new THREE.Mesh(directionGeometry, new THREE.MeshBasicMaterial({ map: southTexture, transparent: true }));
        southSign.position.set(0, 8, 70);
        southSign.lookAt(camera.position);
        scene.add(southSign);
        
        // Create E indicator - East direction, raised above horizon
        const canvas3 = document.createElement('canvas');
        canvas3.width = 256;
        canvas3.height = 256;
        const ctx3 = canvas3.getContext('2d');
        if (ctx3) {
          ctx3.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx3.font = 'bold 120px Arial';
          ctx3.textAlign = 'center';
          ctx3.textBaseline = 'middle';
          ctx3.fillText('E', 128, 128);
        }
        const eastTexture = new THREE.CanvasTexture(canvas3);
        const eastSign = new THREE.Mesh(directionGeometry, new THREE.MeshBasicMaterial({ map: eastTexture, transparent: true }));
        eastSign.position.set(70, 8, 0);
        eastSign.lookAt(camera.position);
        scene.add(eastSign);
        
        // Create W indicator - West direction, raised above horizon
        const canvas4 = document.createElement('canvas');
        canvas4.width = 256;
        canvas4.height = 256;
        const ctx4 = canvas4.getContext('2d');
        if (ctx4) {
          ctx4.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx4.font = 'bold 120px Arial';
          ctx4.textAlign = 'center';
          ctx4.textBaseline = 'middle';
          ctx4.fillText('W', 128, 128);
        }
        const westTexture = new THREE.CanvasTexture(canvas4);
        const westSign = new THREE.Mesh(directionGeometry, new THREE.MeshBasicMaterial({ map: westTexture, transparent: true }));
        westSign.position.set(-70, 8, 0);
        westSign.lookAt(camera.position);
        scene.add(westSign);
        console.log('Directional indicators added to scene');

        // Handle window resize
        const handleResize = () => {
          const newWidth = containerRef.current?.clientWidth || width;
          const newHeight = containerRef.current?.clientHeight || height;
          camera.aspect = newWidth / newHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(newWidth, newHeight);
        };

        window.addEventListener('resize', handleResize);

        // Mouse controls for camera rotation
        const handleMouseDown = (event: MouseEvent) => {
          cameraControlRef.current.isDragging = true;
          cameraControlRef.current.previousMousePosition = { x: event.clientX, y: event.clientY };
        };

        const handleMouseMove = (event: MouseEvent) => {
          if (!containerRef.current) return;

          if (cameraControlRef.current.isDragging) {
            // Update camera angles based on mouse movement
            const deltaX = event.clientX - cameraControlRef.current.previousMousePosition.x;
            const deltaY = event.clientY - cameraControlRef.current.previousMousePosition.y;

            cameraControlRef.current.theta -= deltaX * 0.005; // Horizontal rotation
            cameraControlRef.current.phi -= deltaY * 0.005; // Vertical rotation

            // Clamp phi to prevent flipping
            cameraControlRef.current.phi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraControlRef.current.phi));

            cameraControlRef.current.previousMousePosition = { x: event.clientX, y: event.clientY };
          }

          // Hover detection for stars
          const rect = containerRef.current.getBoundingClientRect();
          mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

          if (starMeshRef.current && cameraRef.current) {
            raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
            const intersects = raycasterRef.current.intersectObject(starMeshRef.current);
            
            console.log('Hover check - intersects:', intersects.length, 'starMesh:', !!starMeshRef.current, 'camera:', !!cameraRef.current);

            if (intersects.length > 0) {
              const pointIndex = intersects[0].index;
              console.log('Found intersection at index:', pointIndex);
              if (pointIndex !== null && pointIndex !== undefined && starsRef.current.has(pointIndex)) {
                const star = starsRef.current.get(pointIndex);
                console.log('Setting hovered star:', star?.display_name);
                setHoveredStar(star || null);
              }
            } else {
              setHoveredStar(null);
            }
          } else {
            console.log('Hover detection skipped - starMesh:', !!starMeshRef.current, 'camera:', !!cameraRef.current);
          }
        };

        const handleMouseUp = () => {
          cameraControlRef.current.isDragging = false;
        };

        const handleWheel = (event: WheelEvent) => {
          event.preventDefault();
          const zoomSpeed = 2;
          if (event.deltaY < 0) {
            // Scroll up - zoom in
            cameraControlRef.current.fov = Math.max(5, cameraControlRef.current.fov - zoomSpeed);
          } else {
            // Scroll down - zoom out
            cameraControlRef.current.fov = Math.min(120, cameraControlRef.current.fov + zoomSpeed);
          }
          if (cameraRef.current) {
            cameraRef.current.fov = cameraControlRef.current.fov;
            cameraRef.current.updateProjectionMatrix();
          }
        };

        containerRef.current.addEventListener('mousedown', handleMouseDown);
        containerRef.current.addEventListener('mousemove', handleMouseMove);
        containerRef.current.addEventListener('mouseup', handleMouseUp);
        containerRef.current.addEventListener('mouseleave', handleMouseUp);
        containerRef.current.addEventListener('wheel', handleWheel, { passive: false });

        // Animation loop
        const animate = () => {
          requestAnimationFrame(animate);

          // Update camera position based on spherical coordinates
          const phi = cameraControlRef.current.phi;
          const theta = cameraControlRef.current.theta;

          // Calculate the direction vector to look at
          // The star sphere is at distance 100, with:
          // X-axis = North, Y-axis = Up, Z-axis = East
          // theta = 0 should look North (positive X)
          // theta = π/2 should look East (positive Z)
          // phi = π/2 should look horizontal
          // phi = 0 should look straight up (zenith)
          const lookAtPoint = new THREE.Vector3(
            100 * Math.sin(phi) * Math.cos(theta),  // North component (theta=0)
            100 * Math.cos(phi),                      // Up component (phi=π/2 means horizontal)
            100 * Math.sin(phi) * Math.sin(theta)    // East component (theta=π/2)
          );

          if (cameraRef.current) {
            cameraRef.current.position.set(0, 0, 0);
            cameraRef.current.lookAt(lookAtPoint);
          }

          renderer.render(scene, cameraRef.current!);
        };

        console.log('Starting animation loop');
        animate();

        // Cleanup
        return () => {
          window.removeEventListener('resize', handleResize);
          containerRef.current?.removeEventListener('mousedown', handleMouseDown);
          containerRef.current?.removeEventListener('mousemove', handleMouseMove);
          containerRef.current?.removeEventListener('mouseup', handleMouseUp);
          containerRef.current?.removeEventListener('mouseleave', handleMouseUp);
          containerRef.current?.removeEventListener('wheel', handleWheel);
          renderer.dispose();
          starGeometry.dispose();
          starMaterial2.dispose();
          groundGeometry.dispose();
          groundMaterial.dispose();
        };
      } catch (error) {
        console.error('Error initializing scene:', error);
      }
    };

    initScene();
  }, []);

  const handleSearchStar = (searchName: string) => {
    const star = starsByNameRef.current.get(searchName.toLowerCase());
    if (star && cameraControlRef.current && cameraRef.current) {
      // Calculate the camera angles needed to look at this star
      const observer = observerRef.current;
      const [x, y, z] = celestialToCartesian(
        star.RAJ2000,
        star.DEJ2000,
        100,
        observer.latitude,
        observer.longitude,
        observer.lstHours
      );
      
      // Calculate spherical coordinates from the star position
      // theta: horizontal angle (azimuth)
      // phi: vertical angle from top
      const theta = Math.atan2(z, x);
      const phi = Math.acos(y / 100); // y is already the height component at distance 100
      
      cameraControlRef.current.theta = theta;
      cameraControlRef.current.phi = phi;
      
      // Zoom in on the star (set FOV to 30)
      cameraControlRef.current.fov = 30;
      cameraRef.current.fov = 30;
      cameraRef.current.updateProjectionMatrix();
      
      // Store searched star in ref instead of state so hover can still work
      searchedStarRef.current = star;
      // DON'T set hovered star here - let hover detection handle it naturally
      // setHoveredStar(star);
      onSearchStar?.(star);
      console.log(`Found and navigating to ${star.display_name}`);
    } else {
      console.log(`Star "${searchName}" not found`);
      // Don't clear hoveredStar if search fails - let current hover state remain
      onSearchStar?.(null);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-black overflow-hidden">
      <div ref={containerRef} className="flex-1" style={{ overflow: 'hidden' }} />
      <StarSearch onSearch={handleSearchStar} availableStars={availableStarNames} />
      {hoveredStar && (
        <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 text-white p-3 rounded border border-blue-500">
          <p className="text-lg font-semibold">{hoveredStar.display_name}</p>
          <p className="text-sm text-gray-300">Magnitude: {hoveredStar.Vmag.toFixed(2)}</p>
          <p className="text-sm text-gray-300">RA: {hoveredStar.RAJ2000.toFixed(2)}°</p>
          <p className="text-sm text-gray-300">Dec: {hoveredStar.DEJ2000.toFixed(2)}°</p>
        </div>
      )}
    </div>
  );
}
