import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';
const textureLoader = new THREE.TextureLoader();

const viewer3d = document.getElementById('viewer-3d');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xF5F5F4);

const width = viewer3d.offsetWidth;
const height = viewer3d.offsetHeight;

const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(width, height);
const controls = new OrbitControls(camera, renderer.domElement);
viewer3d.appendChild(renderer.domElement);

// create box
const defaultWidthIn = 24;
const defaultHeightIn = 36;
const defaultDepthIn = 12;

const INCHES_PER_UNIT = 12;

const widthUnits = defaultWidthIn / INCHES_PER_UNIT;
const heightUnits = defaultHeightIn / INCHES_PER_UNIT;
const depthUnits = defaultDepthIn / INCHES_PER_UNIT;

const geometry = new THREE.BoxGeometry(widthUnits, heightUnits, depthUnits);
const material = new THREE.MeshStandardMaterial({ color: 0xD8CFC4 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);
camera.position.z = 5;

// create door for cabinet
const doorThickness = 0.1
const doorGeometry = new THREE.BoxGeometry(widthUnits * 0.9, heightUnits * 0.9, doorThickness);

const doorMaterial = material.clone();
doorMaterial.color.multiplyScalar(0.8);
const doorMesh = new THREE.Mesh(doorGeometry, doorMaterial);
doorMesh.position.z = (depthUnits / 2) + (doorThickness / 2);
scene.add(doorMesh);

// add light
const ambLight = new THREE.AmbientLight(0xffffff, 0.5);
const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
dirLight.position.set(5, 5, 5);
scene.add(ambLight);
scene.add(dirLight);


// orbit around the cabinet 
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();


// connect to input
const widthInput = document.getElementById('width-input');
widthInput.addEventListener('input', (event) => {
    const newWidth = Number(event.target.value);
    if (!newWidth || newWidth <= 0) return;
    const scaleFactor = newWidth / defaultWidthIn;

    cube.scale.x = scaleFactor;
    doorMesh.scale.x = scaleFactor;
    updateCost();
});

const heightInput = document.getElementById('height-input');
heightInput.addEventListener('input', (event) => {
    const newHeight = Number(event.target.value);
    if (!newHeight || newHeight <= 0) return;
    const scaleFactor = newHeight / defaultHeightIn;

    cube.scale.y = scaleFactor;
    doorMesh.scale.y = scaleFactor;
    updateCost();
});

const depthInput = document.getElementById('depth-input');
depthInput.addEventListener('input', (event) => {
    const newDepth = Number(event.target.value);
    if (!newDepth || newDepth <= 0) return;
    const scaleFactor = newDepth / defaultDepthIn;

    cube.scale.z = scaleFactor;
    doorMesh.position.z = (depthUnits / 2 * scaleFactor) + (doorThickness / 2); updateCost();
});


// update colors
const colorMap = {
    'Tan': 0xD8CFC4,
    'White': 0xF5F5F4,
    'Black': 0x1C1C1C,
    'Light Brown': 0xC9AE8E,
    'Brown': 0x8B6F47,
    'Dark Brown': 0x4A3321,
    'Red': 0x8C2F2B,
    'Orange': 0xC97A4A,
    'Yellow': 0xD6B45C,
    'Green': 0x4D6A52,
    'Blue': 0x3F5E73,
    'Indigo': 0x35384A,
    'Violet': 0x6B5C73
};

const colorSelect = document.getElementById('color-select');
colorSelect.addEventListener('change', (event) => {
    const selectedColor = event.target.value;
    const hexValue = colorMap[selectedColor];
    material.color.set(hexValue);

    const darkerColor = new THREE.Color(hexValue).multiplyScalar(0.7);
    doorMaterial.color.set(darkerColor);

    updateCost();
});


// update material
const plywoodTexture = textureLoader.load('textures/plywood.png');
const woodTexture = textureLoader.load('textures/wood.png');
const mdfTexture = textureLoader.load('textures/mdf.png');

const materialMap = {
    'plywood': { roughness: 0.5, metalness: 0.2, map: plywoodTexture },
    'mdf': { roughness: 1.0, metalness: 0.0, map: mdfTexture },
    'solid-wood': { roughness: 0.3, metalness: 0.0, map: woodTexture }
};

// apply default material (plywood)
const defaultSettings = materialMap['plywood'];
material.roughness = defaultSettings.roughness;
material.metalness = defaultSettings.metalness;
material.map = defaultSettings.map;
material.needsUpdate = true;

doorMaterial.roughness = defaultSettings.roughness;
doorMaterial.metalness = defaultSettings.metalness;
doorMaterial.map = defaultSettings.map;
doorMaterial.needsUpdate = true;

// back to updating
const materialSelect = document.getElementById('material-select');
materialSelect.addEventListener('change', (event) => {
    const selectedMaterial = event.target.value;
    const settings = materialMap[selectedMaterial];

    if (!settings) return;

    material.roughness = settings.roughness;
    material.metalness = settings.metalness;
    material.map = settings.map;
    material.needsUpdate = true;

    doorMaterial.roughness = settings.roughness;
    doorMaterial.metalness = settings.metalness;
    doorMaterial.map = settings.map;
    doorMaterial.needsUpdate = true;

    updateCost();
});

const finishSelect = document.getElementById('finish-select');
finishSelect.addEventListener('change', (event) => {
    updateCost();
});

// pricing calculator
const materialPrices = {
    'plywood': 1.0,
    'mdf': 0.6,
    'solid-wood': 2.5
};

const finishPrices = {
    'none': 0,
    'painted': 50,
    'stained': 75
};

const BASE_COST_PER_CUBIC_FOOT = 15;

function updateCost() {
    const widthInches = Number(widthInput.value);
    const heightInches = Number(heightInput.value);
    const depthInches = Number(depthInput.value);

    if (!widthInches || !heightInches || !depthInches) return;

    const volumeCubicFeet = (widthInches / 12) * (heightInches / 12) * (depthInches / 12);

    const selectedMaterial = materialSelect.value;
    const selectedFinish = document.getElementById('finish-select').value;

    const materialMultiplier = materialPrices[selectedMaterial] ?? 1;
    const finishCost = finishPrices[selectedFinish] ?? 0;

    const materialCost = volumeCubicFeet * BASE_COST_PER_CUBIC_FOOT * materialMultiplier;
    const totalCost = materialCost + finishCost;

    document.getElementById('material-cost').textContent =
        `Material Cost: $${materialCost.toFixed(2)}`;

    document.getElementById('finish-cost').textContent =
        `Finish Cost: $${finishCost.toFixed(2)}`;

    document.getElementById('total-cost').textContent =
        `Total Cost: $${totalCost.toFixed(2)}`;
}

updateCost();