import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { loadStarData, celestialToCartesian, magnitudeToSize, type Star } from '../utils/starDataLoader';
import { getUserLocation } from '../utils/geolocation';

export function SkyViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const starsRef = useRef<Map<number, Star>>(new Map());
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const [hoveredStar, setHoveredStar] = useState<Star | null>(null);
  
  // Mouse control state
  const cameraControlRef = useRef({
    phi: Math.PI / 2, // Vertical angle (starts looking horizontal)
    theta: 0, // Horizontal angle
    isDragging: false,
    previousMousePosition: { x: 0, y: 0 },
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

        stars.forEach((star, index) => {
          const [x, y, z] = celestialToCartesian(star.RAJ2000, star.DEJ2000, 100);
          starPositions.push(x, y, z);
          starsRef.current.set(index, star);
          
          // Calculate brightness based on magnitude (brighter = lower magnitude)
          // Extreme exponential curve for maximum contrast
          const brightness = Math.max(0.000001, Math.pow(1 - (star.Vmag / 8), 6)) * 400;
          // Size has moderate contrast
          const size = 0.5 + Math.sqrt(brightness) * 0.5;
          starSizes.push(size);
          starColors.push(Math.min(1, brightness), Math.min(1, brightness), Math.min(1, brightness));
        });

        console.log(`Created ${starPositions.length / 3} star positions`);

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

          raycasterRef.current.setFromCamera(mouseRef.current, camera);
          const intersects = raycasterRef.current.intersectObject(starMesh);

          if (intersects.length > 0) {
            const pointIndex = intersects[0].index;
            if (pointIndex !== null && pointIndex !== undefined && starsRef.current.has(pointIndex)) {
              setHoveredStar(starsRef.current.get(pointIndex) || null);
            }
          } else {
            setHoveredStar(null);
          }
        };

        const handleMouseUp = () => {
          cameraControlRef.current.isDragging = false;
        };

        containerRef.current.addEventListener('mousedown', handleMouseDown);
        containerRef.current.addEventListener('mousemove', handleMouseMove);
        containerRef.current.addEventListener('mouseup', handleMouseUp);
        containerRef.current.addEventListener('mouseleave', handleMouseUp);

        // Animation loop
        const animate = () => {
          requestAnimationFrame(animate);

          // Update camera position based on spherical coordinates
          const phi = cameraControlRef.current.phi;
          const theta = cameraControlRef.current.theta;

          // Update camera direction (looking outward from center)
          const direction = new THREE.Vector3(
            Math.sin(phi) * Math.sin(theta),
            Math.cos(phi),
            Math.sin(phi) * Math.cos(theta)
          );

          camera.position.set(0, 0, 0);
          camera.lookAt(direction);

          renderer.render(scene, camera);
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

  return (
    <div className="w-full h-full flex flex-col bg-black overflow-hidden">
      <div ref={containerRef} className="flex-1" style={{ overflow: 'hidden' }} />
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
