// Web Audio Sound Synthesizer
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
let targetsDestroyedCount = 0;
let botsDestroyedCount = 0;
let screenShake = 0;
let lowHpTimer = 0;

// Camera & Aiming State
let camYaw = 0;
let camPitch = 0.4;
let camDist = 9;

// Pre-allocated scratch vectors for runtime performance
const scratchForward = new THREE.Vector3();
const scratchRight = new THREE.Vector3();
const scratchMove = new THREE.Vector3();
const scratchSubVel = new THREE.Vector3();
const scratchEnemyDir = new THREE.Vector3();

// Pointer Lock Setup (Desktop)
document.body.addEventListener('click', (e) => {
	if (e.target.closest('#shop') || e.target.closest('#gameover')) return;
	if (!isGameOver && document.body.requestPointerLock && document.pointerLockElement !== document.body) {
		document.body.requestPointerLock();
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

// Scroll & Trackpad Pinch Zoom
window.addEventListener('wheel', (e) => {
	e.preventDefault();
	if (!isGameOver) {
		const zoomSpeed = e.ctrlKey ? 0.06 : 0.012;
		camDist += e.deltaY * zoomSpeed;
		camDist = Math.max(4, Math.min(25, camDist));
	}
}, { passive: false });

// Unified Touch Controls (1-finger Drag Look + 2-finger Pinch Zoom)
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
		camDist = Math.max(4, Math.min(25, camDist));
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
	speed: { level: 1, cost: 50, val: 0.55, mult: 1.8 },
	rate: { level: 1, cost: 50, val: 12, bulletSpeed: 4.5, mult: 1.9 }, 
	multishot: { level: 1, cost: 400, val: 1, max: 4, mult: 4.0 },
	maxHp: { level: 1, cost: 100, val: 100, mult: 1.7 }
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

window.buyUpgrade = function(type) {
	let u = stats[type];
	if (!u || (type === 'multishot' && u.val >= u.max)) return;

	if (cash >= u.cost) {
		cash -= u.cost;
		document.getElementById('cash').innerText = cash;
		u.level++;
		playSound('upgrade');
		
		if (type === 'speed') u.val += 0.1;
		if (type === 'rate') {
			u.val = Math.max(3, u.val - 2);
			u.bulletSpeed += 1.0;
		}
		if (type === 'maxHp') {
			maxPlayerHp += 50;
			playerHp += 50;
			updatePlayerHpUI();
		}
		if (type === 'multishot') {
			u.val += 1;
			updateTankBarrels();
			if (u.val >= u.max) {
				const btn = document.getElementById('btn-multishot');
				if (btn) {
					btn.disabled = true;
					btn.innerText = 'Max Barrels Reached';
				}
			}
		}

		if (type !== 'multishot' || u.val < u.max) {
			u.cost = Math.floor(u.cost * u.mult);
			const costElement = document.getElementById(`cost-${type}`);
			if (costElement) costElement.innerText = u.cost;
		}
	}
};

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f19);
scene.fog = new THREE.FogExp2(0x0b0f19, 0.005);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0x38bdf8, 0.5);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
sunLight.position.set(60, 120, 60);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 1024;
sunLight.shadow.mapSize.height = 1024;
scene.add(sunLight);

// Starry Night Skybox
const starCount = 800;
const starGeo = new THREE.BufferGeometry();
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount * 3; i += 3) {
	starPositions[i] = (Math.random() - 0.5) * 800;
	starPositions[i + 1] = Math.random() * 300 + 20;
	starPositions[i + 2] = (Math.random() - 0.5) * 800;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, transparent: true, opacity: 0.8 });
const starField = new THREE.Points(starGeo, starMat);
scene.add(starField);

// Arena & Boundary Walls
const arenaSize = 300;
const halfArena = arenaSize / 2;

const gridHelper = new THREE.GridHelper(arenaSize, 50, 0x00ff88, 0x1e2942);
gridHelper.position.y = 0.02;
scene.add(gridHelper);

const floorGeo = new THREE.PlaneGeometry(arenaSize, arenaSize);
floorGeo.rotateX(-Math.PI / 2);
const floorMat = new THREE.MeshStandardMaterial({
	color: 0x0f172a,
	roughness: 0.85,
	metalness: 0.15
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
	texture.repeat.set(arenaSize / 7, 1);
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

[
	[arenaSize, wallHeight, wallThickness, 0, wallHeight/2, -halfArena],
	[arenaSize, wallHeight, wallThickness, 0, wallHeight/2, halfArena],
	[wallThickness, wallHeight, arenaSize, halfArena, wallHeight/2, 0],
	[wallThickness, wallHeight, arenaSize, -halfArena, wallHeight/2, 0]
].forEach(([w, h, d, x, y, z]) => {
	const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
	wall.position.set(x, y, z);
	scene.add(wall);
});

// Player Tank Group
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

// Target Spheres setup
const spheres = [];
const sphereGeo = new THREE.SphereGeometry(1.2, 16, 16);

const sphereTypes = [
	{ name: 'Static Core', color: 0x00ffaa, emissive: 0x00ffaa, reward: 50, hp: 6, behavior: 'static' },
	{ name: 'Vector Sphere', color: 0xffaa00, emissive: 0xffaa00, reward: 150, hp: 18, behavior: 'straight' },
	{ name: 'Vortex Orb', color: 0xff0055, emissive: 0xff0055, reward: 350, hp: 40, behavior: 'circular' }
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

function spawnSingleSphere() {
	const typeConfig = sphereTypes[Math.floor(Math.random() * sphereTypes.length)];
	const mat = new THREE.MeshStandardMaterial({ 
		color: typeConfig.color, 
		emissive: typeConfig.emissive, 
		emissiveIntensity: 0.6 
	});
	const mesh = new THREE.Mesh(sphereGeo, mat);
	
	const x = (Math.random() - 0.5) * 240;
	const z = (Math.random() - 0.5) * 240;
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

// Enemy Tanks setup
const enemyBots = [];
const enemyBodyMat = new THREE.MeshStandardMaterial({ color: 0xff3344, roughness: 0.3, metalness: 0.8 });
const enemyBulletMat = new THREE.MeshBasicMaterial({ color: 0xff3344 });

function spawnSingleEnemyBot() {
	if (enemyBots.length >= 3) return;

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

	const x = (Math.random() - 0.5) * 240;
	const z = (Math.random() - 0.5) * 240;
	botGroup.position.set(x, 0, z);

	const hpBarData = createHealthBar();
	hpBarData.sprite.position.y = 2.5;
	botGroup.add(hpBarData.sprite);

	botGroup.userData = {
		isBot: true,
		name: 'Enemy Tank',
		color: 0xff3344,
		reward: 500,
		hp: 30,
		maxHp: 30,
		hpBar: hpBarData,
		baseX: x,
		baseZ: z,
		patrolAngle: Math.random() * Math.PI * 2,
		shootTimer: Math.floor(Math.random() * 60)
	};

	updateHealthBar(botGroup.userData);
	scene.add(botGroup);
	enemyBots.push(botGroup);
}

function spawnSpheres(count) {
	for (let i = 0; i < count; i++) spawnSingleSphere();
}
spawnSpheres(16);
for (let i = 0; i < 3; i++) spawnSingleEnemyBot();

// Bullets & Particles
const bullets = [];
const bulletGeo = new THREE.SphereGeometry(0.25, 8, 8);
const bulletMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });

const particles = [];
const particleGeo = new THREE.SphereGeometry(0.12, 4, 4);

function spawnHitParticles(pos, colorHex) {
	const mat = new THREE.MeshBasicMaterial({ color: colorHex });
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

// Controls state
const keys = { forward: false, backward: false, left: false, right: false };
let tankPos = new THREE.Vector3(0, 0, halfArena - 25);
let shootTimer = 0;

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
	cash = 0;
	playerHp = 100;
	maxPlayerHp = 100;
	isGameOver = false;
	targetsDestroyedCount = 0;
	botsDestroyedCount = 0;
	screenShake = 0;

	document.getElementById('cash').innerText = cash;
	updatePlayerHpUI();
	document.getElementById('gameover').style.display = 'none';

	tankPos.set(0, 0, halfArena - 25);

	stats.speed = { level: 1, cost: 50, val: 0.55, mult: 1.8 };
	stats.rate = { level: 1, cost: 50, val: 12, bulletSpeed: 4.5, mult: 1.9 };
	stats.multishot = { level: 1, cost: 400, val: 1, max: 4, mult: 4.0 };
	stats.maxHp = { level: 1, cost: 100, val: 100, mult: 1.7 };

	document.getElementById('cost-speed').innerText = stats.speed.cost;
	document.getElementById('cost-rate').innerText = stats.rate.cost;
	document.getElementById('cost-multishot').innerText = stats.multishot.cost;
	document.getElementById('cost-maxHp').innerText = stats.maxHp.cost;
	
	const multishotBtn = document.getElementById('btn-multishot');
	multishotBtn.disabled = false;
	multishotBtn.innerHTML = 'Multi-Barrel ($<span id="cost-multishot">400</span>)';

	updateTankBarrels();

	spheres.forEach(s => {
		disposeHealthBar(s.userData.hpBar);
		scene.remove(s);
	});
	spheres.length = 0;
	spawnSpheres(16);

	enemyBots.forEach(b => {
		disposeHealthBar(b.userData.hpBar);
		scene.remove(b);
	});
	enemyBots.length = 0;
	for (let i = 0; i < 3; i++) spawnSingleEnemyBot();

	bullets.forEach(b => scene.remove(b));
	bullets.length = 0;
};

// Animation Loop
function animate() {
	requestAnimationFrame(animate);

	if (isGameOver) return;

	if (playerHp < maxPlayerHp) {
		playerHp = Math.min(maxPlayerHp, playerHp + 0.04);
		updatePlayerHpUI();
	}

	// Fixed HP-Based Low HP Warning (<= 25 HP)
	if (playerHp <= 25) {
		lowHpTimer++;
		if (lowHpTimer > 45) {
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

	if (scratchMove.lengthSq() > 0) {
		scratchMove.normalize().multiplyScalar(stats.speed.val);
		tankPos.add(scratchMove);
	}

	const margin = 3;
	tankPos.x = Math.max(-halfArena + margin, Math.min(halfArena - margin, tankPos.x));
	tankPos.z = Math.max(-halfArena + margin, Math.min(halfArena - margin, tankPos.z));
	tankPos.y = 0;

	tankGroup.position.copy(tankPos);
	tankGroup.rotation.set(0, tankAngle, 0);
	tankGroup.updateMatrixWorld();

	shootTimer++;
	if (shootTimer > stats.rate.val) {
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
				maxDist: 350
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
		screenShake *= 0.85;
		if (screenShake < 0.02) screenShake = 0;
	}

	const targetCamX = tankPos.x + Math.sin(camYaw) * Math.cos(camPitch) * camDist + shakeX;
	const targetCamY = tankPos.y + 1.2 + Math.sin(camPitch) * camDist + shakeY;
	const targetCamZ = tankPos.z + Math.cos(camYaw) * Math.cos(camPitch) * camDist + shakeZ;

	camera.position.set(targetCamX, Math.max(1.2, targetCamY), targetCamZ);
	camera.lookAt(tankPos.x, tankPos.y + 1.2, tankPos.z);

	const time = Date.now() * 0.002;
	spheres.forEach(s => {
		if (s.userData.behavior === 'straight') {
			s.position.x = s.userData.baseX + Math.sin(time + s.userData.floatOffset) * 25;
		} else if (s.userData.behavior === 'circular') {
			s.userData.angle += 0.02;
			s.position.x = s.userData.baseX + Math.cos(s.userData.angle) * 15;
			s.position.z = s.userData.baseZ + Math.sin(s.userData.angle) * 15;
		}
		s.position.y = 1.5;
	});

	if (enemyBots.length < 3) spawnSingleEnemyBot();

	enemyBots.forEach(bot => {
		const dx = tankPos.x - bot.position.x;
		const dz = tankPos.z - bot.position.z;
		const distToPlayer = Math.hypot(dx, dz);

		if (distToPlayer < 75) {
			const targetAngle = Math.atan2(-dx, -dz);
			bot.rotation.y = targetAngle;

			if (distToPlayer > 15) {
				bot.position.x -= Math.sin(targetAngle) * 0.12;
				bot.position.z -= Math.cos(targetAngle) * 0.12;
			}

			bot.userData.shootTimer++;
			if (bot.userData.shootTimer > 80) {
				bot.userData.shootTimer = 0;
				playSound('enemyShoot');
				const eBullet = new THREE.Mesh(bulletGeo, enemyBulletMat);
				eBullet.position.set(bot.position.x, 1.5, bot.position.z);

				scratchEnemyDir.set(-Math.sin(targetAngle), 0, -Math.cos(targetAngle)).normalize();
				eBullet.userData = {
					isEnemy: true,
					velocity: scratchEnemyDir.clone().multiplyScalar(2.2),
					life: 250,
					startX: eBullet.position.x,
					startZ: eBullet.position.z,
					maxDist: 300
				};
				scene.add(eBullet);
				bullets.push(eBullet);
			}
		} else {
			bot.userData.patrolAngle += 0.01;
			bot.position.x = bot.userData.baseX + Math.cos(bot.userData.patrolAngle) * 20;
			bot.position.z = bot.userData.baseZ + Math.sin(bot.userData.patrolAngle) * 20;
			bot.rotation.y = bot.userData.patrolAngle;
		}
	});

	for (let i = bullets.length - 1; i >= 0; i--) {
		const b = bullets[i];
		b.userData.life--;

		const subSteps = 4;
		scratchSubVel.copy(b.userData.velocity).divideScalar(subSteps);
		let hitRegistered = false;
		let wallBounce = false;

		for (let step = 0; step < subSteps; step++) {
			b.position.add(scratchSubVel);

			if (Math.abs(b.position.x) >= halfArena - 1 || Math.abs(b.position.z) >= halfArena - 1) {
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
							cash += s.userData.reward;
							targetsDestroyedCount++;
							document.getElementById('cash').innerText = cash;
							showNotification(`Destroyed ${s.userData.name}! +$${s.userData.reward}`);
							playSound('destroy');

							disposeHealthBar(s.userData.hpBar);
							scene.remove(s);
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
								cash += bot.userData.reward;
								botsDestroyedCount++;
								document.getElementById('cash').innerText = cash;
								showNotification(`Destroyed ${bot.userData.name}! +$${bot.userData.reward}`);
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
			} else {
				if (b.position.distanceTo(tankGroup.position) < 2.0) {
					playerHp = Math.max(0, playerHp - 15);
					updatePlayerHpUI();
					showNotification("Ouch! Hit by Enemy Tank (-15 HP)", true);
					playSound('playerDamage');
					triggerDamageVignette();
					screenShake = 0.6;
					spawnHitParticles(b.position, 0x00ffcc);
					hitRegistered = true;

					if (playerHp <= 0) {
						isGameOver = true;
						if (document.exitPointerLock) document.exitPointerLock();
						document.getElementById('stat-targets').innerText = targetsDestroyedCount;
						document.getElementById('stat-bots').innerText = botsDestroyedCount;
						document.getElementById('gameover').style.display = 'flex';
					}
				}
			}

			if (hitRegistered) break;
		}

		if (wallBounce) {
			playSound('bounce');
		}

		const distTraveled = Math.hypot(b.position.x - b.userData.startX, b.position.z - b.userData.startZ);

		if (hitRegistered || b.userData.life <= 0 || distTraveled >= b.userData.maxDist) {
			scene.remove(b);
			bullets.splice(i, 1);
		}
	}

	for (let i = particles.length - 1; i >= 0; i--) {
		const p = particles[i];
		p.position.add(p.userData.vel);
		p.userData.life--;
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