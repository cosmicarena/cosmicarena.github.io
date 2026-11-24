// Sintetizador de sonido Web Audio
let audioCtx = null;
let sfxEnabled = true;

function toggleSfx() {
	sfxEnabled = !sfxEnabled;
	const icon = document.getElementById('sfx-toggle-icon');
	icon.innerText = sfxEnabled ? '🔊' : '🔇';
}

function initAudio() {
	if (!audioCtx) {
		audioCtx = new (window.AudioContext || window.webkitAudioContext)();
	}
	if (audioCtx.state === 'suspended') {
		audioCtx.resume();
	}
}
['mousedown', 'keydown', 'touchstart'].forEach(eventType => {
	window.addEventListener(eventType, initAudio, { once: true });
});

function playSound(type) {
	if (!sfxEnabled || !audioCtx) return;
	try {
		const osc = audioCtx.createOscillator();
		const gain = audioCtx.createGain();
		osc.connect(gain);
		gain.connect(audioCtx.destination);

		if (type === 'shoot') {
			osc.type = 'sawtooth';
			osc.frequency.setValueAtTime(140, audioCtx.currentTime);
			osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.08);
			gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
			gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
			osc.start();
			osc.stop(audioCtx.currentTime + 0.08);
		} else if (type === 'hit') {
			osc.type = 'square';
			osc.frequency.setValueAtTime(220, audioCtx.currentTime);
			osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.06);
			gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
			gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);
			osc.start();
			osc.stop(audioCtx.currentTime + 0.06);
		} else if (type === 'destroy') {
			osc.type = 'triangle';
			osc.frequency.setValueAtTime(320, audioCtx.currentTime);
			osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.2);
			gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
			gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
			osc.start();
			osc.stop(audioCtx.currentTime + 0.2);
		} else if (type === 'upgrade') {
			osc.type = 'sine';
			osc.frequency.setValueAtTime(300, audioCtx.currentTime);
			osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.15);
			gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
			gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
			osc.start();
			osc.stop(audioCtx.currentTime + 0.15);
		} else if (type === 'lowHp') {
			osc.type = 'sine';
			osc.frequency.setValueAtTime(880, audioCtx.currentTime);
			gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
			gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
			osc.start();
			osc.stop(audioCtx.currentTime + 0.08);
		} else if (type === 'bounce') {
			osc.type = 'sine';
			osc.frequency.setValueAtTime(180, audioCtx.currentTime);
			osc.frequency.exponentialRampToValueAtTime(90, audioCtx.currentTime + 0.04);
			gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
			gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
			osc.start();
			osc.stop(audioCtx.currentTime + 0.04);
		} else if (type === 'enemyShoot') {
			osc.type = 'sawtooth';
			osc.frequency.setValueAtTime(100, audioCtx.currentTime);
			osc.frequency.exponentialRampToValueAtTime(20, audioCtx.currentTime + 0.1);
			gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
			gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
			osc.start();
			osc.stop(audioCtx.currentTime + 0.1);
		} else if (type === 'playerDamage') {
			osc.type = 'sawtooth';
			osc.frequency.setValueAtTime(90, audioCtx.currentTime);
			osc.frequency.exponentialRampToValueAtTime(25, audioCtx.currentTime + 0.2);
			gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
			gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
			osc.start();
			osc.stop(audioCtx.currentTime + 0.2);
		}
	} catch(e) {}
}

let cash = 0;
let playerHp = 100;
let maxPlayerHp = 100;
let isGameOver = false;
let isEnding = false;
let portalCountdownRemaining = 0;
let endgameTimeout = null;
let playerDamageCooldown = 0;
let targetsDestroyedCount = 0;
let botsDestroyedCount = 0;
let sphereRewardsPaid = 0;
let enemyBotRewardsPaid = 0;
let screenShake = 0;
let lowHpTimer = 0;

// Estado de cámara y apuntado
let camYaw = 0;
let camPitch = 0.4;
let camDist = 9;

// Vectores preasignados para optimizar el rendimiento
const scratchForward = new THREE.Vector3();
const scratchRight = new THREE.Vector3();
const scratchMove = new THREE.Vector3();
const scratchSubVel = new THREE.Vector3();
const scratchEnemyDir = new THREE.Vector3();

// Configuración de bloqueo de puntero (Escritorio)
document.body.addEventListener('click', (e) => {
	if (e.target.closest('#shop') || e.target.closest('#gameover')) return;
	if (isGameOver || isEnding) return;
	if (document.pointerLockElement === document.body) {
		document.exitPointerLock?.();
	} else {
		document.body.requestPointerLock?.();
	}
});

document.addEventListener('mousemove', (e) => {
	if (document.pointerLockElement === document.body && !isGameOver) {
		const sensitivity = 0.003;
		camYaw -= e.movementX * sensitivity;
		camPitch += e.movementY * sensitivity;
		camPitch = Math.max(0.08, Math.min(Math.PI / 2.2, camPitch));
	}
});

// Zoom con rueda y pellizco en trackpad
window.addEventListener('wheel', (e) => {
	e.preventDefault();
	if (!isGameOver) {
		const zoomSpeed = e.ctrlKey ? 0.06 : 0.012;
		camDist += e.deltaY * zoomSpeed;
		camDist = Math.max(4, Math.min(70, camDist));
	}
}, { passive: false });

// Controles táctiles unificados (1 dedo para mirar + 2 dedos para zoom)
let initialPinchDist = null;
let isTouchDragging = false;
let touchStartX = 0;
let touchStartY = 0;

window.addEventListener('touchstart', (e) => {
	if (e.touches.length === 1) {
		if (e.target.closest('#shop') || e.target.closest('#gameover')) return;
		isTouchDragging = true;
		touchStartX = e.touches[0].clientX;
		touchStartY = e.touches[0].clientY;
	} else if (e.touches.length === 2) {
		isTouchDragging = false;
		initialPinchDist = Math.hypot(
			e.touches[0].clientX - e.touches[1].clientX,
			e.touches[0].clientY - e.touches[1].clientY
		);
	}
}, { passive: false });

window.addEventListener('touchmove', (e) => {
	if (isGameOver) return;

	if (e.touches.length === 1 && isTouchDragging) {
		const dx = e.touches[0].clientX - touchStartX;
		const dy = e.touches[0].clientY - touchStartY;

		const touchSensitivity = 0.005;
		camYaw -= dx * touchSensitivity;
		camPitch += dy * touchSensitivity;
		camPitch = Math.max(0.08, Math.min(Math.PI / 2.2, camPitch));

		touchStartX = e.touches[0].clientX;
		touchStartY = e.touches[0].clientY;
	} else if (e.touches.length === 2 && initialPinchDist !== null) {
		e.preventDefault();
		const currentDist = Math.hypot(
			e.touches[0].clientX - e.touches[1].clientX,
			e.touches[0].clientY - e.touches[1].clientY
		);
		const diff = initialPinchDist - currentDist;
		camDist += diff * 0.04;
		camDist = Math.max(4, Math.min(70, camDist));
		initialPinchDist = currentDist;
	}
}, { passive: false });

window.addEventListener('touchend', (e) => {
	if (e.touches.length === 0) {
		isTouchDragging = false;
		initialPinchDist = null;
	} else if (e.touches.length === 1) {
		initialPinchDist = null;
		if (!e.target.closest('#shop') && !e.target.closest('#gameover')) {
			isTouchDragging = true;
			touchStartX = e.touches[0].clientX;
			touchStartY = e.touches[0].clientY;
		}
	}
});

let stats = {
	speed: { level: 1, maxLevel: 5, cost: 100, val: 0.55, mult: 1.55 },
	rate: { level: 1, maxLevel: 5, cost: 125, val: 12, bulletSpeed: 4.5, mult: 1.6 },
	multishot: { level: 1, cost: 1500, val: 1, max: 4, mult: 1.6 },
	maxHp: { level: 1, maxLevel: 3, cost: 200, val: 100, mult: 1.6 }
};

let barrelsGroup = new THREE.Group();

function showNotification(text, isDamage = false) {
	const container = document.getElementById('notifications');
	if (!container) return;
	while (container.children.length >= 4) {
		container.firstChild.remove();
	}
	const div = document.createElement('div');
	div.className = 'notif' + (isDamage ? ' damage' : '');
	div.innerText = text;
	container.appendChild(div);
	setTimeout(() => {
		if (div.parentNode) div.remove();
	}, 2500);
}

function triggerDamageVignette() {
	const vig = document.getElementById('damage-vignette');
	vig.style.boxShadow = 'inset 0 0 110px rgba(255, 30, 50, 0.75)';
	setTimeout(() => {
		vig.style.boxShadow = 'inset 0 0 90px rgba(255, 30, 50, 0)';
	}, 220);
}

function updatePlayerHpUI() {
	const hpPct = Math.max(0, Math.min(100, (playerHp / maxPlayerHp) * 100));
	const fill = document.getElementById('health-bar-fill');
	fill.style.width = `${hpPct}%`;
	fill.style.backgroundColor = hpPct <= 25 ? '#ff3344' : '#00ff88';
}

function updateMultishotUpgradeButton() {
	const button = document.getElementById('btn-multishot');
	const upgrade = stats.multishot;
	if (!button || !upgrade) return;
	const nextBarrelCount = upgrade.val + 1;
	const barrelNames = { 2: 'doble', 3: 'triple', 4: 'cuádruple' };
	if (upgrade.val >= upgrade.max) {
		button.disabled = true;
		button.textContent = 'Cañón cuádruple desbloqueado';
		return;
	}
	button.disabled = false;
	button.innerHTML = `Mejorar a cañón ${barrelNames[nextBarrelCount]} ($<span id="cost-multishot">${upgrade.cost}</span>)`;
}
updateMultishotUpgradeButton();

function damagePlayer(amount, message) {
	if (isEnding || isGameOver || playerDamageCooldown > 0) return false;
	playerHp = Math.max(0, playerHp - amount);
	playerDamageCooldown = 18;
	updatePlayerHpUI();
	showNotification(message, true);
	playSound('playerDamage');
	triggerDamageVignette();
	screenShake = 0.6;
	if (playerHp <= 0) finishGame(false);
	return true;
}

window.buyUpgrade = function(type) {
	let u = stats[type];
	if (!u || isEnding || isGameOver ||
		(type === 'multishot' && u.val >= u.max) || (u.maxLevel && u.level >= u.maxLevel)) return;

	if (cash >= u.cost) {
		cash -= u.cost;
		document.getElementById('cash').innerText = cash;
		u.level++;
		playSound('upgrade');
		
		if (type === 'speed') u.val *= 1.06;
		if (type === 'rate') {
			u.val *= 0.92;
			u.bulletSpeed *= 1.05;
		}
		if (type === 'maxHp') {
			maxPlayerHp += 40;
			playerHp = Math.min(maxPlayerHp, playerHp + 20);
			updatePlayerHpUI();
		}
		if (type === 'multishot') {
			u.val += 1;
			updateTankBarrels();
		}

		const maxed = (u.maxLevel && u.level >= u.maxLevel) || (type === 'multishot' && u.val >= u.max);
		if (maxed) {
			const maxLabels = { speed: 'Velocidad al máximo', rate: 'Cadencia al máximo', maxHp: 'Vida máxima alcanzada', multishot: '¡Llegaste al máximo de cañones!' };
			const btn = document.getElementById(type === 'maxHp' ? 'btn-maxhp' : `btn-${type}`);
			if (btn) {
				btn.disabled = true;
				btn.innerText = maxLabels[type];
			}
		} else {
			u.cost = Math.floor(u.cost * u.mult);
			const costElement = document.getElementById(`cost-${type}`);
			if (costElement) costElement.innerText = u.cost;
		}
		if (type === 'multishot') updateMultishotUpgradeButton();
	}
};

// Configuración de la escena
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f19);
scene.fog = new THREE.FogExp2(0x0b0f19, 0.0018);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1800);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Iluminación
const ambientLight = new THREE.AmbientLight(0x38bdf8, 0.5);
scene.add(ambientLight);
scene.add(new THREE.HemisphereLight(0x8bdcff, 0x101426, 0.45));

const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
sunLight.position.set(60, 120, 60);
sunLight.castShadow = true;
	sunLight.shadow.mapSize.width = 1536;
	sunLight.shadow.mapSize.height = 1536;
scene.add(sunLight);

// Cielo estrellado
const starCount = 800;
const starGeo = new THREE.BufferGeometry();
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount * 3; i += 3) {
	starPositions[i] = (Math.random() - 0.5) * 1400;
	starPositions[i + 1] = Math.random() * 300 + 20;
	starPositions[i + 2] = (Math.random() - 0.5) * 1400;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, transparent: true, opacity: 0.8 });
const starField = new THREE.Points(starGeo, starMat);
scene.add(starField);

// Arena y muros límite
const arenaSize = 1000;
const halfArena = arenaSize / 2;
const spawnRange = 900;
const sphereCount = 72;
const enemyBotCount = 10;
const fortressOuterRadius = 260;
const fortressInnerRadius = 160;
const fortressWallThickness = 8;
const fortressWallHeight = 12;
const gateWidth = 48;
const fortressWalls = [];
const fortressObstacles = [];
const fortressGates = { outer: [], inner: [], portal: [] };

const gridHelper = new THREE.GridHelper(arenaSize, 50, 0x00ff88, 0x1e2942);
gridHelper.position.y = 0.02;
scene.add(gridHelper);

const floorGeo = new THREE.PlaneGeometry(arenaSize, arenaSize);
floorGeo.rotateX(-Math.PI / 2);
const floorMat = new THREE.MeshStandardMaterial({
	color: 0x080d18,
	roughness: 0.92,
	metalness: 0.06
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.receiveShadow = true;
scene.add(floor);

function createProceduralWallTexture() {
	const canvas = document.createElement('canvas');
	canvas.width = 256;
	canvas.height = 256;
	const ctx = canvas.getContext('2d');
	
	ctx.fillStyle = '#0f172a';
	ctx.fillRect(0, 0, 256, 256);

	ctx.strokeStyle = '#00ffcc';
	ctx.lineWidth = 6;
	ctx.strokeRect(0, 0, 256, 256);

	ctx.strokeStyle = '#1e2942';
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.moveTo(0, 128); ctx.lineTo(256, 128);
	ctx.moveTo(128, 0); ctx.lineTo(128, 256);
	ctx.stroke();

	ctx.fillStyle = '#00ff88';
	ctx.fillRect(20, 20, 15, 15);
	ctx.fillRect(220, 20, 15, 15);
	ctx.fillRect(20, 220, 15, 15);
	ctx.fillRect(220, 220, 15, 15);

	const texture = new THREE.CanvasTexture(canvas);
	texture.wrapS = THREE.RepeatWrapping;
	texture.wrapT = THREE.RepeatWrapping;
	texture.repeat.set(1, 1);
	return texture;
} 

const wallTexture = createProceduralWallTexture();
const wallHeight = 7;
const wallThickness = 2;
const wallMat = new THREE.MeshStandardMaterial({ 
	map: wallTexture, 
	roughness: 0.4, 
	metalness: 0.6,
	emissive: 0x00ffcc,
	emissiveIntensity: 0.15
});

function addWallMesh(w, h, d, x, y, z, material = wallMat) {
	const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
	wall.position.set(x, y, z);
	wall.castShadow = true;
	wall.receiveShadow = true;
	scene.add(wall);
	return wall;
}

function addPanelizedWallRun(horizontal, coordinate, start, end, height, thickness, material = wallMat, addCollision = false) {
	const span = end - start;
	if (span <= 0) return;
	const panelCount = Math.max(1, Math.round(span / height));
	const panelLength = span / panelCount;
	const panels = new THREE.InstancedMesh(new THREE.BoxGeometry(height, height, thickness), material, panelCount);
	const transform = new THREE.Object3D();
	for (let i = 0; i < panelCount; i++) {
		const along = start + (i + 0.5) * panelLength;
		transform.position.set(horizontal ? along : coordinate, height / 2, horizontal ? coordinate : along);
		transform.rotation.set(0, horizontal ? 0 : Math.PI / 2, 0);
		transform.scale.set(panelLength / height, 1, 1);
		transform.updateMatrix();
		panels.setMatrixAt(i, transform.matrix);
	}
	panels.instanceMatrix.needsUpdate = true;
	panels.castShadow = true;
	panels.receiveShadow = true;
	scene.add(panels);
	if (addCollision) {
		fortressObstacles.push({
			minX: horizontal ? start : coordinate - thickness / 2,
			maxX: horizontal ? end : coordinate + thickness / 2,
			minZ: horizontal ? coordinate - thickness / 2 : start,
			maxZ: horizontal ? coordinate + thickness / 2 : end
		});
	}
}

function addSquareCornerPosts(radius, height, thickness, material = wallMat, addCollision = false) {
	const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(thickness, height, thickness), material, 4);
	const transform = new THREE.Object3D();
	let index = 0;
	for (const x of [-radius, radius]) {
		for (const z of [-radius, radius]) {
			transform.position.set(x, height / 2, z);
			transform.updateMatrix();
			posts.setMatrixAt(index++, transform.matrix);
			if (addCollision) fortressObstacles.push({ minX: x - thickness / 2, maxX: x + thickness / 2, minZ: z - thickness / 2, maxZ: z + thickness / 2 });
		}
	}
	posts.instanceMatrix.needsUpdate = true;
	posts.castShadow = true;
	posts.receiveShadow = true;
	scene.add(posts);
}

[-halfArena, halfArena].forEach(coordinate => {
	addPanelizedWallRun(true, coordinate, -halfArena + wallThickness / 2, halfArena - wallThickness / 2, wallHeight, wallThickness);
	addPanelizedWallRun(false, coordinate, -halfArena + wallThickness / 2, halfArena - wallThickness / 2, wallHeight, wallThickness);
});
addSquareCornerPosts(halfArena, wallHeight, wallThickness);

const gateFrameMat = new THREE.MeshStandardMaterial({ color: 0x728da7, metalness: 0.85, roughness: 0.24 });
const gateBarMat = new THREE.MeshStandardMaterial({ color: 0x174956, emissive: 0x007e89, emissiveIntensity: 0.55, metalness: 0.65, roughness: 0.28 });
const gateLockMat = new THREE.MeshStandardMaterial({ color: 0xffce68, emissive: 0xff9d28, emissiveIntensity: 0.8, metalness: 0.65, roughness: 0.2 });
const gateMat = gateBarMat;
const towerMat = new THREE.MeshStandardMaterial({ color: 0x263957, emissive: 0x102445, metalness: 0.8, roughness: 0.35 });

function addFortressWall(horizontal, coordinate, halfLength, gapCenter = null, gapSize = 0, height = fortressWallHeight, thickness = fortressWallThickness, material = wallMat) {
	const cornerTrim = thickness / 2;
	const segments = gapCenter === null
		? [[-halfLength + cornerTrim, halfLength - cornerTrim]]
		: [[-halfLength + cornerTrim, gapCenter - gapSize / 2], [gapCenter + gapSize / 2, halfLength - cornerTrim]];
	segments.forEach(([a, b]) => {
		if (b <= a) return;
		addPanelizedWallRun(horizontal, coordinate, a, b, height, thickness, material, true);
	});
}

function createGate(horizontal, x, z, width, label, collection, material = gateMat, height = fortressWallHeight, thickness = fortressWallThickness) {
	const gateMesh = new THREE.Group();
	gateMesh.position.set(x, 0, z);
	gateMesh.rotation.y = horizontal ? 0 : Math.PI / 2;
	const addGatePart = (geometry, partMaterial, localX, localY, localZ) => {
		const part = new THREE.Mesh(geometry, partMaterial);
		part.position.set(localX, localY, localZ);
		gateMesh.add(part);
	};
	const frameWidth = 2.4;
	const frameDepth = Math.max(2, thickness * 0.65);
	addGatePart(new THREE.BoxGeometry(frameWidth, height, frameDepth), gateFrameMat, -width / 2, height / 2, 0);
	addGatePart(new THREE.BoxGeometry(frameWidth, height, frameDepth), gateFrameMat, width / 2, height / 2, 0);
	addGatePart(new THREE.BoxGeometry(width + frameWidth, 2.4, frameDepth), gateFrameMat, 0, height - 1.2, 0);
	addGatePart(new THREE.BoxGeometry(width + frameWidth, 1.4, frameDepth), gateFrameMat, 0, 0.7, 0);
	const barCount = Math.max(5, Math.floor(width / 7));
	for (let i = 0; i < barCount; i++) {
		const along = -width / 2 + (i + 0.5) * width / barCount;
		addGatePart(new THREE.BoxGeometry(1.35, height - 4.2, frameDepth * 0.65), material, along, height / 2, 0);
	}
	const lock = new THREE.Mesh(new THREE.OctahedronGeometry(2.2, 0), gateLockMat);
	lock.position.set(0, height * 0.58, frameDepth * 0.6);
	gateMesh.add(lock);
	scene.add(gateMesh);
	const gate = {
		mesh: gateMesh,
		label,
		open: false,
		minX: x - (horizontal ? width : thickness) / 2,
		maxX: x + (horizontal ? width : thickness) / 2,
		minZ: z - (horizontal ? thickness : width) / 2,
		maxZ: z + (horizontal ? thickness : width) / 2
	};
	collection.push(gate);
	fortressObstacles.push(gate);
	return gate;
}

addFortressWall(false, -fortressOuterRadius, fortressOuterRadius, 0, gateWidth);
addFortressWall(false, fortressOuterRadius, fortressOuterRadius, 0, gateWidth);
addFortressWall(true, -fortressOuterRadius, fortressOuterRadius);
addFortressWall(true, fortressOuterRadius, fortressOuterRadius);
addSquareCornerPosts(fortressOuterRadius, fortressWallHeight, fortressWallThickness, wallMat, true);
createGate(false, -fortressOuterRadius, 0, gateWidth, 'puerta exterior oeste', fortressGates.outer);
createGate(false, fortressOuterRadius, 0, gateWidth, 'puerta exterior este', fortressGates.outer);

addFortressWall(true, -fortressInnerRadius, fortressInnerRadius, 0, gateWidth);
addFortressWall(true, fortressInnerRadius, fortressInnerRadius, 0, gateWidth);
addFortressWall(false, -fortressInnerRadius, fortressInnerRadius);
addFortressWall(false, fortressInnerRadius, fortressInnerRadius);
addSquareCornerPosts(fortressInnerRadius, fortressWallHeight, fortressWallThickness, wallMat, true);
createGate(true, 0, -fortressInnerRadius, gateWidth, 'puerta interior norte', fortressGates.inner);
createGate(true, 0, fortressInnerRadius, gateWidth, 'puerta interior sur', fortressGates.inner);

const towerHalfSize = 38;
const towerDoorWidth = 24;
addFortressWall(true, -towerHalfSize, towerHalfSize, 0, towerDoorWidth, 15, 6, towerMat);
addFortressWall(false, -towerHalfSize, towerHalfSize, 0, towerDoorWidth, 15, 6, towerMat);
addFortressWall(false, towerHalfSize, towerHalfSize, 0, towerDoorWidth, 15, 6, towerMat);
addFortressWall(true, towerHalfSize, towerHalfSize, 0, towerDoorWidth, 15, 6, towerMat);
addSquareCornerPosts(towerHalfSize, 15, 6, towerMat, true);
createGate(true, 0, -towerHalfSize, towerDoorWidth, 'puerta norte de la torre', fortressGates.portal, gateBarMat, 15, 6);
createGate(true, 0, towerHalfSize, towerDoorWidth, 'puerta sur de la torre', fortressGates.portal, gateBarMat, 15, 6);
createGate(false, -towerHalfSize, 0, towerDoorWidth, 'puerta oeste de la torre', fortressGates.portal, gateBarMat, 15, 6);
createGate(false, towerHalfSize, 0, towerDoorWidth, 'puerta este de la torre', fortressGates.portal, gateBarMat, 15, 6);
const towerSpire = new THREE.Mesh(new THREE.CylinderGeometry(11, 18, 30, 8), towerMat);
towerSpire.position.y = 28;
towerSpire.castShadow = true;
scene.add(towerSpire);
const towerCrown = new THREE.Mesh(new THREE.ConeGeometry(17, 18, 8), gateLockMat);
towerCrown.position.y = 52;
towerCrown.castShadow = true;
scene.add(towerCrown);

const portal = new THREE.Group();
const portalFaces = [];
const portalRings = [];
const portalCores = [];
const portalArcs = [];
const portalParticleFields = [];
const portalCoreMaterials = [];
const portalLocations = [
	{ x: 0, z: -towerHalfSize, rotation: Math.PI },
	{ x: 0, z: towerHalfSize, rotation: 0 },
	{ x: -towerHalfSize, z: 0, rotation: -Math.PI / 2 },
	{ x: towerHalfSize, z: 0, rotation: Math.PI / 2 }
];
portalLocations.forEach(location => {
	const face = new THREE.Group();
	face.position.set(location.x, 2.6, location.z);
	face.rotation.y = location.rotation;
	const outerFrame = new THREE.Mesh(
		new THREE.TorusGeometry(10.2, 0.42, 12, 64),
		new THREE.MeshStandardMaterial({ color: 0x5d32a8, emissive: 0x572cff, emissiveIntensity: 2.2, metalness: 0.65, roughness: 0.22 })
	);
	const ring = new THREE.Mesh(
		new THREE.TorusGeometry(8.9, 0.58, 14, 72),
		new THREE.MeshStandardMaterial({ color: 0x6bfff4, emissive: 0x00eaff, emissiveIntensity: 3.2, metalness: 0.25, roughness: 0.18 })
	);
	const innerRing = new THREE.Mesh(
		new THREE.TorusGeometry(7.9, 0.16, 8, 64),
		new THREE.MeshBasicMaterial({ color: 0xc8ffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending })
	);
	const arcMaterial = new THREE.MeshBasicMaterial({ color: 0xff4ce1, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
	const arcs = [];
	for (let arcIndex = 0; arcIndex < 3; arcIndex++) {
		const arc = new THREE.Mesh(new THREE.TorusGeometry(9.55, 0.24, 8, 48, Math.PI * 0.58), arcMaterial.clone());
		arc.rotation.z = arcIndex * (Math.PI * 2 / 3);
		arcs.push(arc);
	}
	const coreMaterial = new THREE.ShaderMaterial({
		uniforms: {
			uTime: { value: 0 },
			uCyan: { value: new THREE.Color(0x04f5d2) },
			uViolet: { value: new THREE.Color(0x673bff) },
			uPink: { value: new THREE.Color(0xff3fba) }
		},
		vertexShader: `
			varying vec2 vUv;
			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
		`,
		fragmentShader: `
			uniform float uTime;
			uniform vec3 uCyan;
			uniform vec3 uViolet;
			uniform vec3 uPink;
			varying vec2 vUv;
			void main() {
				vec2 p = vUv - 0.5;
				float radius = length(p) * 2.0;
				float angle = atan(p.y, p.x);
				float spiral = sin(angle * 5.0 - radius * 24.0 - uTime * 2.7);
				float ripples = sin(radius * 42.0 - angle * 3.0 - uTime * 4.0);
				float bands = sin(angle * 9.0 + radius * 18.0 + uTime * 1.8);
				vec3 color = mix(uViolet, uCyan, smoothstep(-0.65, 0.75, spiral + bands * 0.32));
				color = mix(color, uPink, smoothstep(0.35, 0.95, ripples + spiral * 0.28) * 0.55);
				float glow = 0.68 + 0.22 * sin(uTime * 2.2 + angle * 2.0);
				float alpha = (1.0 - smoothstep(0.72, 1.0, radius)) * glow;
				alpha *= 0.72 + 0.22 * abs(ripples);
				color += vec3(0.55, 0.85, 1.0) * pow(max(0.0, 1.0 - radius), 5.0);
				gl_FragColor = vec4(color, alpha);
			}
		`,
		transparent: true,
		depthWrite: false,
		side: THREE.DoubleSide,
		blending: THREE.AdditiveBlending
	});
	const core = new THREE.Mesh(new THREE.CircleGeometry(7.7, 64), coreMaterial);
	core.position.z = 0.04;
	innerRing.position.z = 0.06;
	outerFrame.position.z = -0.02;
	ring.position.z = 0.08;
	const particlePositions = new Float32Array(72 * 3);
	for (let i = 0; i < 72; i++) {
		const angle = Math.random() * Math.PI * 2;
		const radius = 1.2 + Math.random() * 6.2;
		particlePositions[i * 3] = Math.cos(angle) * radius;
		particlePositions[i * 3 + 1] = Math.sin(angle) * radius;
		particlePositions[i * 3 + 2] = 0.12 + Math.random() * 0.08;
	}
	const particleGeometry = new THREE.BufferGeometry();
	particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
	const particleField = new THREE.Points(particleGeometry, new THREE.PointsMaterial({ color: 0xb9ffff, size: 0.32, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
	face.add(outerFrame, ring, innerRing, core, ...arcs, particleField);
	portal.add(face);
	portalFaces.push(face);
	portalRings.push(ring);
	portalCores.push(core);
	portalArcs.push(...arcs);
	portalParticleFields.push(particleField);
	portalCoreMaterials.push(coreMaterial);
});
portal.visible = false;
scene.add(portal);

function setGateGroupOpen(gates, open) {
	gates.forEach(gate => {
		gate.open = open;
		gate.mesh.visible = !open;
	});
}

function isBlockedByFortress(x, z, radius = 0) {
	return fortressObstacles.some(obstacle => {
		if (obstacle.open) return false;
		const closestX = Math.max(obstacle.minX, Math.min(x, obstacle.maxX));
		const closestZ = Math.max(obstacle.minZ, Math.min(z, obstacle.maxZ));
		return (x - closestX) ** 2 + (z - closestZ) ** 2 < radius ** 2;
	});
}

function hasClearShot(from, to) {
	const distance = Math.hypot(to.x - from.x, to.z - from.z);
	const steps = Math.max(1, Math.ceil(distance));
	for (let i = 1; i < steps; i++) {
		const t = i / steps;
		if (isBlockedByFortress(from.x + (to.x - from.x) * t, from.z + (to.z - from.z) * t, 0.25)) return false;
	}
	return true;
}

// Grupo del tanque del jugador
const tankGroup = new THREE.Group();
const bodyGeo = new THREE.BoxGeometry(2.2, 1, 3.5);
const bodyMat = new THREE.MeshStandardMaterial({ color: 0x00ffcc, roughness: 0.3, metalness: 0.8 });
const body = new THREE.Mesh(bodyGeo, bodyMat);
body.position.y = 0.8;
body.castShadow = true;
tankGroup.add(body);

const trackGeo = new THREE.BoxGeometry(0.5, 0.8, 3.6);
const trackMat = new THREE.MeshStandardMaterial({ color: 0x1f2937 });
[-1.3, 1.3].forEach(x => {
	const track = new THREE.Mesh(trackGeo, trackMat);
	track.position.set(x, 0.6, 0);
	tankGroup.add(track);
});

const barrelGeo = new THREE.CylinderGeometry(0.15, 0.15, 2.2, 12);
barrelGeo.rotateX(Math.PI / 2);
const barrelMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.9 });

function updateTankBarrels() {
	tankGroup.remove(barrelsGroup);
	barrelsGroup = new THREE.Group();

	let count = stats.multishot.val;
	let spacing = 0.65;

	for (let i = 0; i < count; i++) {
		let xOffset = (i - (count - 1) / 2) * spacing;
		const barrel = new THREE.Mesh(barrelGeo, barrelMat);
		barrel.position.set(xOffset, 1.2, -1.8);
		barrelsGroup.add(barrel);
	}
	tankGroup.add(barrelsGroup);
}
updateTankBarrels();
scene.add(tankGroup);

// Configuración de esferas objetivo
const spheres = [];
const sphereGeo = new THREE.SphereGeometry(1.2, 16, 16);

const sphereTypes = [
	{ name: 'Núcleo estático', color: 0x00ffaa, emissive: 0x00ffaa, reward: 50, hp: 6, behavior: 'static' },
	{ name: 'Esfera vectorial', color: 0xffaa00, emissive: 0xffaa00, reward: 150, hp: 18, behavior: 'straight' },
	{ name: 'Orbe de vórtice', color: 0xff0055, emissive: 0xff0055, reward: 350, hp: 40, behavior: 'circular' }
];

function createHealthBar() {
	const canvas = document.createElement('canvas');
	canvas.width = 64;
	canvas.height = 12;
	const context = canvas.getContext('2d');
	const texture = new THREE.CanvasTexture(canvas);
	const material = new THREE.SpriteMaterial({ map: texture });
	const sprite = new THREE.Sprite(material);
	sprite.scale.set(1.5, 0.3, 1);
	sprite.position.y = 1.8;
	return { sprite, canvas, context, texture, material };
}

function updateHealthBar(target) {
	const { canvas, context, texture } = target.hpBar;
	context.clearRect(0, 0, canvas.width, canvas.height);
	context.fillStyle = 'rgba(0,0,0,0.6)';
	context.fillRect(0, 0, canvas.width, canvas.height);
	const pct = Math.max(0, target.hp / target.maxHp);
	context.fillStyle = '#00ff88';
	context.fillRect(2, 2, (canvas.width - 4) * pct, canvas.height - 4);
	texture.needsUpdate = true;
}

function disposeHealthBar(hpBar) {
	if (hpBar) {
		if (hpBar.texture) hpBar.texture.dispose();
		if (hpBar.material) hpBar.material.dispose();
	}
}

function disposeFortressTank(tank) {
	disposeHealthBar(tank.userData.hpBar);
	const materials = new Set();
	tank.traverse(child => {
		if (child.material && child.material !== barrelMat && child.material !== trackMat) materials.add(child.material);
	});
	materials.forEach(material => material.dispose());
}

function spawnSingleSphere() {
	const typeConfig = sphereTypes[Math.floor(Math.random() * sphereTypes.length)];
	const mat = new THREE.MeshStandardMaterial({ 
		color: typeConfig.color, 
		emissive: typeConfig.emissive, 
		emissiveIntensity: 0.6 
	});
	const mesh = new THREE.Mesh(sphereGeo, mat);
	
	let x, z;
	do {
		x = (Math.random() - 0.5) * spawnRange;
		z = (Math.random() - 0.5) * spawnRange;
	} while (Math.abs(x) < fortressOuterRadius + 60 && Math.abs(z) < fortressOuterRadius + 60);
	mesh.position.set(x, 1.5, z);

	const hpBarData = createHealthBar();
	mesh.add(hpBarData.sprite);

	mesh.userData = {
		isBot: false,
		name: typeConfig.name,
		color: typeConfig.color,
		reward: typeConfig.reward,
		behavior: typeConfig.behavior,
		hp: typeConfig.hp,
		maxHp: typeConfig.hp,
		contactCooldown: 0,
		hpBar: hpBarData,
		baseX: x,
		baseZ: z,
		angle: Math.random() * Math.PI * 2,
		floatOffset: Math.random() * 10
	};

	updateHealthBar(mesh.userData);
	scene.add(mesh);
	spheres.push(mesh);
}

// Configuración de tanques enemigos
const enemyBots = [];
const fortressTanks = [];
const tankCollisionDistance = 8.5;
const tankPos = new THREE.Vector3(0, 0, halfArena - 40);
const enemyBodyMat = new THREE.MeshStandardMaterial({ color: 0xff3344, roughness: 0.3, metalness: 0.8 });
const enemyBulletMat = new THREE.MeshBasicMaterial({ color: 0xff3344 });

function isTankPositionBlocked(x, z, movingTank = null, ignoredTanks = []) {
	if (movingTank !== tankGroup && Math.hypot(x - tankPos.x, z - tankPos.z) < tankCollisionDistance) return true;
	return [...enemyBots, ...fortressTanks].some(tank =>
		tank !== movingTank && !ignoredTanks.includes(tank) && Math.hypot(x - tank.position.x, z - tank.position.z) < tankCollisionDistance
	);
}

function randomOutsideFortressPosition() {
	let x, z;
	do {
		x = (Math.random() - 0.5) * spawnRange;
		z = (Math.random() - 0.5) * spawnRange;
	} while (Math.abs(x) < fortressOuterRadius + 35 && Math.abs(z) < fortressOuterRadius + 35);
	return { x, z };
}

function spawnSingleEnemyBot() {
	if (enemyBots.length >= enemyBotCount) return;

	const botGroup = new THREE.Group();
	const bBody = new THREE.Mesh(bodyGeo, enemyBodyMat);
	bBody.position.y = 0.8;
	bBody.castShadow = true;
	botGroup.add(bBody);

	[-1.3, 1.3].forEach(x => {
		const track = new THREE.Mesh(trackGeo, trackMat);
		track.position.set(x, 0.6, 0);
		botGroup.add(track);
	});

	const bBarrel = new THREE.Mesh(barrelGeo, barrelMat);
	bBarrel.position.set(0, 1.2, -1.8);
	botGroup.add(bBarrel);

	let position = randomOutsideFortressPosition();
	let attempts = 0;
	while (attempts < 80 && isTankPositionBlocked(position.x, position.z)) {
		position = randomOutsideFortressPosition();
		attempts++;
	}
	const { x, z } = position;
	botGroup.position.set(x, 0, z);

	const hpBarData = createHealthBar();
	hpBarData.sprite.position.y = 2.5;
	botGroup.add(hpBarData.sprite);

	botGroup.userData = {
		isBot: true,
		name: 'Tanque enemigo',
		color: 0xff3344,
		reward: 500,
		hp: 18,
		maxHp: 18,
		hpBar: hpBarData,
		baseX: x,
		baseZ: z,
		patrolAngle: Math.random() * Math.PI * 2,
		shootTimer: Math.floor(Math.random() * 90),
		bulletSpeed: 2.2,
		fireCadence: 112
	};

	updateHealthBar(botGroup.userData);
	scene.add(botGroup);
	enemyBots.push(botGroup);
}

function spawnSpheres(count) {
	for (let i = 0; i < count; i++) spawnSingleSphere();
}
spawnSpheres(sphereCount);
for (let i = 0; i < enemyBotCount; i++) spawnSingleEnemyBot();

const patrolPairs = [];
let lastPatrolUpdateTime = performance.now();
let bossTank = null;
let bossDefeated = false;
let isGameWon = false;

function createFortressTank(config) {
	const tank = new THREE.Group();
	const bodyMaterial = new THREE.MeshStandardMaterial({ color: config.color, roughness: 0.3, metalness: 0.8, emissive: config.emissive || 0x000000, emissiveIntensity: 0.15 });
	const tankBody = new THREE.Mesh(bodyGeo, bodyMaterial);
	tankBody.position.y = 0.8;
	tankBody.castShadow = true;
	tank.add(tankBody);
	[-1.3, 1.3].forEach(x => {
		const track = new THREE.Mesh(trackGeo, trackMat);
		track.position.set(x, 0.6, 0);
		tank.add(track);
	});
	const turretGroup = new THREE.Group();
	const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.65, 12), bodyMaterial);
	turret.position.y = 1.35;
	turretGroup.add(turret);
	const barrelSpacing = 0.58;
	for (let i = 0; i < config.barrels; i++) {
		const barrel = new THREE.Mesh(barrelGeo, barrelMat);
		barrel.position.set((i - (config.barrels - 1) / 2) * barrelSpacing, 1.45, -1.6);
		turretGroup.add(barrel);
	}
	tank.add(turretGroup);
	const hpBarData = createHealthBar();
	hpBarData.sprite.position.y = 2.8;
	hpBarData.sprite.scale.set(2.4, 0.42, 1);
	tank.add(hpBarData.sprite);
	tank.userData = { ...config, isFortress: true, turret: turretGroup, hpBar: hpBarData, shootTimer: config.shootTimer ?? Math.floor(Math.random() * config.cadence), fireCadence: config.cadence, bulletSpeed: config.bulletSpeed, maxHp: config.hp };
	if (config.isBoss) {
		const aura = new THREE.Mesh(
			new THREE.TorusGeometry(5.2, 0.14, 8, 48),
			new THREE.MeshBasicMaterial({ color: 0xff315f, transparent: true, opacity: 0.7, depthWrite: false })
		);
		aura.rotation.x = Math.PI / 2;
		aura.position.y = 0.18;
		tank.add(aura);
		const coreLight = new THREE.PointLight(0xff315f, 1.6, 42);
		coreLight.position.set(0, 3, 0);
		tank.add(coreLight);
		tank.userData.bossAura = aura;
	}
	updateHealthBar(tank.userData);
	scene.add(tank);
	fortressTanks.push(tank);
	return tank;
}

function getSquarePatrolPosition(radius, distance) {
	const perimeter = radius * 8;
	const d = ((distance % perimeter) + perimeter) % perimeter;
	if (d < radius * 2) return { x: -radius + d, z: -radius };
	if (d < radius * 4) return { x: radius, z: -radius + (d - radius * 2) };
	if (d < radius * 6) return { x: radius - (d - radius * 4), z: radius };
	return { x: -radius, z: radius - (d - radius * 6) };
}

function createPatrolPair(config) {
	const pair = { ...config, progress: 0, decisionTimer: 0, directionLock: 0, patrolMoving: true, members: [] };
	for (let slot = 0; slot < 2; slot++) {
		const tank = createFortressTank({ name: config.name, color: config.color, emissive: config.emissive, reward: config.reward, hp: config.hp, barrels: config.barrels, cadence: config.cadence, shootTimer: slot * config.cadence * 0.5, bulletSpeed: config.bulletSpeed, pair, slot, patrolAngle: slot * Math.PI });
		pair.members.push(tank);
	}
	const perimeter = pair.radius * 8;
	const startSearchSteps = Math.ceil(perimeter / tankCollisionDistance);
	let startProgress = 0;
	for (let attempt = 0; attempt < startSearchSteps; attempt++) {
		const candidateProgress = attempt * perimeter / startSearchSteps;
		const positions = pair.members.map(tank => getSquarePatrolPosition(pair.radius, candidateProgress + tank.userData.slot * pair.radius * 4));
		const pairOverlaps = Math.hypot(positions[0].x - positions[1].x, positions[0].z - positions[1].z) < tankCollisionDistance;
		const blocked = pairOverlaps || positions.some(position => isTankPositionBlocked(position.x, position.z, null, pair.members));
		if (!blocked) {
			startProgress = candidateProgress;
			break;
		}
	}
	// Mantener sincronizados el progreso y las posiciones incluso si el inicio está concurrido.
	pair.progress = startProgress;
	for (const tank of pair.members) {
		const progress = pair.progress + tank.userData.slot * pair.radius * 4;
		const position = getSquarePatrolPosition(pair.radius, progress);
		const next = getSquarePatrolPosition(pair.radius, progress + 2);
		tank.position.set(position.x, 0, position.z);
		tank.rotation.y = Math.atan2(-(next.x - position.x), -(next.z - position.z));
	}
	patrolPairs.push(pair);
	return pair;
}

function setupFortressEncounter() {
	createPatrolPair({ name: 'Centinela exterior', color: 0xff9f1c, emissive: 0x5c2800, reward: 1500, hp: 110, barrels: 2, cadence: 82, bulletSpeed: 3.2, radius: fortressOuterRadius + 42, direction: 1, patrolSpeed: 0.28, detectRange: 150 });
	createPatrolPair({ name: 'Guardián del corredor', color: 0xb44cff, emissive: 0x31005c, reward: 2500, hp: 180, barrels: 3, cadence: 58, bulletSpeed: 4.5, radius: (fortressOuterRadius + fortressInnerRadius) / 2, direction: -1, patrolSpeed: 0.22, detectRange: 130 });
}
setupFortressEncounter();

function spawnBoss() {
	if (bossTank || bossDefeated) return;
	bossTank = createFortressTank({ name: 'Señor de la Ciudadela', color: 0xff315f, emissive: 0x700020, reward: 8000, hp: 440, barrels: 4, cadence: 54, bulletSpeed: 5.5, isBoss: true, shootTimer: 30 });
	// Mantener al jefe en el patio sin que aparezca sobre el jugador u otro tanque.
	const spawnCandidates = [{ x: 105, z: 0 }, { x: -105, z: 0 }, { x: 0, z: 105 }, { x: 0, z: -105 }];
	const spawn = spawnCandidates.find(position => !isTankPositionBlocked(position.x, position.z, bossTank));
	if (spawn) bossTank.position.set(spawn.x, 0, spawn.z);
}

function getEnemyTankMuzzles(tank, targetAngle) {
	const barrelCount = tank.userData.barrels || 1;
	const direction = new THREE.Vector3(-Math.sin(targetAngle), 0, -Math.cos(targetAngle));
	const barrelRight = new THREE.Vector3(Math.cos(targetAngle), 0, -Math.sin(targetAngle));
	const barrelForwardOffset = tank.userData.isFortress ? 2.7 : 2.9;
	const muzzlePositions = [];
	for (let i = 0; i < barrelCount; i++) {
		const lateralOffset = (i - (barrelCount - 1) / 2) * 0.58;
		const muzzle = tank.position.clone();
		muzzle.y = 1.5;
		muzzle.addScaledVector(direction, barrelForwardOffset).addScaledVector(barrelRight, lateralOffset);
		muzzlePositions.push(muzzle);
	}
	return { direction, muzzlePositions };
}

function hasEnemyTankClearShot(tank) {
	const dx = tankPos.x - tank.position.x;
	const dz = tankPos.z - tank.position.z;
	const targetAngle = Math.atan2(-dx, -dz);
	const distance = Math.hypot(dx, dz);
	const { direction, muzzlePositions } = getEnemyTankMuzzles(tank, targetAngle);
	return muzzlePositions.some(muzzle => {
		const rayEnd = muzzle.clone().addScaledVector(direction, distance);
		return hasClearShot(muzzle, rayEnd);
	});
}

function moveBossTowardPlayer(boss, frameScale) {
	const dx = tankPos.x - boss.position.x;
	const dz = tankPos.z - boss.position.z;
	const distance = Math.hypot(dx, dz);
	if (distance === 0 || (distance <= 96 && hasEnemyTankClearShot(boss))) return;
	const forwardX = dx / distance;
	const forwardZ = dz / distance;
	const side = boss.userData.chaseSide || 1;
	const directions = distance > 96 ? [
		{ x: forwardX, z: forwardZ },
		{ x: -forwardZ * side, z: forwardX * side },
		{ x: forwardZ * side, z: -forwardX * side }
	] : [
		{ x: -forwardZ * side, z: forwardX * side },
		{ x: forwardZ * side, z: -forwardX * side }
	];
	const step = 0.18 * frameScale;
	const arenaLimit = fortressInnerRadius - 14;
	for (let index = 0; index < directions.length; index++) {
		const direction = directions[index];
		const nextX = boss.position.x + direction.x * step;
		const nextZ = boss.position.z + direction.z * step;
		if (Math.abs(nextX) > arenaLimit || Math.abs(nextZ) > arenaLimit ||
			isBlockedByFortress(nextX, nextZ, 4) || isTankPositionBlocked(nextX, nextZ, boss)) continue;
		boss.position.x = nextX;
		boss.position.z = nextZ;
		boss.rotation.y = Math.atan2(-direction.x, -direction.z);
		boss.userData.chaseSide = index === 0 ? side : -side;
		return;
	}
	boss.userData.chaseSide = -side;
}

function updateFortressPatrols(frameScale = 1) {
	patrolPairs.forEach(pair => {
		const activeMembers = pair.members.filter(tank => fortressTanks.includes(tank));
		if (!activeMembers.length) return;
		const engaged = activeMembers.some(tank => Math.hypot(tank.position.x - tankPos.x, tank.position.z - tankPos.z) <= pair.detectRange && hasEnemyTankClearShot(tank));
		activeMembers.forEach(tank => {
			if (!tank.userData.turret) return;
			const distance = Math.hypot(tank.position.x - tankPos.x, tank.position.z - tankPos.z);
			if (distance <= pair.detectRange) {
				const targetAngle = Math.atan2(-(tankPos.x - tank.position.x), -(tankPos.z - tank.position.z));
				tank.userData.turret.rotation.y = targetAngle - tank.rotation.y;
			} else {
				// La rotación cero de la torreta sigue la orientación frontal del tanque.
				tank.userData.turret.rotation.y = 0;
			}
		});
		let patrolMoving = true;
		if (engaged) {
			pair.directionLock = Math.max(0, pair.directionLock - frameScale);
			if (pair.decisionTimer <= 0) {
				const scoreAt = progress => activeMembers.reduce((total, tank) => {
					const position = getSquarePatrolPosition(pair.radius, progress + tank.userData.slot * pair.radius * 4);
					return total + Math.hypot(position.x - tankPos.x, position.z - tankPos.z);
				}, 0);
				const currentScore = scoreAt(pair.progress);
				const lookahead = pair.patrolSpeed * 24;
				const currentDirectionScore = scoreAt(pair.progress + pair.direction * lookahead);
				const reverseDirectionScore = scoreAt(pair.progress - pair.direction * lookahead);
				const improvementMargin = 5;
				if (currentScore - currentDirectionScore > improvementMargin) {
					patrolMoving = true;
				} else if (currentScore - reverseDirectionScore > improvementMargin) {
					if (pair.directionLock === 0) {
						pair.direction *= -1;
						pair.directionLock = 90;
					}
					// Si la inversión aún está bloqueada, continuar la ruta actual evita congelarse.
					patrolMoving = true;
				} else {
					patrolMoving = false;
				}
				pair.decisionTimer = 24;
			} else {
				pair.decisionTimer -= frameScale;
				patrolMoving = pair.patrolMoving;
			}
			pair.patrolMoving = patrolMoving;
		} else {
			pair.decisionTimer = 0;
			pair.directionLock = 0;
			pair.patrolMoving = true;
		}
		// Reevaluar periódicamente con un margen permite detenerse o invertir
		// hacia el jugador sin reaccionar a pequeños cambios de distancia.
		const directions = patrolMoving ? [pair.direction, -pair.direction] : [];
		let nextProgress = pair.progress;
		let nextPositions = null;
		for (const direction of directions) {
			const candidateProgress = pair.progress + direction * pair.patrolSpeed * frameScale;
			const candidates = activeMembers.map(tank => ({
				tank,
				position: getSquarePatrolPosition(pair.radius, candidateProgress + tank.userData.slot * pair.radius * 4)
			}));
			const blocked = candidates.some(({ tank, position }) =>
				isTankPositionBlocked(position.x, position.z, tank, pair.members)
			) || candidates.some(({ position }, index) => candidates.slice(index + 1).some(other =>
				Math.hypot(position.x - other.position.x, position.z - other.position.z) < tankCollisionDistance
			));
			if (!blocked) {
				nextProgress = candidateProgress;
				nextPositions = candidates;
				pair.direction = direction;
				break;
			}
		}
		if (nextPositions) {
			pair.progress = nextProgress;
			nextPositions.forEach(({ tank, position }) => {
				tank.position.set(position.x, 0, position.z);
				// Mantener la orientación según el sentido base de la ruta; al invertir
				// el movimiento, el tanque retrocede en lugar de girar bruscamente.
				const next = getSquarePatrolPosition(pair.radius, nextProgress + tank.userData.slot * pair.radius * 4 + 2);
				tank.rotation.y = Math.atan2(-(next.x - position.x), -(next.z - position.z));
			});
		}
		activeMembers.forEach(tank => {
			const inRange = Math.hypot(tank.position.x - tankPos.x, tank.position.z - tankPos.z) <= pair.detectRange;
			if (inRange && hasEnemyTankClearShot(tank)) {
				tank.userData.shootTimer += frameScale;
				if (tank.userData.shootTimer >= tank.userData.fireCadence) {
					tank.userData.shootTimer -= tank.userData.fireCadence;
					fireEnemyTank(tank);
				}
			}
		});
	});
}

function fireEnemyTank(tank) {
	const targetAngle = Math.atan2(-(tankPos.x - tank.position.x), -(tankPos.z - tank.position.z));
	if (tank.userData.turret) tank.userData.turret.rotation.y = targetAngle - tank.rotation.y;
	const { direction, muzzlePositions } = getEnemyTankMuzzles(tank, targetAngle);
	const distance = Math.hypot(tankPos.x - tank.position.x, tankPos.z - tank.position.z);
	const clearMuzzles = muzzlePositions.filter(muzzle => hasClearShot(muzzle, muzzle.clone().addScaledVector(direction, distance)));
	if (!clearMuzzles.length) return;
	playSound('enemyShoot');
	for (const muzzle of clearMuzzles) {
		const bullet = new THREE.Mesh(bulletGeo, new THREE.MeshBasicMaterial({ color: tank.userData.color }));
		bullet.position.copy(muzzle);
		bullet.userData = { isEnemy: true, velocity: direction.clone().multiplyScalar(tank.userData.bulletSpeed), life: 400, startX: muzzle.x, startZ: muzzle.z, maxDist: 850 };
		scene.add(bullet);
		bullets.push(bullet);
	}
}

function updateFortressProgression() {
	const outerPair = patrolPairs[0];
	const innerPair = patrolPairs[1];
	if (outerPair && !outerPair.members.some(tank => fortressTanks.includes(tank)) && !fortressGates.outer[0].open) {
		setGateGroupOpen(fortressGates.outer, true);
		showNotification('¡Se abrieron las puertas exteriores!');
		updateObjectiveUI();
	}
	if (innerPair && !innerPair.members.some(tank => fortressTanks.includes(tank)) && !fortressGates.inner[0].open) {
		setGateGroupOpen(fortressGates.inner, true);
		showNotification('¡Se abrieron las puertas de la ciudadela!');
		spawnBoss();
		updateObjectiveUI();
	}
}

function updateObjectiveUI() {
	const objective = document.getElementById('objective');
	if (!objective) return;
	if (bossDefeated) objective.innerText = 'Entra en el portal de la torre para ganar.';
	else if (bossTank) objective.innerText = 'Derrota al Señor de la Ciudadela; el portal se abrirá al vencerlo.';
	else if (fortressGates.inner[0].open) objective.innerText = 'Entra al patio y derrota al Señor de la Ciudadela.';
	else if (fortressGates.outer[0].open) objective.innerText = 'Derrota a los dos Guardianes del corredor para abrir la ciudadela.';
	else objective.innerText = 'Derrota a los dos Centinelas exteriores para abrir la fortaleza.';
}
updateObjectiveUI();

// Balas y partículas
const bullets = [];
const bulletRadius = 0.25;
const bulletGeo = new THREE.SphereGeometry(bulletRadius, 8, 8);
const bulletWallLimit = halfArena - wallThickness / 2 - bulletRadius;
const bulletMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });

const particles = [];
const particleGeo = new THREE.SphereGeometry(0.12, 4, 4);
const hitParticleMaterials = new Map();

function spawnHitParticles(pos, colorHex) {
	if (!hitParticleMaterials.has(colorHex)) hitParticleMaterials.set(colorHex, new THREE.MeshBasicMaterial({ color: colorHex }));
	const mat = hitParticleMaterials.get(colorHex);
	for (let i = 0; i < 6; i++) {
		const p = new THREE.Mesh(particleGeo, mat);
		p.position.copy(pos);
		const angle = Math.random() * Math.PI * 2;
		const speed = 0.1 + Math.random() * 0.2;
		p.userData = {
			vel: new THREE.Vector3(Math.cos(angle) * speed, (Math.random() - 0.5) * 0.2, Math.sin(angle) * speed),
			life: 20
		};
		scene.add(p);
		particles.push(p);
	}
}

const wallParticleMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });

function spawnWallHitParticles(pos) {
	const impact = pos.clone();
	impact.x = Math.max(-bulletWallLimit, Math.min(bulletWallLimit, impact.x));
	impact.z = Math.max(-bulletWallLimit, Math.min(bulletWallLimit, impact.z));
	for (let i = 0; i < 10; i++) {
		const p = new THREE.Mesh(particleGeo, wallParticleMat);
		p.position.copy(impact);
		const angle = Math.random() * Math.PI * 2;
		const speed = 0.12 + Math.random() * 0.22;
		p.userData = {
			vel: new THREE.Vector3(Math.cos(angle) * speed, 0.04 + Math.random() * 0.2, Math.sin(angle) * speed),
			life: 18 + Math.floor(Math.random() * 10)
		};
		scene.add(p);
		particles.push(p);
	}
}

// Estado de controles
const keys = { forward: false, backward: false, left: false, right: false };
let shootTimer = 0;

function finishGame(won) {
	if (isGameOver || isEnding) return;
	isEnding = true;
	isGameOver = true;
	isEnding = false;
	isGameWon = won;
	Object.keys(keys).forEach(key => { keys[key] = false; });
	if (document.exitPointerLock) document.exitPointerLock();
	document.getElementById('gameover-title').innerText = won ? '¡FORTALEZA CONQUISTADA!' : 'PARTIDA TERMINADA';
	document.getElementById('gameover-message').innerText = won
		? 'Derrotaste al Señor de la Ciudadela y entraste en el portal de la torre.'
		: 'Tu tanque fue destruido en combate.';
	document.getElementById('stat-targets').innerText = targetsDestroyedCount;
	document.getElementById('stat-bots').innerText = botsDestroyedCount;
	const gameover = document.getElementById('gameover');
	gameover.classList.toggle('victory', won);
	gameover.style.display = 'flex';
	gameover.classList.add('visible');
}

function updatePortalCountdown(frameScale) {
	const countdown = document.getElementById('portal-countdown');
	const countdownSeconds = document.getElementById('portal-countdown-seconds');
	const isInsidePortal = portalLocations.some(location =>
		Math.hypot(tankPos.x - location.x, tankPos.z - location.z) <= 10
	);
	if (!bossDefeated || !isInsidePortal || isEnding || isGameOver) {
		portalCountdownRemaining = 0;
		if (countdown) countdown.hidden = true;
		return;
	}
	if (portalCountdownRemaining <= 0) portalCountdownRemaining = 5;
	portalCountdownRemaining = Math.max(0, portalCountdownRemaining - frameScale / 60);
	if (countdown) countdown.hidden = false;
	if (countdownSeconds) countdownSeconds.textContent = String(Math.ceil(portalCountdownRemaining));
	if (portalCountdownRemaining <= 0) {
		if (countdown) countdown.hidden = true;
		finishGame(true);
	}
}

window.addEventListener('keydown', (e) => {
	if (['w','W','ArrowUp'].includes(e.key)) keys.forward = true;
	if (['s','S','ArrowDown'].includes(e.key)) keys.backward = true;
	if (['a','A','ArrowLeft'].includes(e.key)) keys.left = true;
	if (['d','D','ArrowRight'].includes(e.key)) keys.right = true;
});

window.addEventListener('keyup', (e) => {
	if (['w','W','ArrowUp'].includes(e.key)) keys.forward = false;
	if (['s','S','ArrowDown'].includes(e.key)) keys.backward = false;
	if (['a','A','ArrowLeft'].includes(e.key)) keys.left = false;
	if (['d','D','ArrowRight'].includes(e.key)) keys.right = false;
});

window.restartGame = function() {
	if (endgameTimeout !== null) clearTimeout(endgameTimeout);
	endgameTimeout = null;
	cash = 0;
	playerHp = 100;
	maxPlayerHp = 100;
	isGameOver = false;
	isEnding = false;
	isGameWon = false;
	bossDefeated = false;
	bossTank = null;
	targetsDestroyedCount = 0;
	botsDestroyedCount = 0;
	sphereRewardsPaid = 0;
	enemyBotRewardsPaid = 0;
	screenShake = 0;
	shootTimer = 0;
	lowHpTimer = 0;
	playerDamageCooldown = 0;
	portalCountdownRemaining = 0;
	lastPatrolUpdateTime = performance.now();
	camYaw = 0;
	camPitch = 0.4;
	camDist = 9;
	Object.keys(keys).forEach(key => { keys[key] = false; });

	document.getElementById('cash').innerText = cash;
	updatePlayerHpUI();
	document.getElementById('gameover').style.display = 'none';
	document.getElementById('gameover').classList.remove('victory', 'visible');

	tankPos.set(0, 0, halfArena - 40);

	stats.speed = { level: 1, maxLevel: 5, cost: 100, val: 0.55, mult: 1.55 };
	stats.rate = { level: 1, maxLevel: 5, cost: 125, val: 12, bulletSpeed: 4.5, mult: 1.6 };
	stats.multishot = { level: 1, cost: 1500, val: 1, max: 4, mult: 1.6 };
	stats.maxHp = { level: 1, maxLevel: 3, cost: 200, val: 100, mult: 1.6 };

	const multishotBtn = document.getElementById('btn-multishot');
	multishotBtn.disabled = false;
	updateMultishotUpgradeButton();
	document.getElementById('btn-speed').innerHTML = 'Velocidad del tanque ($<span id="cost-speed">100</span>)';
	document.getElementById('btn-rate').innerHTML = 'Cadencia y velocidad de tiro ($<span id="cost-rate">125</span>)';
	document.getElementById('btn-maxhp').innerHTML = 'Aumento de vida máxima ($<span id="cost-maxHp">200</span>)';
	document.getElementById('cost-speed').innerText = stats.speed.cost;
	document.getElementById('cost-rate').innerText = stats.rate.cost;
	document.getElementById('cost-multishot').innerText = stats.multishot.cost;
	document.getElementById('cost-maxHp').innerText = stats.maxHp.cost;
	document.getElementById('btn-speed').disabled = false;
	document.getElementById('btn-rate').disabled = false;
	document.getElementById('btn-maxhp').disabled = false;

	updateTankBarrels();

	spheres.forEach(s => {
		disposeHealthBar(s.userData.hpBar);
		scene.remove(s);
		s.material.dispose();
	});
	spheres.length = 0;
	spawnSpheres(sphereCount);

	enemyBots.forEach(b => {
		disposeHealthBar(b.userData.hpBar);
		scene.remove(b);
	});
	enemyBots.length = 0;
	for (let i = 0; i < enemyBotCount; i++) spawnSingleEnemyBot();

	fortressTanks.forEach(tank => {
		disposeFortressTank(tank);
		scene.remove(tank);
	});
	fortressTanks.length = 0;
	patrolPairs.length = 0;
	setupFortressEncounter();
	setGateGroupOpen(fortressGates.outer, false);
	setGateGroupOpen(fortressGates.inner, false);
	setGateGroupOpen(fortressGates.portal, false);
	portal.visible = false;
	portalRings.forEach(ring => { ring.rotation.set(0, 0, 0); });
	portalCores.forEach(core => { core.rotation.set(0, 0, 0); });
	portalArcs.forEach(arc => { arc.rotation.set(0, 0, 0); });
	portalParticleFields.forEach(field => { field.rotation.set(0, 0, 0); });
	portalCoreMaterials.forEach(material => { material.uniforms.uTime.value = 0; });
	document.getElementById('portal-countdown').hidden = true;
	updateObjectiveUI();

	bullets.forEach(b => {
		scene.remove(b);
		if (b.userData.isEnemy) b.material.dispose();
	});
	bullets.length = 0;
	particles.forEach(p => scene.remove(p));
	particles.length = 0;
};

// Bucle de animación
function animate() {
	requestAnimationFrame(animate);
	const patrolNow = performance.now();
	const frameScale = Math.min(2, Math.max(0, (patrolNow - lastPatrolUpdateTime) / (1000 / 60)));
	lastPatrolUpdateTime = patrolNow;
	if (isGameOver) return;

	if (playerDamageCooldown > 0) playerDamageCooldown = Math.max(0, playerDamageCooldown - frameScale);
	if (!isEnding && playerHp < maxPlayerHp) {
		playerHp = Math.min(maxPlayerHp, playerHp + 0.025 * frameScale);
		updatePlayerHpUI();
	}

	// Alerta de vida baja fija (<= 25 de vida)
	if (playerHp <= 25) {
		lowHpTimer += frameScale;
		if (lowHpTimer >= 45) {
			lowHpTimer = 0;
			playSound('lowHp');
		}
	}

	const tankAngle = camYaw;
	scratchForward.set(-Math.sin(tankAngle), 0, -Math.cos(tankAngle));
	scratchRight.set(Math.cos(tankAngle), 0, -Math.sin(tankAngle));

	scratchMove.set(0, 0, 0);
	if (keys.forward) scratchMove.add(scratchForward);
	if (keys.backward) scratchMove.sub(scratchForward);
	if (keys.right) scratchMove.add(scratchRight);
	if (keys.left) scratchMove.sub(scratchRight);

	if (!isEnding && scratchMove.lengthSq() > 0) {
		scratchMove.normalize().multiplyScalar(stats.speed.val * frameScale);
		const nextX = tankPos.x + scratchMove.x;
		const nextZ = tankPos.z + scratchMove.z;
		if (!isBlockedByFortress(nextX, tankPos.z, 3) && !isTankPositionBlocked(nextX, tankPos.z, tankGroup)) tankPos.x = nextX;
		if (!isBlockedByFortress(tankPos.x, nextZ, 3) && !isTankPositionBlocked(tankPos.x, nextZ, tankGroup)) tankPos.z = nextZ;
	}

	const margin = 5;
	tankPos.x = Math.max(-halfArena + margin, Math.min(halfArena - margin, tankPos.x));
	tankPos.z = Math.max(-halfArena + margin, Math.min(halfArena - margin, tankPos.z));
	tankPos.y = 0;

	tankGroup.position.copy(tankPos);
	tankGroup.rotation.set(0, tankAngle, 0);
	tankGroup.updateMatrixWorld();

	shootTimer += frameScale;
	if (!isEnding && shootTimer > stats.rate.val) {
		shootTimer = 0;
		let count = stats.multishot.val;
		let spacing = 0.65;
		playSound('shoot');

		for (let i = 0; i < count; i++) {
			let xOffset = (i - (count - 1) / 2) * spacing;
			let localBarrelPos = new THREE.Vector3(xOffset, 1.2, -3.0);
			let worldBarrelPos = localBarrelPos.applyMatrix4(tankGroup.matrixWorld);

			const bullet = new THREE.Mesh(bulletGeo, bulletMat);
			bullet.position.set(worldBarrelPos.x, 1.5, worldBarrelPos.z);
			
			const dir = scratchForward.clone();
			
			bullet.userData = { 
				isEnemy: false,
				velocity: dir.multiplyScalar(stats.rate.bulletSpeed), 
				life: 300,
				startX: bullet.position.x,
				startZ: bullet.position.z,
				maxDist: 600
			};
			scene.add(bullet);
			bullets.push(bullet);
		}
	}

	let shakeX = 0, shakeY = 0, shakeZ = 0;
	if (screenShake > 0) {
		shakeX = (Math.random() - 0.5) * screenShake;
		shakeY = (Math.random() - 0.5) * screenShake;
		shakeZ = (Math.random() - 0.5) * screenShake;
		screenShake *= Math.pow(0.85, frameScale);
		if (screenShake < 0.02) screenShake = 0;
	}

	const targetCamX = tankPos.x + Math.sin(camYaw) * Math.cos(camPitch) * camDist + shakeX;
	const targetCamY = tankPos.y + 1.2 + Math.sin(camPitch) * camDist + shakeY;
	const targetCamZ = tankPos.z + Math.cos(camYaw) * Math.cos(camPitch) * camDist + shakeZ;

	camera.position.set(targetCamX, Math.max(1.2, targetCamY), targetCamZ);
	camera.lookAt(tankPos.x, tankPos.y + 1.2, tankPos.z);

	const time = Date.now() * 0.002;
	spheres.forEach(s => {
		if (s.userData.contactCooldown > 0) s.userData.contactCooldown = Math.max(0, s.userData.contactCooldown - frameScale);
		if (s.userData.behavior === 'straight') {
			s.position.x = s.userData.baseX + Math.sin(time + s.userData.floatOffset) * 25;
		} else if (s.userData.behavior === 'circular') {
			s.userData.angle += 0.02 * frameScale;
			s.position.x = s.userData.baseX + Math.cos(s.userData.angle) * 15;
			s.position.z = s.userData.baseZ + Math.sin(s.userData.angle) * 15;
		}
		s.position.y = 1.5;
		if (!isEnding && s.userData.contactCooldown <= 0 && Math.hypot(s.position.x - tankPos.x, s.position.z - tankPos.z) < 4.5) {
			s.userData.contactCooldown = 55;
			damagePlayer(10, `Impacto de ${s.userData.name} (-10 de vida)`);
		}
	});

	if (enemyBots.length < enemyBotCount) spawnSingleEnemyBot();

	enemyBots.forEach(bot => {
		const dx = tankPos.x - bot.position.x;
		const dz = tankPos.z - bot.position.z;
		const distToPlayer = Math.hypot(dx, dz);

		if (distToPlayer < 75) {
			const targetAngle = Math.atan2(-dx, -dz);
			bot.rotation.y = targetAngle;

			if (distToPlayer > 15 && hasClearShot(bot.position, tankPos)) {
				const nextX = bot.position.x - Math.sin(targetAngle) * 0.12 * frameScale;
				const nextZ = bot.position.z - Math.cos(targetAngle) * 0.12 * frameScale;
				if (!isBlockedByFortress(nextX, bot.position.z, 3) && !isTankPositionBlocked(nextX, bot.position.z, bot)) bot.position.x = nextX;
				if (!isBlockedByFortress(bot.position.x, nextZ, 3) && !isTankPositionBlocked(bot.position.x, nextZ, bot)) bot.position.z = nextZ;
			}

			bot.userData.shootTimer += frameScale;
			if (bot.userData.shootTimer > bot.userData.fireCadence && hasClearShot(bot.position, tankPos)) {
				bot.userData.shootTimer = 0;
				fireEnemyTank(bot);
			}
		} else {
			bot.userData.patrolAngle += 0.01 * frameScale;
			const patrolX = bot.userData.baseX + Math.cos(bot.userData.patrolAngle) * 20;
			const patrolZ = bot.userData.baseZ + Math.sin(bot.userData.patrolAngle) * 20;
			if (!isBlockedByFortress(patrolX, patrolZ, 3) && !isTankPositionBlocked(patrolX, patrolZ, bot)) {
				bot.position.x = patrolX;
				bot.position.z = patrolZ;
			}
			bot.rotation.y = bot.userData.patrolAngle;
		}
	});

	updateFortressPatrols(frameScale);
	updateFortressProgression();
	if (bossTank && fortressTanks.includes(bossTank)) {
		if (bossTank.userData.bossAura) {
			bossTank.userData.bossAura.rotation.z += 0.012 * frameScale;
			const pulse = 1 + Math.sin(performance.now() * 0.003) * 0.06;
			bossTank.userData.bossAura.scale.set(pulse, pulse, pulse);
		}
		let bossDistance = Math.hypot(bossTank.position.x - tankPos.x, bossTank.position.z - tankPos.z);
		if (bossDistance >= 220 || !hasEnemyTankClearShot(bossTank)) {
			moveBossTowardPlayer(bossTank, frameScale);
			bossDistance = Math.hypot(bossTank.position.x - tankPos.x, bossTank.position.z - tankPos.z);
		}
		if (bossDistance < 220 && hasEnemyTankClearShot(bossTank)) {
			bossTank.rotation.y = Math.atan2(-(tankPos.x - bossTank.position.x), -(tankPos.z - bossTank.position.z));
			bossTank.userData.shootTimer += frameScale;
			if (bossTank.userData.shootTimer >= bossTank.userData.fireCadence) {
				bossTank.userData.shootTimer = 0;
				fireEnemyTank(bossTank);
			}
		}
	}
	if (bossDefeated) {
		const portalTime = performance.now() * 0.001;
		portalRings.forEach((ring, index) => {
			ring.rotation.z += (index % 2 === 0 ? 0.035 : -0.025) * frameScale;
			const pulse = 1 + Math.sin(portalTime * 2.4 + index) * 0.035;
			ring.scale.set(pulse, pulse, pulse);
		});
		portalArcs.forEach((arc, index) => {
			arc.rotation.z += (index % 2 === 0 ? 0.055 : -0.045) * frameScale;
		});
		portalParticleFields.forEach((field, index) => {
			field.rotation.z += (index % 2 === 0 ? 0.012 : -0.01) * frameScale;
		});
		portalCoreMaterials.forEach((material, index) => {
			material.uniforms.uTime.value = portalTime + index * 0.7;
		});
		updatePortalCountdown(frameScale);
	}

	for (let i = bullets.length - 1; i >= 0; i--) {
		const b = bullets[i];
		b.userData.life -= frameScale;

		const subSteps = Math.max(4, Math.ceil(b.userData.velocity.length() * frameScale / 1.5));
		scratchSubVel.copy(b.userData.velocity).multiplyScalar(frameScale).divideScalar(subSteps);
		let hitRegistered = false;
		let wallBounce = false;

		for (let step = 0; step < subSteps; step++) {
			b.position.add(scratchSubVel);

			if (Math.abs(b.position.x) >= bulletWallLimit || Math.abs(b.position.z) >= bulletWallLimit || isBlockedByFortress(b.position.x, b.position.z, bulletRadius)) {
				wallBounce = true;
				hitRegistered = true;
				break;
			}

			if (!b.userData.isEnemy) {
				for (let j = spheres.length - 1; j >= 0; j--) {
					const s = spheres[j];
					if (b.position.distanceTo(s.position) < 2.2) {
						s.userData.hp -= 1;
						updateHealthBar(s.userData);
						playSound('hit');
						spawnHitParticles(b.position, s.userData.color);

						if (s.userData.hp <= 0) {
							const reward = sphereRewardsPaid < sphereCount ? s.userData.reward : 0;
							if (reward > 0) {
								cash += reward;
								sphereRewardsPaid++;
							}
							targetsDestroyedCount++;
							document.getElementById('cash').innerText = cash;
							if (reward > 0) showNotification(`¡Destruiste ${s.userData.name}! +$${reward}`);
							playSound('destroy');

							disposeHealthBar(s.userData.hpBar);
							scene.remove(s);
							s.material.dispose();
							spheres.splice(j, 1);
							spawnSingleSphere();
						}
						hitRegistered = true;
						break;
					}
				}

				if (!hitRegistered) {
					for (let k = enemyBots.length - 1; k >= 0; k--) {
						const bot = enemyBots[k];
						if (b.position.distanceTo(bot.position) < 2.5) {
							bot.userData.hp -= 1;
							updateHealthBar(bot.userData);
							playSound('hit');
							spawnHitParticles(b.position, bot.userData.color);

							if (bot.userData.hp <= 0) {
								const reward = enemyBotRewardsPaid < enemyBotCount ? bot.userData.reward : 0;
								if (reward > 0) {
									cash += reward;
									enemyBotRewardsPaid++;
								}
								botsDestroyedCount++;
								document.getElementById('cash').innerText = cash;
								if (reward > 0) showNotification(`¡Destruiste un ${bot.userData.name}! +$${reward}`);
								playSound('destroy');

								disposeHealthBar(bot.userData.hpBar);
								scene.remove(bot);
								enemyBots.splice(k, 1);
							}
							hitRegistered = true;
							break;
						}
					}
				}

				if (!hitRegistered) {
					for (let k = fortressTanks.length - 1; k >= 0; k--) {
						const target = fortressTanks[k];
						if (b.position.distanceTo(target.position) < 3.2) {
							target.userData.hp -= 1;
							updateHealthBar(target.userData);
							playSound('hit');
							spawnHitParticles(b.position, target.userData.color);
							if (target.userData.hp <= 0) {
								cash += target.userData.reward;
								botsDestroyedCount++;
								document.getElementById('cash').innerText = cash;
								showNotification(`¡Derrotaste a ${target.userData.name}! +$${target.userData.reward}`);
								playSound('destroy');
								disposeFortressTank(target);
								scene.remove(target);
								fortressTanks.splice(k, 1);
								if (target.userData.isBoss) {
									bossDefeated = true;
									bossTank = null;
									portal.visible = true;
									setGateGroupOpen(fortressGates.portal, true);
									showNotification('¡El portal de la torre está abierto!');
								}
								updateFortressProgression();
							}
							hitRegistered = true;
							break;
						}
					}
				}
			} else {
				if (!isEnding && b.position.distanceTo(tankGroup.position) < 2.0) {
					damagePlayer(12, 'Te disparó un tanque enemigo (-12 de vida)');
					spawnHitParticles(b.position, 0x00ffcc);
					hitRegistered = true;
				}
			}

			if (hitRegistered) break;
		}

		if (wallBounce) {
			playSound('bounce');
			spawnWallHitParticles(b.position);
		}

		const distTraveled = Math.hypot(b.position.x - b.userData.startX, b.position.z - b.userData.startZ);

		if (hitRegistered || b.userData.life <= 0 || distTraveled >= b.userData.maxDist) {
			scene.remove(b);
			if (b.userData.isEnemy) b.material.dispose();
			bullets.splice(i, 1);
		}
	}

	for (let i = particles.length - 1; i >= 0; i--) {
		const p = particles[i];
		p.position.addScaledVector(p.userData.vel, frameScale);
		p.userData.life -= frameScale;
		if (p.userData.life <= 0) {
			scene.remove(p);
			particles.splice(i, 1);
		}
	}

	renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});
