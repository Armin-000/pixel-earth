import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';

const container = document.getElementById('app');

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);
camera.position.set(0, 0, 210);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.minDistance = 120;
controls.maxDistance = 380;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.35;

const ambientLight = new THREE.AmbientLight(0xffffff, 1.25);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0x9fd4ff, 1.8);
directionalLight.position.set(140, 80, 180);
scene.add(directionalLight);

const backLight = new THREE.DirectionalLight(0x3355aa, 0.5);
backLight.position.set(-120, -50, -140);
scene.add(backLight);

const earthGroup = new THREE.Group();
scene.add(earthGroup);

const EARTH_RADIUS = 60;
let earthMesh = null;
let countryTexture = null;
let currentGeoJson = null;

/**
 * Ovdje definiraš države koje želiš obojiti.
 * Ključ je ime države, a vrijednost je boja.
 */
const highlightedCountries = {
  'Bosnia and Herzegovina': '#ff3b30',
  'Slovenia': '#ff0000'
};

createStars();
createAtmosphere();
initEarth();

async function initEarth() {
  try {
    const response = await fetch('./countries.geo.json');
    if (!response.ok) {
      throw new Error(`Ne mogu učitati countries.geo.json (${response.status})`);
    }

    currentGeoJson = await response.json();

    const texture = createCountryTexture(currentGeoJson, highlightedCountries);
    countryTexture = texture;

    const earthGeometry = new THREE.SphereGeometry(EARTH_RADIUS, 128, 128);
    const earthMaterial = new THREE.MeshPhongMaterial({
      map: texture,
      shininess: 12,
      specular: new THREE.Color(0x1f3550)
    });

    earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    earthMesh.rotation.y = Math.PI;
    earthGroup.add(earthMesh);

    const oceanGlow = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS + 0.35, 128, 128),
      new THREE.MeshPhongMaterial({
        color: 0x113e67,
        transparent: true,
        opacity: 0.08,
        depthWrite: false
      })
    );
    earthGroup.add(oceanGlow);
  } catch (error) {
    console.error(error);
  }
}

function createStars() {
  const starCount = 3000;
  const positions = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i++) {
    const i3 = i * 3;
    const radius = 500 + Math.random() * 900;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = radius * Math.cos(phi);
    positions[i3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1.1,
    transparent: true,
    opacity: 0.9,
    depthWrite: false
  });

  const stars = new THREE.Points(geometry, material);
  scene.add(stars);
}

function createAtmosphere() {
  const atmosphereGeometry = new THREE.SphereGeometry(EARTH_RADIUS + 4, 128, 128);
  const atmosphereMaterial = new THREE.MeshBasicMaterial({
    color: 0x4fc3ff,
    transparent: true,
    opacity: 0.08,
    depthWrite: false
  });

  const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
  earthGroup.add(atmosphere);
}

function createCountryTexture(geoJson, selectedMap = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 4096;
  canvas.height = 2048;

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas context nije dostupan.');
  }

  // Ocean
  ctx.fillStyle = '#041a2d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Blagi ocean gradient
  const gradient = ctx.createRadialGradient(
    canvas.width * 0.5,
    canvas.height * 0.45,
    120,
    canvas.width * 0.5,
    canvas.height * 0.5,
    canvas.width * 0.7
  );
  gradient.addColorStop(0, 'rgba(24, 77, 122, 0.30)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const features = Array.isArray(geoJson.features) ? geoJson.features : [];

  for (const feature of features) {
    const geometry = feature.geometry;
    if (!geometry) continue;

    const countryName = getCountryName(feature);
    const fillColor = getCountryFillColor(countryName, selectedMap);

    ctx.beginPath();

    if (geometry.type === 'Polygon') {
      drawPolygon(ctx, geometry.coordinates, canvas.width, canvas.height);
    } else if (geometry.type === 'MultiPolygon') {
      for (const polygon of geometry.coordinates) {
        drawPolygon(ctx, polygon, canvas.width, canvas.height);
      }
    } else {
      continue;
    }

    ctx.fillStyle = fillColor;
    ctx.fill();

    // base dark stroke
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2.6;
    ctx.stroke();

    // top sharp stroke
    ctx.strokeStyle = isHighlightedCountry(countryName, selectedMap)
      ? '#ffffff'
      : 'rgba(255,255,255,0.95)';
    ctx.lineWidth = isHighlightedCountry(countryName, selectedMap) ? 1.6 : 1.0;
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.needsUpdate = true;

  return texture;
}

function drawPolygon(ctx, rings, width, height) {
  for (const ring of rings) {
    if (!Array.isArray(ring) || ring.length === 0) continue;

    for (let i = 0; i < ring.length; i++) {
      const coord = ring[i];
      const lon = coord[0];
      const lat = coord[1];

      const x = ((lon + 180) / 360) * width;
      const y = ((90 - lat) / 180) * height;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.closePath();
  }
}

function getCountryName(feature) {
  const props = feature.properties || {};

  return (
    props.name ||
    props.NAME ||
    props.admin ||
    props.ADMIN ||
    props.sovereignt ||
    props.SOVEREIGNT ||
    props.brk_name ||
    props.BRK_NAME ||
    'Unknown'
  );
}

function normalizeName(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isHighlightedCountry(countryName, selectedMap) {
  const normalizedCountry = normalizeName(countryName);

  for (const key of Object.keys(selectedMap)) {
    const normalizedKey = normalizeName(key);

    if (normalizedCountry === normalizedKey) {
      return true;
    }

    // mali alias support
    if (
      (normalizedKey === 'bosna i hercegovina' && normalizedCountry === 'bosnia and herzegovina') ||
      (normalizedKey === 'slovenija' && normalizedCountry === 'slovenia') ||
      (normalizedKey === 'hrvatska' && normalizedCountry === 'croatia') ||
      (normalizedKey === 'srbija' && normalizedCountry === 'serbia') ||
      (normalizedKey === 'njemacka' && normalizedCountry === 'germany') ||
      (normalizedKey === 'italija' && normalizedCountry === 'italy')
    ) {
      return true;
    }
  }

  return false;
}

function getCountryFillColor(countryName, selectedMap) {
  const normalizedCountry = normalizeName(countryName);

  for (const [key, color] of Object.entries(selectedMap)) {
    const normalizedKey = normalizeName(key);

    if (normalizedCountry === normalizedKey) {
      return color;
    }

    if (
      (normalizedKey === 'bosna i hercegovina' && normalizedCountry === 'bosnia and herzegovina') ||
      (normalizedKey === 'slovenija' && normalizedCountry === 'slovenia') ||
      (normalizedKey === 'hrvatska' && normalizedCountry === 'croatia') ||
      (normalizedKey === 'srbija' && normalizedCountry === 'serbia') ||
      (normalizedKey === 'njemacka' && normalizedCountry === 'germany') ||
      (normalizedKey === 'italija' && normalizedCountry === 'italy')
    ) {
      return color;
    }
  }

  return '#f2f4f8';
}

/**
 * Ovo možeš pozvati kasnije iz browser console:
 *
 * setHighlightedCountries({
 *   'Bosnia and Herzegovina': '#ff3b30',
 *   'Slovenia': '#22c55e',
 *   'Croatia': '#3b82f6'
 * });
 */
window.setHighlightedCountries = function setHighlightedCountries(newMap) {
  if (!currentGeoJson || !earthMesh) return;

  const nextTexture = createCountryTexture(currentGeoJson, newMap);

  earthMesh.material.map.dispose();
  earthMesh.material.map = nextTexture;
  earthMesh.material.needsUpdate = true;

  countryTexture = nextTexture;
};

function animate() {
  requestAnimationFrame(animate);

  earthGroup.rotation.y += 0.0012;
  controls.update();
  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});