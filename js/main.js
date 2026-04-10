// js/main.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadTLE, getPositionData, getOrbitPath } from './iss.js';
import { updateTelemetry, hideLoading, setupUI } from './ui.js';

const SCALE = 1 / 1000;
const EARTH_RADIUS = 6371 * SCALE; 
let isFollowing = true;
let timeOffsetMins = 0;

// --- ECI to Three Coordinates ---
// ECI X -> Three X
// ECI Y -> Three -Z
// ECI Z -> Three Y
function eciToThree(eci) {
    return new THREE.Vector3(eci.x * SCALE, eci.z * SCALE, -eci.y * SCALE);
}

// --- Scene Setup ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
// Initial camera position
camera.position.set(EARTH_RADIUS * 2, EARTH_RADIUS, EARTH_RADIUS * 2);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 0.02; // Extended zoom for close-up
controls.maxDistance = EARTH_RADIUS * 20;

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

// Sun (Directional Light)
const sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
sunLight.position.set(50, 20, 30);
scene.add(sunLight);

// Earth Shine (Subtle blue light reflecting back from the planet)
const earthShine = new THREE.DirectionalLight(0x38bdf8, 0.4);
earthShine.position.set(0, -1, 0); // Pointing roughly "up" from the earth surface
scene.add(earthShine);

// --- Environment Map for Reflections ---
const cubeLoader = new THREE.CubeTextureLoader();
// Using a generic high-quality space cubemap
const envMap = cubeLoader.load([
    'https://unpkg.com/three-globe/example/img/night-sky.png',
    'https://unpkg.com/three-globe/example/img/night-sky.png',
    'https://unpkg.com/three-globe/example/img/night-sky.png',
    'https://unpkg.com/three-globe/example/img/night-sky.png',
    'https://unpkg.com/three-globe/example/img/night-sky.png',
    'https://unpkg.com/three-globe/example/img/night-sky.png',
]);
scene.environment = envMap;
// --- Earth Model ---
const textureLoader = new THREE.TextureLoader();
const earthGroup = new THREE.Group();
scene.add(earthGroup);

const earthMat = new THREE.MeshPhongMaterial({
    map: textureLoader.load('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg'),
    bumpMap: textureLoader.load('https://unpkg.com/three-globe/example/img/earth-topology.png'),
    bumpScale: 0.05,
    specularMap: textureLoader.load('https://unpkg.com/three-globe/example/img/earth-water.png'),
    specular: new THREE.Color('grey'),
    shininess: 10
});
const earthRadius = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);
const earthMesh = new THREE.Mesh(earthRadius, earthMat);
earthGroup.add(earthMesh);

// Cloud Layer
const cloudMat = new THREE.MeshPhongMaterial({
    map: textureLoader.load('https://unpkg.com/three-globe/example/img/earth-clouds.png'),
    transparent: true,
    opacity: 0.4
});
const cloudMesh = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS * 1.01, 64, 64), cloudMat);
earthGroup.add(cloudMesh);

// Atmosphere Glow
const atmosMat = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.15,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide
});
const atmosMesh = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS * 1.1, 64, 64), atmosMat);
earthGroup.add(atmosMesh);

// --- Starfield ---
const starsGeom = new THREE.BufferGeometry();
const starsCount = 3000;
const posArray = new Float32Array(starsCount * 3);
for(let i = 0; i < starsCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 200;
}
starsGeom.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const starsMat = new THREE.PointsMaterial({ size: 0.05, color: 0xffffff, transparent: true, opacity: 0.8 });
const starMesh = new THREE.Points(starsGeom, starsMat);
scene.add(starMesh);

// --- Helper: Create Glow Texture ---
function createGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 200, 0, 1)');
    gradient.addColorStop(0.2, 'rgba(255, 150, 0, 0.8)');
    gradient.addColorStop(0.5, 'rgba(255, 100, 0, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 50, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
}

// --- Helper: Create Primitive ISS ---
function createPrimitiveISS() {
    const group = new THREE.Group();
    
    // Central Module (Cylinder)
    const moduleMat = new THREE.MeshPhongMaterial({ color: 0x94a3b8 });
    const module = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.08, 16), moduleMat);
    module.rotation.z = Math.PI / 2;
    group.add(module);
    
    // Solar Panel Arrays (8 long boxes)
    const panelMat = new THREE.MeshPhongMaterial({ color: 0x0ea5e9, emissive: 0x075985, emissiveIntensity: 0.5 });
    const panelGeom = new THREE.BoxGeometry(0.08, 0.002, 0.02);
    
    for (let i = 0; i < 4; i++) {
        const p1 = new THREE.Mesh(panelGeom, panelMat);
        p1.position.set((i - 1.5) * 0.02, 0.015, 0);
        group.add(p1);
        
        const p2 = new THREE.Mesh(panelGeom, panelMat);
        p2.position.set((i - 1.5) * 0.02, -0.015, 0);
        group.add(p2);
    }
    
    return group;
}

// --- Helper: Create Text Texture ---
function createTextTexture(text) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 128;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.font = 'bold 36px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Glowing text effect
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(text, 256, 64);
    
    return new THREE.CanvasTexture(canvas);
}

// --- ISS Assets ---
const issGroup = new THREE.Group();
scene.add(issGroup);

// Floating Label
const labelMat = new THREE.SpriteMaterial({ 
    map: createTextTexture('INTERNATIONAL SPACE STATION'),
    transparent: true,
    depthTest: false
});
const labelSprite = new THREE.Sprite(labelMat);
labelSprite.position.set(0, 0.08, 0); // Above the station
labelSprite.scale.set(0.25, 0.06, 1);
issGroup.add(labelSprite);

// --- Helper: Create Nav Light ---
function createNavLight(color) {
    const light = new THREE.PointLight(color, 2, 0.5);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: createGlowTexture(),
        color: color,
        transparent: true,
        blending: THREE.AdditiveBlending
    }));
    sprite.scale.set(0.02, 0.02, 1);
    light.add(sprite);
    return light;
}

const navLights = new THREE.Group();
const strobeR = createNavLight(0xff0000); // Red
const strobeW = createNavLight(0xffffff); // White
strobeR.position.set(0.04, 0, 0);
strobeW.position.set(-0.04, 0, 0);
navLights.add(strobeR);
navLights.add(strobeW);
// Initial Primitive Model (shows instantly)
const primitiveISS = createPrimitiveISS();
issGroup.add(primitiveISS);

issGroup.add(navLights);

// Always-visible Glow Sprite (for far away)
const glowMat = new THREE.SpriteMaterial({ 
    map: createGlowTexture(), 
    color: 0xffffff,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false
});
const glowSprite = new THREE.Sprite(glowMat);
glowSprite.scale.set(0.08, 0.08, 1);
issGroup.add(glowSprite);

let issModel = null;
const loader = new GLTFLoader();
const ISS_MODEL_URL = 'https://cdn.jsdelivr.net/gh/shashwatak/iss-tracker/models/ISS_Station.glb';

loader.load(
    ISS_MODEL_URL,
    (gltf) => {
        // Remove primitive once high-res is loaded
        issGroup.remove(primitiveISS);
        
        issModel = gltf.scene;
        issModel.scale.set(0.005, 0.005, 0.005);
        issModel.rotation.y = Math.PI / 2;
        issGroup.add(issModel);
        
        // Enhance materials for realism (Metallic look)
        issModel.traverse((child) => {
            if (child.isMesh) {
                child.material.envMap = envMap;
                child.material.roughness = 0.2;
                child.material.metalness = 0.8;
                child.material.needsUpdate = true;
            }
        });
        
        glowSprite.material.opacity = 0.4;
        console.log("ISS High-Res 3D Model Loaded");
    },
    undefined,
    (error) => {
        console.error("Error loading high-res model, keeping primitive:", error);
    }
);

// Orbit Path Line
let orbitLine;
const lineMat = new THREE.LineBasicMaterial({ color: 0xff9d00, transparent: true, opacity: 0.5 });

function updateOrbitLine(baseDate) {
    if(orbitLine) scene.remove(orbitLine);
    const { past, future } = getOrbitPath(baseDate, 45, 45, 2);
    const points = [...past, ...future].map(p => eciToThree(p));
    
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    orbitLine = new THREE.Line(geom, lineMat);
    scene.add(orbitLine);
}

// --- Tracking Loop ---

function animate() {
    requestAnimationFrame(animate);
    
    // Determine effective time
    const liveDate = new Date();
    const effectiveDate = new Date(liveDate.getTime() + timeOffsetMins * 60000);
    
    const posData = getPositionData(effectiveDate);
    
    if (posData) {
        // Map ISS ECI position to Three.js space
        const issPos3D = eciToThree(posData.eci);
        issGroup.position.copy(issPos3D);
        
        // --- Dynamic Scaling & LOD (Level of Detail) ---
        const distToCam = camera.position.distanceTo(issPos3D);
        
        // Transition threshold
        const transitionDist = 0.8; 
        const isClose = distToCam < transitionDist;

        if (isClose) {
            // Zoomed In: Show 3D objects
            if (issModel) issModel.visible = true;
            else primitiveISS.visible = true;
            
            labelSprite.visible = true; // Show Name
            glowSprite.visible = false;
            issGroup.scale.set(1, 1, 1);
        } else {
            // Zoomed Out: Show 2D Marker
            if (issModel) issModel.visible = false;
            primitiveISS.visible = false;
            labelSprite.visible = false; // Hide Name
            glowSprite.visible = true;
            
            // Scale the marker so it stays visible at a distance
            const scaleFactor = Math.min(30, Math.max(1.0, distToCam * 0.8));
            issGroup.scale.set(scaleFactor, scaleFactor, scaleFactor);
        }

        // --- Dynamic Orientation (Tangential to orbit) ---
        // Instead of pure lookAt, we orient to the Earth surface + Orbit tangent
        const futureDate = new Date(effectiveDate.getTime() + 10000); 
        const futurePos = getPositionData(futureDate);
        if (futurePos) {
            const nextPos3D = eciToThree(futurePos.eci);
            issGroup.lookAt(nextPos3D);
            // Ensure solar panels are roughly parallel to Earth (Nadir-locked style)
            // Rotate the group so it doesn't tilt "down" into the planet
            // (The default lookAt points Z at target, we might need a small adjustment)
        }
        
        // Rotate Earth based on GMST.
        // Longitude 0 is at -Z. To point it to X (ECI Vernal Equinox where gmst=0), rotate by -PI/2
        earthGroup.rotation.y = posData.gmst - Math.PI / 2;
        
        updateTelemetry(posData);
        
        if (isFollowing) {
            // Smoothly move camera controls target to ISS
            controls.target.lerp(issPos3D, 0.1);
        }
    }
    
    // --- Realistic Animations ---
    const time = Date.now() * 0.001;
    
    // Blink Nav Lights
    navLights.visible = (Math.floor(time * 2) % 2 === 0);
    
    // Rotate clouds slightly for life
    earthGroup.children.forEach(child => {
       if(child.material && child.material.map && child.material.map.image && child.material.map.image.src && child.material.map.image.src.includes('clouds')) {
           child.rotation.y += 0.0001;
       }
    });

    controls.update();
    renderer.render(scene, camera);
}

// Resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Boot ---
async function init() {
    try {
        setupUI(
            (offset) => { timeOffsetMins = offset; updateOrbitLine(new Date(Date.now() + timeOffsetMins * 60000)); },
            () => { timeOffsetMins = 0; updateOrbitLine(new Date()); },
            (following) => { isFollowing = following; },
            () => { 
                controls.target.set(0, 0, 0); 
                camera.position.set(EARTH_RADIUS * 2, EARTH_RADIUS, EARTH_RADIUS * 2); 
            }
        );
        
        await loadTLE();
        hideLoading();
        updateOrbitLine(new Date());
        
        setInterval(() => {
            const effectiveDate = new Date(Date.now() + timeOffsetMins * 60000);
            updateOrbitLine(effectiveDate);
        }, 60000);
        
        animate();
    } catch (e) {
        console.error("Fatal Application Error:", e);
        const p = document.querySelector('.loader p');
        if (p) p.innerHTML = `<span style="color:red">Fatal Error:<br>${e.message}</span><br>Please clear your cache and hit CTRL+SHIFT+R.`;
    }
}

init();
