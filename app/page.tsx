<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Geometry Dash - NO EFFICIENT</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: #0a0010;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    font-family: 'Orbitron', monospace;
    overflow: hidden;
    user-select: none;
  }

  #ui {
    position: absolute;
    top: 20px;
    left: 0; right: 0;
    display: flex;
    justify-content: space-between;
    padding: 0 30px;
    z-index: 10;
  }

  #attempts-label {
    color: #fff;
    font-size: 13px;
    opacity: 0.7;
    letter-spacing: 2px;
  }

  #percent-label {
    color: #fff;
    font-size: 18px;
    font-weight: 900;
    letter-spacing: 3px;
    text-shadow: 0 0 20px #ff6a00;
  }

  canvas {
    display: block;
    border: 2px solid #ff6a0044;
    box-shadow: 0 0 60px #ff6a0033, 0 0 120px #ee0979aa;
    border-radius: 4px;
  }

  #overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.75);
    z-index: 20;
    transition: opacity 0.3s;
  }

  #overlay.hidden { opacity: 0; pointer-events: none; }

  #overlay h1 {
    font-size: 52px;
    font-weight: 900;
    background: linear-gradient(90deg, #ff6a00, #ee0979, #ff6a00);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    text-shadow: none;
    letter-spacing: 4px;
    margin-bottom: 10px;
  }

  #overlay .sub {
    color: #fff;
    font-size: 14px;
    letter-spacing: 4px;
    opacity: 0.6;
    margin-bottom: 40px;
  }

  #overlay .best {
    color: #ff6a00;
    font-size: 13px;
    letter-spacing: 2px;
    margin-bottom: 30px;
  }

  #overlay button {
    padding: 14px 50px;
    font-family: 'Orbitron', monospace;
    font-size: 16px;
    font-weight: 900;
    letter-spacing: 3px;
    background: linear-gradient(135deg, #ff6a00, #ee0979);
    border: none;
    color: #fff;
    border-radius: 4px;
    cursor: pointer;
    text-transform: uppercase;
    box-shadow: 0 0 30px #ff6a0066;
    transition: transform 0.1s, box-shadow 0.1s;
  }

  #overlay button:hover {
    transform: scale(1.05);
    box-shadow: 0 0 50px #ff6a00aa;
  }

  #overlay button:active { transform: scale(0.97); }

  #progress-bar-wrap {
    position: absolute;
    bottom: 20px;
    left: 30px; right: 30px;
    height: 6px;
    background: #ffffff15;
    border-radius: 3px;
    z-index: 10;
  }

  #progress-bar {
    height: 100%;
    width: 0%;
    background: linear-gradient(90deg, #ff6a00, #ee0979);
    border-radius: 3px;
    box-shadow: 0 0 10px #ff6a00;
    transition: width 0.1s linear;
  }
</style>
</head>
<body>

<div id="ui">
  <span id="attempts-label">ATTEMPTS: 1</span>
  <span id="percent-label">0%</span>
</div>

<canvas id="c" width="900" height="400"></canvas>

<div id="progress-bar-wrap"><div id="progress-bar"></div></div>

<div id="overlay" id="overlay">
  <h1>GD NO EFFICIENT</h1>
  <div class="sub">CLICK OR SPACE TO JUMP</div>
  <div class="best" id="best-label">BEST: 0%</div>
  <button id="play-btn">PLAY</button>
</div>

<script>
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const playBtn = document.getElementById('play-btn');
const attemptsLabel = document.getElementById('attempts-label');
const percentLabel = document.getElementById('percent-label');
const progressBar = document.getElementById('progress-bar');
const bestLabel = document.getElementById('best-label');

// ---- LEVEL DATA ----
// Each obstacle: { type: 'spike'|'block'|'dspike', x, w, h }
// Generated procedurally but deterministically
const LEVEL_LENGTH = 9000; // px
const GROUND_Y = 330;
const PLAYER_SIZE = 38;

function generateLevel() {
  const obs = [];
  let x = 700;
  while (x < LEVEL_LENGTH - 400) {
    const r = Math.random();
    if (r < 0.35) {
      // single spike
      obs.push({ type: 'spike', x, w: 40, h: 45 });
      x += 90 + Math.random() * 80;
    } else if (r < 0.55) {
      // double spike
      obs.push({ type: 'spike', x, w: 40, h: 45 });
      obs.push({ type: 'spike', x: x + 42, w: 40, h: 45 });
      x += 140 + Math.random() * 60;
    } else if (r < 0.70) {
      // triple spike
      obs.push({ type: 'spike', x, w: 40, h: 45 });
      obs.push({ type: 'spike', x: x + 42, w: 40, h: 45 });
      obs.push({ type: 'spike', x: x + 84, w: 40, h: 45 });
      x += 200 + Math.random() * 60;
    } else if (r < 0.85) {
      // block
      const bh = 40 + Math.floor(Math.random() * 2) * 40;
      obs.push({ type: 'block', x, w: 40, h: bh });
      x += 160 + Math.random() * 100;
    } else {
      // block + spike on top
      const bh = 40;
      obs.push({ type: 'block', x, w: 40, h: bh });
      obs.push({ type: 'spike', x: x - 1, w: 40, h: 40, onBlock: true, blockH: bh });
      x += 170 + Math.random() * 80;
    }
  }
  return obs;
}

// ---- GAME STATE ----
let state = 'menu'; // menu | playing | dead | win
let attempts = 1;
let best = 0;
let obstacles = [];

// Player
let player = {};
// Camera
let camX = 0;
// BG stars (no efficient - just lots of them)
const stars = [];
for (let i = 0; i < 220; i++) {
  stars.push({
    x: Math.random() * LEVEL_LENGTH,
    y: Math.random() * 290,
    r: Math.random() * 1.8 + 0.3,
    speed: 0.2 + Math.random() * 0.5,
    brightness: Math.random()
  });
}

// Particles
let particles = [];
// Trail
let trail = [];

// BG columns (decorative)
const bgCols = [];
for (let i = 0; i < 60; i++) {
  bgCols.push({ x: i * 160 + Math.random() * 80, h: 60 + Math.random() * 180, w: 12 + Math.random() * 20 });
}

// ---- INIT ----
function initGame() {
  obstacles = generateLevel();
  player = {
    x: 120,
    y: GROUND_Y - PLAYER_SIZE,
    vy: 0,
    onGround: true,
    angle: 0,
    dead: false,
    won: false
  };
  camX = 0;
  particles = [];
  trail = [];
  state = 'playing';
  overlay.classList.add('hidden');
}

// ---- PHYSICS ----
const GRAVITY = 0.68;
const JUMP_FORCE = -13.5;
const SPEED = 7.2;

let jumpHeld = false;
let justPressed = false;

document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    if (state === 'menu' || state === 'dead' || state === 'win') {
      if (state !== 'menu') startAttempt();
      return;
    }
    justPressed = true;
  }
});

document.addEventListener('keyup', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp') jumpHeld = false;
});

canvas.addEventListener('mousedown', () => {
  if (state === 'menu' || state === 'dead' || state === 'win') { startAttempt(); return; }
  justPressed = true;
});

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  if (state === 'menu' || state === 'dead' || state === 'win') { startAttempt(); return; }
  justPressed = true;
}, { passive: false });

playBtn.addEventListener('click', e => { e.stopPropagation(); startAttempt(); });

function startAttempt() {
  attempts++;
  attemptsLabel.textContent = 'ATTEMPTS: ' + attempts;
  initGame();
}

// ---- COLLISION ----
function playerRect() {
  const pad = 4;
  return {
    x: player.x + pad,
    y: player.y + pad,
    w: PLAYER_SIZE - pad * 2,
    h: PLAYER_SIZE - pad * 2
  };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function getObstacleRect(o) {
  if (o.type === 'spike') {
    const baseY = o.onBlock ? GROUND_Y - o.blockH - o.h : GROUND_Y - o.h;
    return { x: o.x + 4, y: baseY + 6, w: o.w - 8, h: o.h - 6 };
  } else {
    return { x: o.x, y: GROUND_Y - o.h, w: o.w, h: o.h };
  }
}

// ---- PARTICLES ----
function spawnDeathParticles(x, y) {
  for (let i = 0; i < 40; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 6;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      life: 1,
      decay: 0.025 + Math.random() * 0.03,
      size: 3 + Math.random() * 8,
      color: `hsl(${20 + Math.random() * 40}, 100%, 60%)`
    });
  }
}

function spawnRunParticles() {
  if (Math.random() > 0.4) return;
  particles.push({
    x: player.x + Math.random() * PLAYER_SIZE,
    y: player.y + PLAYER_SIZE,
    vx: (Math.random() - 0.5) * 1.5 - 1,
    vy: -(Math.random() * 1.5),
    life: 0.8,
    decay: 0.04,
    size: 2 + Math.random() * 4,
    color: `hsl(${200 + Math.random() * 60}, 100%, 70%)`
  });
}

// ---- UPDATE ----
function update() {
  if (state !== 'playing') return;

  // Jump
  if (justPressed && player.onGround) {
    player.vy = JUMP_FORCE;
    player.onGround = false;
  }
  justPressed = false;

  // Physics
  player.vy += GRAVITY;
  player.y += player.vy;

  // Ground
  if (player.y >= GROUND_Y - PLAYER_SIZE) {
    player.y = GROUND_Y - PLAYER_SIZE;
    player.vy = 0;
    player.onGround = true;
  }

  // Ceiling
  if (player.y < 0) {
    player.y = 0;
    player.vy = 2;
  }

  // Move camera
  player.x += SPEED; // world space
  camX = player.x - 160;

  // Rotate cube
  if (!player.onGround) {
    player.angle += 0.08;
  } else {
    // snap to nearest 90deg
    const snap = Math.round(player.angle / (Math.PI / 2)) * (Math.PI / 2);
    player.angle += (snap - player.angle) * 0.3;
  }

  // Trail
  trail.unshift({ x: player.x + PLAYER_SIZE / 2, y: player.y + PLAYER_SIZE / 2 });
  if (trail.length > 18) trail.pop();

  // Run particles
  if (player.onGround) spawnRunParticles();

  // Update particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15;
    p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // Collision
  const pr = playerRect();
  for (const o of obstacles) {
    if (o.x - camX > 900) break;
    if (o.x + o.w < camX - 50) continue;
    if (rectsOverlap(pr, getObstacleRect(o))) {
      die();
      return;
    }
  }

  // Win condition
  if (player.x >= LEVEL_LENGTH) {
    win();
    return;
  }

  // Progress
  const pct = Math.min(100, Math.floor((player.x / LEVEL_LENGTH) * 100));
  percentLabel.textContent = pct + '%';
  progressBar.style.width = pct + '%';
  if (pct > best) {
    best = pct;
    bestLabel.textContent = 'BEST: ' + best + '%';
  }
}

function die() {
  spawnDeathParticles(player.x + PLAYER_SIZE / 2, player.y + PLAYER_SIZE / 2);
  state = 'dead';
  const pct = Math.min(100, Math.floor((player.x / LEVEL_LENGTH) * 100));
  // Flash then show overlay
  setTimeout(() => {
    overlay.querySelector('h1').textContent = pct < 5 ? 'GD NO EFFICIENT' : pct + '% 💀';
    overlay.querySelector('.sub').textContent = pct >= 90 ? 'SO CLOSE...' : 'CLICK OR SPACE TO RETRY';
    overlay.classList.remove('hidden');
  }, 600);
}

function win() {
  state = 'win';
  best = 100;
  bestLabel.textContent = 'BEST: 100%';
  percentLabel.textContent = '100%';
  progressBar.style.width = '100%';
  setTimeout(() => {
    overlay.querySelector('h1').textContent = '🏆 GG!';
    overlay.querySelector('.sub').textContent = 'YOU WIN!!';
    overlay.classList.remove('hidden');
  }, 800);
}

// ---- DRAW ----
function drawBG() {
  // Sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  grad.addColorStop(0, '#030008');
  grad.addColorStop(1, '#0d001f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 900, 400);

  // BG columns
  ctx.save();
  ctx.globalAlpha = 0.07;
  for (const c of bgCols) {
    const sx = c.x - camX * 0.15;
    if (sx < -c.w || sx > 900) continue;
    ctx.fillStyle = '#ff6a00';
    ctx.fillRect(sx % 900, GROUND_Y - c.h, c.w, c.h);
  }
  ctx.restore();

  // Stars
  const t = Date.now() / 1000;
  for (const s of stars) {
    const sx = (s.x - camX * s.speed * 0.1) % LEVEL_LENGTH;
    const screenX = ((sx % 900) + 900) % 900;
    const alpha = 0.3 + 0.4 * Math.abs(Math.sin(t * s.speed + s.x));
    ctx.beginPath();
    ctx.arc(screenX, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,220,180,${alpha})`;
    ctx.fill();
  }
}

function drawGround() {
  // Main ground
  ctx.fillStyle = '#1a0030';
  ctx.fillRect(0, GROUND_Y, 900, 70);

  // Ground top line glow
  ctx.strokeStyle = '#ff6a00';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#ff6a00';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(900, GROUND_Y);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Grid tiles on ground
  const tileW = 40;
  const offset = (camX * -1) % tileW;
  ctx.strokeStyle = '#ffffff08';
  ctx.lineWidth = 1;
  ctx.shadowBlur = 0;
  for (let x = offset; x < 900; x += tileW) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y);
    ctx.lineTo(x, GROUND_Y + 70);
    ctx.stroke();
  }
  for (let y = GROUND_Y; y < GROUND_Y + 70; y += 20) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(900, y);
    ctx.stroke();
  }
}

function drawObstacles() {
  for (const o of obstacles) {
    const sx = o.x - camX;
    if (sx > 960 || sx + o.w < -50) continue;

    if (o.type === 'spike') {
      const baseY = o.onBlock ? GROUND_Y - o.blockH : GROUND_Y;
      // Spike triangle
      ctx.beginPath();
      ctx.moveTo(sx, baseY);
      ctx.lineTo(sx + o.w / 2, baseY - o.h);
      ctx.lineTo(sx + o.w, baseY);
      ctx.closePath();

      const sg = ctx.createLinearGradient(sx, baseY - o.h, sx, baseY);
      sg.addColorStop(0, '#ff2244');
      sg.addColorStop(1, '#880022');
      ctx.fillStyle = sg;
      ctx.shadowColor = '#ff2244';
      ctx.shadowBlur = 8;
      ctx.fill();

      ctx.strokeStyle = '#ff4466';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.shadowBlur = 0;

    } else if (o.type === 'block') {
      const by = GROUND_Y - o.h;
      ctx.fillStyle = '#1a0040';
      ctx.fillRect(sx, by, o.w, o.h);

      // Block inner grid
      ctx.strokeStyle = '#ff6a0044';
      ctx.lineWidth = 1;
      for (let gy = by; gy < GROUND_Y; gy += 20) {
        ctx.beginPath(); ctx.moveTo(sx, gy); ctx.lineTo(sx + o.w, gy); ctx.stroke();
      }

      // Glowing border
      ctx.strokeStyle = '#ff6a00';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ff6a00';
      ctx.shadowBlur = 12;
      ctx.strokeRect(sx + 1, by + 1, o.w - 2, o.h - 2);
      ctx.shadowBlur = 0;
    }
  }
}

function drawTrail() {
  for (let i = 0; i < trail.length; i++) {
    const t = trail[i];
    const sx = t.x - camX;
    const alpha = (1 - i / trail.length) * 0.5;
    const size = PLAYER_SIZE * (1 - i / trail.length) * 0.6;
    ctx.beginPath();
    ctx.arc(sx, t.y, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 100, 20, ${alpha})`;
    ctx.fill();
  }
}

function drawPlayer() {
  if (state === 'dead') return;
  const sx = player.x - camX;
  const cx = sx + PLAYER_SIZE / 2;
  const cy = player.y + PLAYER_SIZE / 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(player.angle);

  // Outer glow
  ctx.shadowColor = '#ff6a00';
  ctx.shadowBlur = 22;

  // Body gradient
  const bg = ctx.createLinearGradient(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE / 2, PLAYER_SIZE / 2);
  bg.addColorStop(0, '#ffaa00');
  bg.addColorStop(1, '#ff2200');
  ctx.fillStyle = bg;
  ctx.fillRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);

  // Inner square
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  const inner = PLAYER_SIZE * 0.35;
  ctx.fillRect(-inner / 2, -inner / 2, inner, inner);

  // Border
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.strokeRect(-PLAYER_SIZE / 2 + 1, -PLAYER_SIZE / 2 + 1, PLAYER_SIZE - 2, PLAYER_SIZE - 2);

  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    const sx = p.x - camX;
    ctx.globalAlpha = p.life;
    ctx.beginPath();
    ctx.arc(sx, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function drawEndFlag() {
  const sx = LEVEL_LENGTH - camX;
  if (sx < -10 || sx > 950) return;

  // Pole
  ctx.fillStyle = '#fff';
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 10;
  ctx.fillRect(sx - 2, GROUND_Y - 160, 4, 160);

  // Flag
  ctx.fillStyle = '#00ff88';
  ctx.shadowColor = '#00ff88';
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.moveTo(sx + 2, GROUND_Y - 160);
  ctx.lineTo(sx + 50, GROUND_Y - 135);
  ctx.lineTo(sx + 2, GROUND_Y - 110);
  ctx.fill();
  ctx.shadowBlur = 0;
}

// ---- LOOP ----
let lastT = 0;
function loop(t) {
  requestAnimationFrame(loop);
  update();

  ctx.clearRect(0, 0, 900, 400);
  drawBG();
  drawGround();
  drawEndFlag();
  drawObstacles();
  drawTrail();
  drawParticles();
  drawPlayer();
}

// Init menu state
overlay.classList.remove('hidden');
percentLabel.textContent = '0%';
progressBar.style.width = '0%';

requestAnimationFrame(loop);
</script>
</body>
</html>
