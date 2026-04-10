// js/main.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
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
controls.minDistance = EARTH_RADIUS * 1.1;
controls.maxDistance = EARTH_RADIUS * 10;

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

// Sun (Directional Light)
const sunLight = new THREE.DirectionalLight(0xffffff, 2);
sunLight.position.set(50, 20, 30); // Simple fixed sun position for nice shading
scene.add(sunLight);

// --- Earth Model ---
const textureLoader = new THREE.TextureLoader();
const earthGroup = new THREE.Group();
scene.add(earthGroup);

const earthMat = new THREE.MeshPhongMaterial({
    map: textureLoader.load('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg'),
    bumpMap: textureLoader.load('https://unpkg.com/three-globe/example/img/earth-topology.png'),
    bumpScale: 0.05,
    specularMap: textureLoader.load('https://unpkg.com/three-globe/example/img/earth-water.png'),
    specular: new THREE.Color('grey')
});
const earthRadius = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);
const earthMesh = new THREE.Mesh(earthRadius, earthMat);
earthGroup.add(earthMesh);

// Atmosphere Glow
const atmosMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.1,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide
});
const atmosMesh = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS * 1.05, 64, 64), atmosMat);
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

// --- ISS Marker ---
const issGroup = new THREE.Group();
scene.add(issGroup);

// Create a glowing dot for ISS
const issMat = new THREE.MeshBasicMaterial({ color: 0xff9d00 });
const issMesh = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS * 0.015, 16, 16), issMat);
issGroup.add(issMesh);

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
        
        // Rotate Earth based on GMST.
        // Longitude 0 is at -Z. To point it to X (ECI Vernal Equinox where gmst=0), rotate by -PI/2
        earthGroup.rotation.y = posData.gmst - Math.PI / 2;
        
        updateTelemetry(posData);
        
        if (isFollowing) {
            // Smoothly move camera controls target to ISS
            controls.target.lerp(issPos3D, 0.1);
        }
    }
    
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
