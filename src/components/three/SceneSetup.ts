import * as THREE from 'three';

export function createSkySphere(): THREE.Mesh {
    const skyGeometry = new THREE.SphereGeometry(500, 32, 16);
    const skyPositions = skyGeometry.attributes.position;
    const skyColors = [];
    const colorTop = new THREE.Color(0x05040f); // Very Dark Indigo/Almost Black
    const colorBottom = new THREE.Color(0x1a1833); // Darker Indigo for horizon

    for (let i = 0; i < skyPositions.count; i++) {
        const vertex = new THREE.Vector3().fromBufferAttribute(skyPositions, i);
        const t = (vertex.y + 500) / 1000;
        const blendedColor = colorBottom.clone().lerp(colorTop, t);
        skyColors.push(blendedColor.r, blendedColor.g, blendedColor.b);
    }
    skyGeometry.setAttribute('color', new THREE.Float32BufferAttribute(skyColors, 3));

    const skyMaterial = new THREE.MeshBasicMaterial({
        side: THREE.BackSide,
        vertexColors: true,
    });
    const skySphere = new THREE.Mesh(skyGeometry, skyMaterial);
    skySphere.rotation.y = Math.PI / 2;
    return skySphere;
}

export function createGround(): THREE.Mesh {
    const grassCanvas = document.createElement('canvas');
    const canvasSize = 512;
    grassCanvas.width = canvasSize;
    grassCanvas.height = canvasSize;
    const grassCtx = grassCanvas.getContext('2d');
    if (grassCtx) {
        grassCtx.fillStyle = '#002a00';
        grassCtx.fillRect(0, 0, canvasSize, canvasSize);
        for (let i = 0; i < 40000; i++) {
            const x = Math.random() * canvasSize;
            const y = Math.random() * canvasSize;
            const height = Math.random() * 10 + 5;
            const width = Math.random() * 1.5 + 0.5;
            const greenShade = Math.floor(Math.random() * 50 + 40);
            grassCtx.fillStyle = Math.random() < 0.05 ? `rgb(${greenShade + 20}, ${greenShade + 10}, 10)` : `rgb(0, ${greenShade}, 0)`;
            grassCtx.fillRect(x, y, width, height);
        }
    }
    const grassTexture = new THREE.CanvasTexture(grassCanvas);
    grassTexture.wrapS = THREE.RepeatWrapping;
    grassTexture.wrapT = THREE.RepeatWrapping;
    grassTexture.repeat.set(16, 16);

    const groundGeometry = new THREE.CircleGeometry(200, 64);
    const groundMaterial = new THREE.MeshPhongMaterial({
        map: grassTexture,
        side: THREE.DoubleSide,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    return ground;
}

function createDirectionalMarker(text: string, position: [number, number, number], cameraPosition: THREE.Vector3): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = 'bold 120px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 128, 128);
    }
    const texture = new THREE.CanvasTexture(canvas);
    const geometry = new THREE.PlaneGeometry(15, 15);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.5 });
    const marker = new THREE.Mesh(geometry, material);
    marker.position.set(...position);
    marker.lookAt(cameraPosition);
    return marker;
}

export function createDirectionalMarkers(camera: THREE.Camera): THREE.Group {
    const group = new THREE.Group();
    group.add(createDirectionalMarker('N', [0, 8, -85], camera.position));
    group.add(createDirectionalMarker('S', [0, 8, 70], camera.position));
    group.add(createDirectionalMarker('E', [70, 8, 0], camera.position));
    group.add(createDirectionalMarker('W', [-70, 8, 0], camera.position));
    return group;
}
