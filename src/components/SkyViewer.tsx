import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { loadStarData, magnitudeToSize, type Star } from '../utils/starDataLoader';
import { getUserLocation, type UserLocation } from '../utils/geolocation';
import { calculateAltAz } from '../utils/astroUtils';

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
 * Converts horizontal coordinates (Altitude/Azimuth) to Cartesian for Three.js.
 * Assumes an ENU (East-North-Up) to Three.js coordinate system mapping.
 * @param alt - Altitude in degrees.
 * @param az - Azimuth in degrees.
 * @param radius - The distance from the origin.
 * @returns A 3D vector {x, y, z}.
 */
function altAzToCartesian(alt: number, az: number, radius: number): { x: number; y: number; z: number } {
  const altRad = (alt * Math.PI) / 180;
  const azRad = (az * Math.PI) / 180;

  // Convert Alt/Az to ENU (East-North-Up)
  // x = cos(Alt) * sin(Az)  (East)
  // y = sin(Alt)            (Up)
  // z = cos(Alt) * cos(Az)  (North)
  const x_enu = radius * Math.cos(altRad) * Math.sin(azRad);
  const y_enu = radius * Math.sin(altRad);
  const z_enu = radius * Math.cos(altRad) * Math.cos(azRad);

  // Convert ENU to Three.js world coordinates: east→x, up→y, north→−z
  const x = x_enu;
  const y = y_enu;
  const z = -z_enu;
  return { x, y, z };
}

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

  // Expose searchForStar method through ref
  useImperativeHandle(ref, () => ({
    searchForStar: (starName: string) => {
      const star = starsByNameRef.current.get(starName.toLowerCase());
      if (star && cameraRef.current && observerRef.current) {
        const altAz = calculateAltAz(
          { ra: star.RAJ2000, dec: star.DEJ2000 },
          { lat: observerRef.current.latitude, lon: observerRef.current.longitude },
          new Date()
        );
        
        // Calculate spherical coordinates from the star's Alt/Az
        const altRad = (altAz.altitude * Math.PI) / 180;
        const azRad = (altAz.azimuth * Math.PI) / 180;

        // phi is the vertical angle from zenith (Up), theta is horizontal from North
        cameraControlRef.current.phi = Math.PI / 2 - altRad; // 90 degrees - altitude
        cameraControlRef.current.theta = azRad;
        
        // Zoom in on the star
        cameraControlRef.current.fov = 30;
        cameraRef.current.fov = 30;
        cameraRef.current.updateProjectionMatrix();
        
        console.log(`Navigating to ${star.display_name}`);
      }
    }
  }), []);

  useEffect(() => {
    const initScene = async () => {
      if (!containerRef.current) return;

      try {
        // Get user location
        const location: UserLocation = await getUserLocation();
        console.log('User location:', location);

        // Load star data
        const stars = await loadStarData();
        console.log(`Loaded ${stars.length} brightest stars`);
        
        // Pass available star names to parent component
        onStarDataLoaded?.(stars.map(star => star.display_name));
        
        if (stars.length === 0) {
          console.error('No stars loaded!');
          return;
        }

        // Create scene
        const scene = new THREE.Scene();
        sceneRef.current = scene;

        // Create a gradient sky sphere
        const skyGeometry = new THREE.SphereGeometry(500, 32, 16);
        const skyPositions = skyGeometry.attributes.position;
        const skyColors = [];
        const colorTop = new THREE.Color(0x05040f); // Very Dark Indigo/Almost Black
        const colorBottom = new THREE.Color(0x1a1833); // Darker Indigo for horizon

        for (let i = 0; i < skyPositions.count; i++) {
          const vertex = new THREE.Vector3().fromBufferAttribute(skyPositions, i);
          // Normalize y-coordinate to a 0-1 range (bottom to top)
          const t = (vertex.y + 500) / 1000;
          const blendedColor = colorBottom.clone().lerp(colorTop, t);
          skyColors.push(blendedColor.r, blendedColor.g, blendedColor.b);
        }
        skyGeometry.setAttribute('color', new THREE.Float32BufferAttribute(skyColors, 3));

        const skyMaterial = new THREE.MeshBasicMaterial({
          side: THREE.BackSide, // Render the inside of the sphere
          vertexColors: true,
        });
        const skySphere = new THREE.Mesh(skyGeometry, skyMaterial);
        skySphere.rotation.y = Math.PI / 2; // Rotate to hide the texture seam from E-W axis
        scene.add(skySphere);

        // Use a HemisphereLight for more natural outdoor ambient lighting.
        // Sky color, ground color, intensity
        const hemisphereLight = new THREE.HemisphereLight(0x404060, 0x104010, 1.0);
        scene.add(hemisphereLight);

        // Create a procedural grass texture for a more realistic ground
        const grassCanvas = document.createElement('canvas');
        const canvasSize = 512;
        grassCanvas.width = canvasSize;
        grassCanvas.height = canvasSize;
        const grassCtx = grassCanvas.getContext('2d');
        if (grassCtx) {
          // Base color for soil/dark grass
          grassCtx.fillStyle = '#002a00';
          grassCtx.fillRect(0, 0, canvasSize, canvasSize);

          // Add thousands of small "blades" of grass with color variation
          for (let i = 0; i < 40000; i++) {
            const x = Math.random() * canvasSize;
            const y = Math.random() * canvasSize;
            const height = Math.random() * 10 + 5;
            const width = Math.random() * 1.5 + 0.5;
            // Varying shades of green, with a small chance of brown/yellow
            const greenShade = Math.floor(Math.random() * 50 + 40);
            grassCtx.fillStyle = Math.random() < 0.05 ? `rgb(${greenShade + 20}, ${greenShade + 10}, 10)` : `rgb(0, ${greenShade}, 0)`;
            grassCtx.fillRect(x, y, width, height);
          }
        }
        const grassTexture = new THREE.CanvasTexture(grassCanvas);
        grassTexture.wrapS = THREE.RepeatWrapping;
        grassTexture.wrapT = THREE.RepeatWrapping;
        grassTexture.repeat.set(16, 16); // Repeat the texture across the ground

        const groundGeometry = new THREE.CircleGeometry(200, 64);
        const groundMaterial = new THREE.MeshPhongMaterial({
          map: grassTexture, // Apply the procedural grass texture
          side: THREE.DoubleSide,
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2; // Rotate to be horizontal
        ground.position.y = -0.5; // Position below the camera
        scene.add(ground);
        console.log('Textured ground added to scene');

        // Create camera at the center (ground level perspective)
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        console.log(`Container size: ${width}x${height}`);
        
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 10000);
        camera.position.set(0, 1.6, 0); // Place camera at an average eye-level height
        cameraRef.current = camera;

        // Create renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Create stars with brightness based on magnitude
        const starGeometry = new THREE.BufferGeometry();
        const starPositions: number[] = [];
        const starSizes: number[] = [];
        const starColors: number[] = [];

        // Get current time and observer location
        const now = new Date();
        const latitude = location.latitude || 0;
        const longitude = location.longitude || 0;
        const observerCoords = { lat: latitude, lon: longitude };

        // Calculate LST once for all stars. We can get it from the first star calculation.
        let lstHours = 0;
        if (stars.length > 0) {
          const firstStarAltAz = calculateAltAz(
            { ra: stars[0].RAJ2000, dec: stars[0].DEJ2000 },
            observerCoords,
            now
          );
          lstHours = firstStarAltAz.lst;
        }

        console.log(`Observer Location: lat=${latitude.toFixed(4)}°, lon=${longitude.toFixed(4)}°`);
        console.log(`Current Time (UTC): ${now.toUTCString()}`);
        console.log(`LST: ${lstHours.toFixed(6)}h`);
        
        // Store observer location in ref for later use in handleSearchStar
        observerRef.current = { latitude, longitude, lstHours };

        // Find min and max magnitude from the loaded stars for brightness normalization
        let minMag = Infinity;
        let maxMag = -Infinity;
        stars.forEach(star => {
          if (star.Vmag < minMag) minMag = star.Vmag;
          if (star.Vmag > maxMag) maxMag = star.Vmag;
        });
        const magRange = maxMag - minMag;
        console.log(`Magnitude range for brightness scaling: ${minMag.toFixed(2)} to ${maxMag.toFixed(2)}`);

        let visibleStarIndex = 0;
        stars.forEach((star, index) => {
          // Calculate Alt/Az using the new high-precision function
          const altAz = calculateAltAz(
            { ra: star.RAJ2000, dec: star.DEJ2000 },
            observerCoords,
            now
          );

          // Only display stars that are completely above the horizon (altitude > 0)
          if (altAz.altitude <= 0) {
            return; // Skip stars below or on the horizon
          }

          // Convert Alt/Az to Cartesian coordinates for rendering
          const { x, y, z } = altAzToCartesian(altAz.altitude, altAz.azimuth, 100);

          starPositions.push(x, y, z);
          starsRef.current.set(visibleStarIndex, star);
          starsByNameRef.current.set(star.display_name.toLowerCase(), star);
          
          starAltAzRef.current.set(visibleStarIndex, altAz);
          
          // Debug: log first 5 visible stars with their positions and calculated angles
          if (visibleStarIndex < 5) {
            console.log(`${star.display_name}: RA=${star.RAJ2000.toFixed(1)}°, Dec=${star.DEJ2000.toFixed(1)}°, Alt=${altAz.altitude.toFixed(1)}°, Az=${altAz.azimuth.toFixed(1)}° → Cartesian=(${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`);
          }
          
          // Calculate brightness based on magnitude (brighter = lower magnitude)
          // Extreme exponential curve for maximum contrast
          // Normalize magnitude and use a power curve for better control over brightness range.
          const normalizedMag = (star.Vmag - minMag) / magRange; // 0 for brightest, 1 for dimmest
          const brightness = 0.4 + Math.pow(1 - normalizedMag, 2.0) * 0.6; // Ensure min brightness is 0.4
          const size = magnitudeToSize(star.Vmag); // Use utility for consistent sizing
          starSizes.push(size);
          starColors.push(Math.min(1, brightness), Math.min(1, brightness), Math.min(1, brightness));
          
          visibleStarIndex++;
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
              // Using (size * size) increases the contrast, making bright stars much larger than dim ones.
              gl_PointSize = size * (1500.0 / -mvPosition.z);
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
          depthWrite: true, // Write depth for core stars to be occluded correctly
          transparent: true,
        });

        const starMesh = new THREE.Points(starGeometry, starMaterial2);
        // Create a material for the star glow
        const starGlowMaterial = new THREE.ShaderMaterial({
          uniforms: {
            map: { value: starTexture }, // Use the same circular texture
          },
          vertexShader: `
            attribute float size;
            attribute vec3 color;
            varying vec3 vColor;
            void main() {
              vColor = color;
              vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
              // Increased multipliers to make the glow larger and more prominent.
              gl_PointSize = size * sqrt(size) * 3.5 * (1500.0 / -mvPosition.z);
              gl_Position = projectionMatrix * mvPosition;
            }
          `,
          fragmentShader: `
            varying vec3 vColor;
            void main() {
              // Create a soft, procedural glow that fades out from the center.
              float dist = distance(gl_PointCoord, vec2(0.5));
              float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
              gl_FragColor = vec4(vColor, alpha * 0.35); // Adjust 0.35 for desired glow intensity
            }
          `,
          blending: THREE.AdditiveBlending, // Crucial for glow effect
          depthTest: true, // Test against depth buffer to be occluded by ground/other stars
          depthWrite: false, // Don't write to depth buffer for glow
          transparent: true,
        });
        const starGlowMesh = new THREE.Points(starGeometry, starGlowMaterial);
        scene.add(starGlowMesh); // Add glow mesh first
        starMeshRef.current = starMesh;
        scene.add(starMesh);

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
        const northSign = new THREE.Mesh(directionGeometry, new THREE.MeshBasicMaterial({ map: northTexture, transparent: true, alphaTest: 0.5 }));
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
        const southSign = new THREE.Mesh(directionGeometry, new THREE.MeshBasicMaterial({ map: southTexture, transparent: true, alphaTest: 0.5 }));
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
        const eastSign = new THREE.Mesh(directionGeometry, new THREE.MeshBasicMaterial({ map: eastTexture, transparent: true, alphaTest: 0.5 }));
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
        const westSign = new THREE.Mesh(directionGeometry, new THREE.MeshBasicMaterial({ map: westTexture, transparent: true, alphaTest: 0.5 }));
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
                const altAz = starAltAzRef.current.get(pointIndex);
                console.log('Setting hovered star:', star?.display_name);
                setHoveredStar(star || null);
                setHoveredStarAltAz(altAz || null);
              }
            } else {
              setHoveredStar(null);
              setHoveredStarAltAz(null);
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
          // In ENU system: x=East, y=Up, z=-North
          // We want theta=0 to look North (negative z), theta=π/2 to look East (positive x)
          const phi = cameraControlRef.current.phi;
          const theta = cameraControlRef.current.theta;

          // Calculate the direction vector to look at
          // phi: 0 = zenith, π/2 = horizon, π = nadir
          // theta: 0 = North, π/2 = East, π = South, 3π/2 = West
          const lookAtPoint = new THREE.Vector3(
            100 * Math.sin(phi) * Math.sin(theta),     // East component (theta=π/2)
            100 * Math.cos(phi),                         // Up component (phi=0)
            -100 * Math.sin(phi) * Math.cos(theta)      // Negative North (theta=0)
          );

          if (cameraRef.current) {
            cameraRef.current.position.set(0, 1.6, 0);
            cameraRef.current.lookAt(lookAtPoint.add(cameraRef.current.position));
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
          skyGeometry.dispose();
          starGeometry.dispose();
          starGlowMaterial.dispose(); // Dispose the new material
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

  // Effect to handle searching for a star when the prop changes
  useEffect(() => {
    if (searchedStarName) {
      const star = starsByNameRef.current.get(searchedStarName.toLowerCase());
      if (star && cameraControlRef.current && cameraRef.current) {
        // Calculate the camera angles needed to look at this star
        const observer = observerRef.current;
        const altAz = calculateAltAz(
          { ra: star.RAJ2000, dec: star.DEJ2000 },
          { lat: observer.latitude, lon: observer.longitude },
          new Date()
        );
        
        // Calculate spherical coordinates from the star's Alt/Az
        const altRad = (altAz.altitude * Math.PI) / 180;
        const azRad = (altAz.azimuth * Math.PI) / 180;

        // phi is the vertical angle from zenith (Up), theta is horizontal from North
        cameraControlRef.current.phi = Math.PI / 2 - altRad; // 90 degrees - altitude
        cameraControlRef.current.theta = azRad;
        
        // Zoom in on the star
        cameraControlRef.current.fov = 30;
        cameraRef.current.fov = 30;
        cameraRef.current.updateProjectionMatrix();
        
        console.log(`Navigating to ${star.display_name}`);
      }
    }
  }, [searchedStarName]);

  return (
    <div className="w-full h-full flex flex-col bg-black overflow-hidden">
      <div ref={containerRef} className="flex-1 relative" style={{ overflow: 'hidden' }}></div>
      {hoveredStar && (
        <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 text-white p-3 rounded border border-blue-500">
          <p className="text-lg font-semibold">{hoveredStar.display_name}</p>
          <p className="text-sm text-gray-300">Magnitude: {hoveredStar.Vmag.toFixed(2)}</p>
          <p className="text-sm text-gray-300">RA: {hoveredStar.RAJ2000.toFixed(2)}°</p>
          <p className="text-sm text-gray-300">Dec: {hoveredStar.DEJ2000.toFixed(2)}°</p>
          {hoveredStarAltAz && (
            <>
              <p className="text-sm text-gray-300">Alt: {hoveredStarAltAz.altitude.toFixed(2)}°</p>
              <p className="text-sm text-gray-300">Az: {hoveredStarAltAz.azimuth.toFixed(2)}°</p>
            </>
          )}
        </div>
      )}
    </div>
  );
});