import * as THREE from 'three';
import { type Star, magnitudeToSize } from '../../utils/starDataLoader';
import { calculateAltAz } from '../../utils/astroUtils';
import { altAzToCartesian } from './utils';

export function createStarField(
    stars: Star[],
    observerCoords: { lat: number; lon: number },
    now: Date,
    starsRef: React.MutableRefObject<Map<number, Star>>,
    starAltAzRef: React.MutableRefObject<Map<number, { altitude: number; azimuth: number; }>>
): { starMesh: THREE.Points; starGlowMesh: THREE.Points; } {

    const starGeometry = new THREE.BufferGeometry();
    const starPositions: number[] = [];
    const starSizes: number[] = [];
    const starColors: number[] = [];

    let minMag = Infinity;
    let maxMag = -Infinity;
    stars.forEach(star => {
        if (star.Vmag < minMag) minMag = star.Vmag;
        if (star.Vmag > maxMag) maxMag = star.Vmag;
    });
    const magRange = maxMag - minMag;

    let visibleStarIndex = 0;
    stars.forEach((star) => {
        const altAz = calculateAltAz(
            { ra: star.RAJ2000, dec: star.DEJ2000 },
            observerCoords,
            now
        );

        if (altAz.altitude <= 0) {
            return;
        }

        const { x, y, z } = altAzToCartesian(altAz.altitude, altAz.azimuth, 100);

        starPositions.push(x, y, z);
        starsRef.current.set(visibleStarIndex, star);
        starAltAzRef.current.set(visibleStarIndex, altAz);

        const normalizedMag = (star.Vmag - minMag) / magRange;
        const brightness = 0.4 + Math.pow(1 - normalizedMag, 2.0) * 0.6;
        const size = magnitudeToSize(star.Vmag);
        starSizes.push(size);
        starColors.push(Math.min(1, brightness), Math.min(1, brightness), Math.min(1, brightness));

        visibleStarIndex++;
    });

    starGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(starPositions), 3));
    starGeometry.setAttribute('size', new THREE.BufferAttribute(new Float32Array(starSizes), 1));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(starColors), 3));

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

    const starMaterial = new THREE.ShaderMaterial({
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
        gl_PointSize = size * (1000.0 / -mvPosition.z);
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
        depthWrite: true,
        transparent: true,
    });

    const starMesh = new THREE.Points(starGeometry, starMaterial);

    const starGlowMaterial = new THREE.ShaderMaterial({
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
        gl_PointSize = size * sqrt(size) * 3.5 * (1000.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
        fragmentShader: `
      varying vec3 vColor;
      void main() {
        float dist = distance(gl_PointCoord, vec2(0.5));
        float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
        gl_FragColor = vec4(vColor, alpha * 0.35);
      }
    `,
        blending: THREE.AdditiveBlending,
        depthTest: true,
        depthWrite: false,
        transparent: true,
    });
    const starGlowMesh = new THREE.Points(starGeometry, starGlowMaterial);

    return { starMesh, starGlowMesh };
}
