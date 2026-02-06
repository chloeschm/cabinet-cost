import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';

const textureLoader = new THREE.TextureLoader();
const viewer3d = document.getElementById('viewer-3d');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xF5F5F4);

const width = viewer3d.offsetWidth;
const height = viewer3d.offsetHeight;

const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true });
renderer.setSize(width, height);
const controls = new OrbitControls(camera, renderer.domElement);
viewer3d.appendChild(renderer.domElement);

//create box

//constants
const defaultWidthIn = 24;
const defaultHeightIn = 36;
const defaultDepthIn = 12;
const INCHES_PER_UNIT = 12;
const doorThickness = 0.1

// room setup
let roomPhotoPlane = null;
let roomPhotoTexture = null;
let roomPhotoData = null;
let room3D = null;
let show3DRoom = false;

// cabinet storage
let placementMode = false;
let cabinets = [];
let currentCabinet = null;

// toggle cabinet interior view 
function toggleCabinetInterior(cabinet, showInterior) {
    if (!cabinet) return;

    cabinet.userData.cube.visible = !showInterior;
    cabinet.userData.wireframe.visible = showInterior;
    cabinet.userData.hollow = showInterior;
}

// create initial cabinet 
function createCabinet(widthIn = defaultWidthIn, heightIn = defaultHeightIn, depthIn = defaultDepthIn) {
    const widthUnits = widthIn / INCHES_PER_UNIT;
    const heightUnits = heightIn / INCHES_PER_UNIT;
    const depthUnits = depthIn / INCHES_PER_UNIT;
    const cabinetGroup = new THREE.Group();

    const geometry = new THREE.BoxGeometry(widthUnits, heightUnits, depthUnits);
    const edges = new THREE.EdgesGeometry(geometry);
    const material = new THREE.LineBasicMaterial({ color: 0x9CA3AF, linewidth: 2 });
    const wireframe = new THREE.LineSegments(edges, material);
    wireframe.visible = false; // start hidden
    cabinetGroup.add(wireframe);

    const faceMaterial = new THREE.MeshStandardMaterial({
        color: 0x9CA3AF,
        metalness: 0.7,
        roughness: 0.3,
        transparent: false,
        opacity: 1,
        side: THREE.DoubleSide
    });
    const cube = new THREE.Mesh(geometry, faceMaterial);
    cabinetGroup.add(cube);

    // door
    const doorGroup = new THREE.Group();
    const doorGeometry = new THREE.BoxGeometry(widthUnits * 0.9, heightUnits * 0.9, doorThickness);
    const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x9CA3AF });
    const doorMesh = new THREE.Mesh(doorGeometry, doorMaterial);

    doorMesh.position.x = widthUnits * 0.9 / 2;
    doorGroup.position.set(-widthUnits / 2, 0, depthUnits / 2 + doorThickness / 2);

    doorGroup.add(doorMesh);
    cabinetGroup.add(doorGroup);

    // references
    cabinetGroup.userData = {
        cube,
        wireframe,
        doorMesh: doorGroup,
        doorPanel: doorMesh,
        shelves: [],
        widthIn,
        heightIn,
        depthIn,
        color: 'Gray',
        shelfCount: 2,
        type: 'base',
        doorOpen: false,
        doorTargetRotation: 0,
        hollow: false 
    };

    return cabinetGroup;
}

// rebuild cabinet with updated dimensions or properties
function rebuildCabinet(cabinet) {
    const { widthIn, heightIn, depthIn, shelfCount, color, type, doorOpen, hollow } = cabinet.userData;

    const pos = cabinet.position.clone();
    const rot = cabinet.rotation.clone();

    scene.remove(cabinet);

    const newCabinet = createCabinet(widthIn, heightIn, depthIn);
    newCabinet.position.copy(pos);
    newCabinet.rotation.copy(rot);

    updateCabinetColor(newCabinet, color);
    createShelves(newCabinet, shelfCount);

    newCabinet.userData.type = type;
    newCabinet.userData.doorOpen = doorOpen;
    newCabinet.userData.hollow = hollow;

    toggleCabinetInterior(newCabinet, hollow);

    scene.add(newCabinet);

    const index = cabinets.indexOf(cabinet);
    cabinets[index] = newCabinet;
    currentCabinet = newCabinet;
}

// setting the cabinet 
currentCabinet = createCabinet();
scene.add(currentCabinet);
cabinets.push(currentCabinet);

camera.position.set(3, 3, 5);
camera.lookAt(0, 0, 0);

// add lights
const ambLight = new THREE.AmbientLight(0xffffff, 0.6);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(5, 8, 5);
scene.add(ambLight);
scene.add(dirLight);

// shelving system 
function getShelfColor(colorName) {
    const map = {
        'Gray': 0x6B7280,
        'White': 0xD6D3D1,
        'Black': 0x111111,
        'Dark Blue': 0x1B2E4B
    };
    return map[colorName] || 0x777777;
}

function createShelves(cabinet, count) {
    const { cube, shelves, widthIn, heightIn, depthIn } = cabinet.userData;

    shelves.forEach(shelf => cabinet.remove(shelf));
    shelves.length = 0;

    if (count <= 0) return;

    const widthUnits = widthIn / INCHES_PER_UNIT;
    const heightUnits = heightIn / INCHES_PER_UNIT;
    const depthUnits = depthIn / INCHES_PER_UNIT;
    const shelfThickness = 0.05;

    const spacing = heightUnits / (count + 1);

    for (let i = 0; i < count; i++) {
        const shelfGeometry = new THREE.BoxGeometry(
            widthUnits * 0.95,
            shelfThickness,
            depthUnits * 0.95
        );
        const shelfMaterial = new THREE.MeshStandardMaterial({
            color: getShelfColor(cabinet.userData.color),
            metalness: 0.3,
            roughness: 0.6,
        });
        const shelf = new THREE.Mesh(shelfGeometry, shelfMaterial);

        shelf.position.y = -heightUnits / 2 + spacing * (i + 1);

        cabinet.add(shelf);
        shelves.push(shelf);
    }

    cabinet.userData.shelfCount = count;
}

// add initial shelves
createShelves(currentCabinet, 2);

// 3D room creation
function create3DRoom(ceilingHeightFt) {

    if (room3D) {
        scene.remove(room3D);
        room3D = null;
    }

    if (!show3DRoom) return;

    const roomGroup = new THREE.Group();

    const roomWidth = 15;
    const roomDepth = 12;
    const roomHeight = ceilingHeightFt;

    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xBBBBBB, linewidth: 2 });

    const floorGeometry = new THREE.PlaneGeometry(roomWidth, roomDepth);
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0xE8E8E8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.3
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    roomGroup.add(floor);

    const gridHelper = new THREE.GridHelper(roomWidth, 20, 0xCCCCCC, 0xDDDDDD);
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.4;
    roomGroup.add(gridHelper);

    const wallGeometry = new THREE.PlaneGeometry(roomWidth, roomHeight);
    const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0xF0F0F0,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.2
    });
    const backWall = new THREE.Mesh(wallGeometry, wallMaterial);
    backWall.position.z = -roomDepth / 2;
    backWall.position.y = roomHeight / 2;
    roomGroup.add(backWall);

    const leftWall = new THREE.Mesh(wallGeometry.clone(), wallMaterial.clone());
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.x = -roomWidth / 2;
    leftWall.position.y = roomHeight / 2;
    roomGroup.add(leftWall);

    const outlinePoints = [

        new THREE.Vector3(-roomWidth / 2, 0, -roomDepth / 2),
        new THREE.Vector3(roomWidth / 2, 0, -roomDepth / 2),
        new THREE.Vector3(roomWidth / 2, 0, roomDepth / 2),
        new THREE.Vector3(-roomWidth / 2, 0, roomDepth / 2),
        new THREE.Vector3(-roomWidth / 2, 0, -roomDepth / 2),

        new THREE.Vector3(-roomWidth / 2, roomHeight, -roomDepth / 2),

        new THREE.Vector3(roomWidth / 2, roomHeight, -roomDepth / 2),
        new THREE.Vector3(roomWidth / 2, roomHeight, roomDepth / 2),
        new THREE.Vector3(-roomWidth / 2, roomHeight, roomDepth / 2),
        new THREE.Vector3(-roomWidth / 2, roomHeight, -roomDepth / 2),
    ];

    const outlineGeometry = new THREE.BufferGeometry().setFromPoints(outlinePoints);
    const outline = new THREE.Line(outlineGeometry, edgeMaterial);
    roomGroup.add(outline);

    const verticals = [
        [new THREE.Vector3(roomWidth / 2, 0, -roomDepth / 2), new THREE.Vector3(roomWidth / 2, roomHeight, -roomDepth / 2)],
        [new THREE.Vector3(roomWidth / 2, 0, roomDepth / 2), new THREE.Vector3(roomWidth / 2, roomHeight, roomDepth / 2)],
        [new THREE.Vector3(-roomWidth / 2, 0, roomDepth / 2), new THREE.Vector3(-roomWidth / 2, roomHeight, roomDepth / 2)],
    ];

    verticals.forEach(points => {
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geo, edgeMaterial);
        roomGroup.add(line);
    });

    room3D = roomGroup;
    scene.add(room3D);
}

// upload room photo
document.getElementById('room-photo').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {

            if (roomPhotoPlane) {
                scene.remove(roomPhotoPlane);
                if (roomPhotoTexture) roomPhotoTexture.dispose();
            }

            roomPhotoTexture = new THREE.TextureLoader().load(e.target.result);

            roomPhotoData = e.target.result;

            const aspectRatio = img.width / img.height;
            const planeWidth = 12;
            const planeHeight = planeWidth / aspectRatio;

            const planeGeometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
            const planeMaterial = new THREE.MeshBasicMaterial({
                map: roomPhotoTexture,
                side: THREE.DoubleSide
            });

            roomPhotoPlane = new THREE.Mesh(planeGeometry, planeMaterial);
            roomPhotoPlane.position.set(0, 0, -3);
            scene.add(roomPhotoPlane);

            document.getElementById('clear-photo').style.display = 'block';
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
});

document.getElementById('clear-photo').addEventListener('click', () => {
    if (roomPhotoPlane) {
        scene.remove(roomPhotoPlane);
        if (roomPhotoTexture) roomPhotoTexture.dispose();
        roomPhotoPlane = null;
        roomPhotoTexture = null;
        roomPhotoData = null;
    }
    document.getElementById('room-photo').value = '';
    document.getElementById('clear-photo').style.display = 'none';
});

// placement mode
const placementBtn = document.getElementById('placement-mode-btn');
const placementActions = document.getElementById('placement-actions');
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

placementBtn.addEventListener('click', () => {
    placementMode = !placementMode;

    if (placementMode) {
        placementBtn.textContent = 'Disable Placement Mode';
        placementBtn.style.backgroundColor = '#8C2F2B';
        placementActions.style.display = 'block';
    } else {
        placementBtn.textContent = 'Enable Placement Mode';
        placementBtn.style.backgroundColor = '#4D6A52';
        placementActions.style.display = 'none';
    }
});

document.getElementById('toggle-hollow-btn').addEventListener('click', () => {
    if (!currentCabinet) return;
    const newState = !currentCabinet.userData.hollow;
    toggleCabinetInterior(currentCabinet, newState);

    document.getElementById('toggle-hollow-btn').textContent =
        newState ? "Show Exterior" : "Show Interior";
});

// click to place
renderer.domElement.addEventListener('click', (event) => {
    if (!placementMode) return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    let intersects;
    if (roomPhotoPlane) {
        intersects = raycaster.intersectObject(roomPhotoPlane);
    } else {
        const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersectPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(ground, intersectPoint);

        if (intersectPoint) {
            intersects = [{ point: intersectPoint }];
        }
    }

    if (intersects && intersects.length > 0) {
        const widthIn = Number(document.getElementById('width-input').value);
        const heightIn = Number(document.getElementById('height-input').value);
        const depthIn = Number(document.getElementById('depth-input').value);
        const color = document.getElementById('color-select').value;
        const shelfCount = Number(document.getElementById('shelves-input').value);
        const cabinetType = document.getElementById('cabinet-type').value;

        const newCabinet = createCabinet(widthIn, heightIn, depthIn);
        newCabinet.position.copy(intersects[0].point);

        const heightUnits = heightIn / INCHES_PER_UNIT;
        if (cabinetType === 'base') {
            newCabinet.position.y = heightUnits / 2;
        } else if (cabinetType === 'wall') {
            newCabinet.position.y = heightUnits / 2 + 4;
        } else if (cabinetType === 'tall') {
            newCabinet.position.y = heightUnits / 2;
        }

        updateCabinetColor(newCabinet, color);
        createShelves(newCabinet, shelfCount);
        newCabinet.userData.type = cabinetType;
        newCabinet.userData.color = color;

        scene.add(newCabinet);
        cabinets.push(newCabinet);
        currentCabinet = newCabinet;

        updateCost();
    }
});

// delete selected cabinet
document.getElementById('delete-selected-btn').addEventListener('click', () => {
    if (!currentCabinet) {
        alert('No cabinet selected. Click on a cabinet in the 3D view first.');
        return;
    }

    scene.remove(currentCabinet);
    const index = cabinets.indexOf(currentCabinet);
    if (index > -1) {
        cabinets.splice(index, 1);
    }

    currentCabinet = cabinets.length > 0 ? cabinets[cabinets.length - 1] : null;
    updateCost();
});

// clear all cabinets
document.getElementById('clear-all-btn').addEventListener('click', () => {
    if (cabinets.length === 0) {
        alert('No cabinets to clear.');
        return;
    }

    if (confirm('Are you sure you want to delete all cabinets?')) {
        cabinets.forEach(cab => scene.remove(cab));
        cabinets.length = 0;
        currentCabinet = null;
        updateCost();
    }
});

// colors
const colorMap = {
    'Gray': 0x9CA3AF,
    'White': 0xF5F5F4,
    'Black': 0x1C1C1C,
    'Dark Blue': 0x1E3A5F
};

function updateCabinetColor(cabinet, colorName) {
    const hexValue = colorMap[colorName];
    const { cube, wireframe, doorPanel } = cabinet.userData;

    cube.material.color.set(hexValue);
    wireframe.material.color.set(hexValue);
    doorPanel.material.color.set(hexValue);

    cabinet.userData.color = colorName;
}

document.getElementById('color-select').addEventListener('change', (event) => {
    if (currentCabinet) {
        updateCabinetColor(currentCabinet, event.target.value);
        updateCost();
    }
});

// dimensions
document.getElementById('width-input').addEventListener('input', e => {
    if (!currentCabinet) return;
    currentCabinet.userData.widthIn = Number(e.target.value);
    rebuildCabinet(currentCabinet);
    updateCost();
});

document.getElementById('height-input').addEventListener('input', e => {
    if (!currentCabinet) return;
    currentCabinet.userData.heightIn = Number(e.target.value);
    rebuildCabinet(currentCabinet);
    updateCost();
});

document.getElementById('depth-input').addEventListener('input', e => {
    if (!currentCabinet) return;
    currentCabinet.userData.depthIn = Number(e.target.value);
    rebuildCabinet(currentCabinet);
    updateCost();
});

document.getElementById('shelves-input').addEventListener('input', (event) => {
    const count = Number(event.target.value);
    if (currentCabinet) {
        createShelves(currentCabinet, count);
        updateCost();
    }
});

document.getElementById('ceiling-height').addEventListener('input', () => {
    if (show3DRoom) {
        const ceilingHeight = Number(document.getElementById('ceiling-height').value);
        create3DRoom(ceilingHeight);
    }
    updateCost();
});

// toggle 3D room
document.getElementById('toggle-3d-room-btn').addEventListener('click', () => {
    show3DRoom = !show3DRoom;
    const btn = document.getElementById('toggle-3d-room-btn');

    if (show3DRoom) {
        btn.textContent = 'Hide 3D Room';
        btn.style.backgroundColor = '#8C2F2B';
        const ceilingHeight = Number(document.getElementById('ceiling-height').value);
        create3DRoom(ceilingHeight);
    } else {
        btn.textContent = 'Show 3D Room';
        btn.style.backgroundColor = '#4D6A52';
        if (room3D) {
            scene.remove(room3D);
            room3D = null;
        }
    }
});

// door open/close (to see shelves :p)
const toggleDoorBtn = document.getElementById('toggle-door-btn');

toggleDoorBtn.addEventListener('click', () => {
    if (!currentCabinet) return;

    const { doorOpen } = currentCabinet.userData;

    if (doorOpen) {
        currentCabinet.userData.doorTargetRotation = 0;
        currentCabinet.userData.doorOpen = false;
        toggleDoorBtn.textContent = 'Open Door';
    } else {
        currentCabinet.userData.doorTargetRotation = -Math.PI * 0.66;
        currentCabinet.userData.doorOpen = true;
        toggleDoorBtn.textContent = 'Close Door';
    }
});

function animateDoors() {
    cabinets.forEach(cabinet => {
        const { doorMesh, doorTargetRotation } = cabinet.userData;
        const currentRotation = doorMesh.rotation.y;

        const speed = 0.1;
        const newRotation = currentRotation + (doorTargetRotation - currentRotation) * speed;

        if (Math.abs(doorTargetRotation - newRotation) > 0.001) {
            doorMesh.rotation.y = newRotation;
        } else {
            doorMesh.rotation.y = doorTargetRotation;
        }
    });
}

// cost calculation (WIP)
const ALUMINUM_COST_PER_SQ_FT = 12;
const SHELF_COST = 15;

function updateCost() {
    let totalMaterialCost = 0;
    let totalShelfCost = 0;

    cabinets.forEach(cabinet => {
        const { widthIn, heightIn, depthIn, shelfCount } = cabinet.userData;

        const widthFt = widthIn / 12;
        const heightFt = heightIn / 12;
        const depthFt = depthIn / 12;

        const surfaceArea = 2 * (widthFt * heightFt + widthFt * depthFt + heightFt * depthFt);

        const materialCost = surfaceArea * ALUMINUM_COST_PER_SQ_FT;
        totalMaterialCost += materialCost;

        const shelfCost = shelfCount * SHELF_COST;
        totalShelfCost += shelfCost;
    });

    const totalCost = totalMaterialCost + totalShelfCost;

    document.getElementById('material-cost').textContent =
        `Material Cost: $${totalMaterialCost.toFixed(2)}`;
    document.getElementById('shelf-cost').textContent =
        `Shelf Cost: $${totalShelfCost.toFixed(2)}`;
    document.getElementById('total-cost').textContent =
        `Total Cost: $${totalCost.toFixed(2)}`;
}

updateCost();

// save/export/load system
document.getElementById('save-btn').addEventListener('click', () => {
    const designData = {
        version: '1.0',
        roomPhoto: roomPhotoData,
        ceilingHeight: Number(document.getElementById('ceiling-height').value),
        cabinets: cabinets.map(cab => ({
            position: cab.position.toArray(),
            rotation: cab.rotation.toArray(),
            widthIn: cab.userData.widthIn,
            heightIn: cab.userData.heightIn,
            depthIn: cab.userData.depthIn,
            color: cab.userData.color,
            shelfCount: cab.userData.shelfCount,
            type: cab.userData.type
        }))
    };

    const dataStr = JSON.stringify(designData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `cabinet-design-${Date.now()}.json`;
    link.click();

    URL.revokeObjectURL(url);
});

document.getElementById('load-btn').addEventListener('click', () => {
    document.getElementById('load-file-input').click();
});

document.getElementById('load-file-input').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const designData = JSON.parse(e.target.result);

            cabinets.forEach(cab => scene.remove(cab));
            cabinets.length = 0;

            if (designData.roomPhoto) {
                roomPhotoData = designData.roomPhoto;
                const img = new Image();
                img.onload = () => {
                    if (roomPhotoPlane) scene.remove(roomPhotoPlane);

                    roomPhotoTexture = new THREE.TextureLoader().load(designData.roomPhoto);
                    const aspectRatio = img.width / img.height;
                    const planeWidth = 12;
                    const planeHeight = planeWidth / aspectRatio;

                    const planeGeometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
                    const planeMaterial = new THREE.MeshBasicMaterial({
                        map: roomPhotoTexture,
                        side: THREE.DoubleSide
                    });

                    roomPhotoPlane = new THREE.Mesh(planeGeometry, planeMaterial);
                    roomPhotoPlane.position.set(0, 0, -3);
                    scene.add(roomPhotoPlane);
                };
                img.src = designData.roomPhoto;
            }

            if (designData.ceilingHeight) {
                document.getElementById('ceiling-height').value = designData.ceilingHeight;
            }

            designData.cabinets.forEach(cabData => {
                const cabinet = createCabinet(cabData.widthIn, cabData.heightIn, cabData.depthIn);
                cabinet.position.fromArray(cabData.position);
                cabinet.rotation.fromArray(cabData.rotation);

                updateCabinetColor(cabinet, cabData.color);
                createShelves(cabinet, cabData.shelfCount);
                cabinet.userData.type = cabData.type;

                scene.add(cabinet);
                cabinets.push(cabinet);
            });

            if (cabinets.length > 0) {
                currentCabinet = cabinets[0];
            }

            updateCost();

        } catch (error) {
            alert('Error loading design file: ' + error.message);
        }
    };
    reader.readAsText(file);
});

document.getElementById('export-btn').addEventListener('click', () => {
    renderer.render(scene, camera);

    const imgData = renderer.domElement.toDataURL('image/png');

    const link = document.createElement('a');
    link.href = imgData;
    link.download = `cabinet-design-${Date.now()}.png`;
    link.click();
});


// final loops to make run
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    animateDoors();
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    const newWidth = viewer3d.offsetWidth;
    const newHeight = viewer3d.offsetHeight;

    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(newWidth, newHeight);
});

// accordion functionality 
document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
        const content = header.nextElementSibling;
        const icon = header.querySelector('.accordion-icon');

        if (content.classList.contains('active')) {
            content.classList.remove('active');
            header.classList.add('collapsed');
            icon.textContent = '+';
        } else {
            content.classList.add('active');
            header.classList.remove('collapsed');
            icon.textContent = '−';
        }
    });
});