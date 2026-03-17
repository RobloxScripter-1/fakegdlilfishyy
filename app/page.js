"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const LEVEL_LENGTH = 9000;
const GROUND_Y = 330;
const PLAYER_SIZE = 38;
const GRAVITY = 0.68;
const JUMP_FORCE = -13.5;
const SPEED = 7.2;

function generateLevel() {
  const obs = [];
  let x = 700;
  const rng = (() => { let s = 42; return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; }; })();
  while (x < LEVEL_LENGTH - 400) {
    const r = rng();
    if (r < 0.35) {
      obs.push({ type: "spike", x, w: 40, h: 45 });
      x += 90 + rng() * 80;
    } else if (r < 0.55) {
      obs.push({ type: "spike", x, w: 40, h: 45 });
      obs.push({ type: "spike", x: x + 42, w: 40, h: 45 });
      x += 140 + rng() * 60;
    } else if (r < 0.70) {
      obs.push({ type: "spike", x, w: 40, h: 45 });
      obs.push({ type: "spike", x: x + 42, w: 40, h: 45 });
      obs.push({ type: "spike", x: x + 84, w: 40, h: 45 });
      x += 200 + rng() * 60;
    } else if (r < 0.85) {
      const bh = 40 + Math.floor(rng() * 2) * 40;
      obs.push({ type: "block", x, w: 40, h: bh });
      x += 160 + rng() * 100;
    } else {
      obs.push({ type: "block", x, w: 40, h: 40 });
      obs.push({ type: "spike", x: x - 1, w: 40, h: 40, onBlock: true, blockH: 40 });
      x += 170 + rng() * 80;
    }
  }
  return obs;
}

const STARS = Array.from({ length: 220 }, (_, i) => ({
  x: (i * 41.3) % LEVEL_LENGTH,
  y: (i * 17.7) % 290,
  r: 0.3 + (i % 6) * 0.3,
  speed: 0.2 + (i % 5) * 0.1,
  phase: i * 0.4,
}));

const BG_COLS = Array.from({ length: 60 }, (_, i) => ({
  x: i * 160 + (i * 37) % 80,
  h: 60 + (i * 23) % 180,
  w: 12 + (i * 7) % 20,
}));

const OBSTACLES = generateLevel();

export default function GDGame() {
  const canvasRef = useRef(null);
  const stateRef = useRef("menu");
  const playerRef = useRef(null);
  const camXRef = useRef(0);
  const particlesRef = useRef([]);
  const trailRef = useRef([]);
  const justPressedRef = useRef(false);
  const attemptsRef = useRef(1);
  const bestRef = useRef(0);
  const rafRef = useRef(null);

  const [ui, setUi] = useState({ state: "menu", attempts: 1, best: 0, pct: 0 });

  const initPlayer = useCallback(() => ({
    x: 120,
    y: GROUND_Y - PLAYER_SIZE,
    vy: 0,
    onGround: true,
    angle: 0,
  }));

  const startAttempt = useCallback(() => {
    attemptsRef.current += 1;
    playerRef.current = initPlayer();
    camXRef.current = 0;
    particlesRef.current = [];
    trailRef.current = [];
    stateRef.current = "playing";
    setUi(u => ({ ...u, state: "playing", attempts: attemptsRef.current, pct: 0 }));
  }, []);

  const handleInput = useCallback(() => {
    const s = stateRef.current;
    if (s === "menu" || s === "dead" || s === "win") { startAttempt(); return; }
    justPressedRef.current = true;
  }, [startAttempt]);

  useEffect(() => {
    const onKey = e => {
      if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); handleInput(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleInput]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    function spawnDeath(x, y) {
      for (let i = 0; i < 40; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 2 + Math.random() * 6;
        particlesRef.current.push({
          x, y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2,
          life: 1, decay: 0.025 + Math.random() * 0.03,
          size: 3 + Math.random() * 8,
          color: `hsl(${20 + Math.random() * 40},100%,60%)`,
        });
      }
    }

    function spawnRun(p) {
      if (Math.random() > 0.4) return;
      particlesRef.current.push({
        x: p.x + Math.random() * PLAYER_SIZE,
        y: p.y + PLAYER_SIZE,
        vx: (Math.random() - 0.5) * 1.5 - 1,
        vy: -(Math.random() * 1.5),
        life: 0.8, decay: 0.04,
        size: 2 + Math.random() * 4,
        color: `hsl(${200 + Math.random() * 60},100%,70%)`,
      });
    }

    function playerRect(p) {
      return { x: p.x + 4, y: p.y + 4, w: PLAYER_SIZE - 8, h: PLAYER_SIZE - 8 };
    }

    function obsRect(o) {
      if (o.type === "spike") {
        const baseY = o.onBlock ? GROUND_Y - o.blockH - o.h : GROUND_Y - o.h;
        return { x: o.x + 4, y: baseY + 6, w: o.w - 8, h: o.h - 6 };
      }
      return { x: o.x, y: GROUND_Y - o.h, w: o.w, h: o.h };
    }

    function overlap(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    function update() {
      if (stateRef.current !== "playing") return;
      const p = playerRef.current;

      if (justPressedRef.current && p.onGround) {
        p.vy = JUMP_FORCE; p.onGround = false;
      }
      justPressedRef.current = false;

      p.vy += GRAVITY;
      p.y += p.vy;

      if (p.y >= GROUND_Y - PLAYER_SIZE) { p.y = GROUND_Y - PLAYER_SIZE; p.vy = 0; p.onGround = true; }
      if (p.y < 0) { p.y = 0; p.vy = 2; }

      p.x += SPEED;
      camXRef.current = p.x - 160;

      if (!p.onGround) {
        p.angle += 0.08;
      } else {
        const snap = Math.round(p.angle / (Math.PI / 2)) * (Math.PI / 2);
        p.angle += (snap - p.angle) * 0.3;
      }

      trailRef.current.unshift({ x: p.x + PLAYER_SIZE / 2, y: p.y + PLAYER_SIZE / 2 });
      if (trailRef.current.length > 18) trailRef.current.pop();

      if (p.onGround) spawnRun(p);

      const parts = particlesRef.current;
      for (let i = parts.length - 1; i >= 0; i--) {
        const pt = parts[i];
        pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.15; pt.life -= pt.decay;
        if (pt.life <= 0) parts.splice(i, 1);
      }

      const pr = playerRect(p);
      const camX = camXRef.current;
      for (const o of OBSTACLES) {
        if (o.x - camX > 900) break;
        if (o.x + o.w < camX - 50) continue;
        if (overlap(pr, obsRect(o))) {
          spawnDeath(p.x + PLAYER_SIZE / 2, p.y + PLAYER_SIZE / 2);
          stateRef.current = "dead";
          const pct = Math.floor((p.x / LEVEL_LENGTH) * 100);
          if (pct > bestRef.current) bestRef.current = pct;
          setTimeout(() => setUi(u => ({ ...u, state: "dead", pct, best: bestRef.current })), 500);
          return;
        }
      }

      if (p.x >= LEVEL_LENGTH) {
        stateRef.current = "win";
        bestRef.current = 100;
        setTimeout(() => setUi(u => ({ ...u, state: "win", pct: 100, best: 100 })), 300);
        return;
      }

      const pct = Math.min(100, Math.floor((p.x / LEVEL_LENGTH) * 100));
      if (pct > bestRef.current) bestRef.current = pct;
      setUi(u => pct !== u.pct ? { ...u, pct, best: bestRef.current } : u);
    }

    function draw() {
      const camX = camXRef.current;
      const p = playerRef.current;
      const t = Date.now() / 1000;

      // BG
      const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
      grad.addColorStop(0, "#030008");
      grad.addColorStop(1, "#0d001f");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 900, 400);

      // BG cols
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = "#ff6a00";
      for (const c of BG_COLS) {
        const sx = ((c.x - camX * 0.15) % 900 + 900) % 900;
        ctx.fillRect(sx, GROUND_Y - c.h, c.w, c.h);
      }
      ctx.globalAlpha = 1;

      // Stars
      for (const s of STARS) {
        const sx = ((s.x - camX * s.speed * 0.1) % 900 + 900) % 900;
        const alpha = 0.3 + 0.4 * Math.abs(Math.sin(t * s.speed + s.phase));
        ctx.beginPath();
        ctx.arc(sx, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,220,180,${alpha})`;
        ctx.fill();
      }

      // Ground
      ctx.fillStyle = "#1a0030";
      ctx.fillRect(0, GROUND_Y, 900, 70);
      ctx.strokeStyle = "#ff6a00";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#ff6a00";
      ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(900, GROUND_Y); ctx.stroke();
      ctx.shadowBlur = 0;

      const tileOff = (-camX) % 40;
      ctx.strokeStyle = "#ffffff08"; ctx.lineWidth = 1;
      for (let x = tileOff; x < 900; x += 40) { ctx.beginPath(); ctx.moveTo(x, GROUND_Y); ctx.lineTo(x, GROUND_Y + 70); ctx.stroke(); }
      for (let y = GROUND_Y; y < GROUND_Y + 70; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(900, y); ctx.stroke(); }

      // End flag
      const flagX = LEVEL_LENGTH - camX;
      if (flagX > -10 && flagX < 950) {
        ctx.fillStyle = "#fff"; ctx.shadowColor = "#fff"; ctx.shadowBlur = 10;
        ctx.fillRect(flagX - 2, GROUND_Y - 160, 4, 160);
        ctx.fillStyle = "#00ff88"; ctx.shadowColor = "#00ff88"; ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.moveTo(flagX + 2, GROUND_Y - 160);
        ctx.lineTo(flagX + 50, GROUND_Y - 135);
        ctx.lineTo(flagX + 2, GROUND_Y - 110);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Obstacles
      for (const o of OBSTACLES) {
        const sx = o.x - camX;
        if (sx > 960 || sx + o.w < -50) continue;
        if (o.type === "spike") {
          const baseY = o.onBlock ? GROUND_Y - o.blockH : GROUND_Y;
          ctx.beginPath();
          ctx.moveTo(sx, baseY);
          ctx.lineTo(sx + o.w / 2, baseY - o.h);
          ctx.lineTo(sx + o.w, baseY);
          ctx.closePath();
          const sg = ctx.createLinearGradient(sx, baseY - o.h, sx, baseY);
          sg.addColorStop(0, "#ff2244"); sg.addColorStop(1, "#880022");
          ctx.fillStyle = sg;
          ctx.shadowColor = "#ff2244"; ctx.shadowBlur = 8;
          ctx.fill();
          ctx.strokeStyle = "#ff4466"; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.shadowBlur = 0;
        } else {
          const by = GROUND_Y - o.h;
          ctx.fillStyle = "#1a0040"; ctx.fillRect(sx, by, o.w, o.h);
          ctx.strokeStyle = "#ff6a0044"; ctx.lineWidth = 1;
          for (let gy = by; gy < GROUND_Y; gy += 20) { ctx.beginPath(); ctx.moveTo(sx, gy); ctx.lineTo(sx + o.w, gy); ctx.stroke(); }
          ctx.strokeStyle = "#ff6a00"; ctx.lineWidth = 2;
          ctx.shadowColor = "#ff6a00"; ctx.shadowBlur = 12;
          ctx.strokeRect(sx + 1, by + 1, o.w - 2, o.h - 2);
          ctx.shadowBlur = 0;
        }
      }

      // Trail
      if (p) {
        for (let i = 0; i < trailRef.current.length; i++) {
          const tr = trailRef.current[i];
          const sx = tr.x - camX;
          ctx.beginPath();
          ctx.arc(sx, tr.y, PLAYER_SIZE * (1 - i / trailRef.current.length) * 0.3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,100,20,${(1 - i / trailRef.current.length) * 0.5})`;
          ctx.fill();
        }
      }

      // Particles
      for (const pt of particlesRef.current) {
        ctx.globalAlpha = pt.life;
        ctx.beginPath();
        ctx.arc(pt.x - camX, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fillStyle = pt.color;
        ctx.shadowColor = pt.color; ctx.shadowBlur = 8;
        ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;

      // Player
      if (p && stateRef.current !== "dead") {
        const sx = p.x - camX;
        const cx = sx + PLAYER_SIZE / 2, cy = p.y + PLAYER_SIZE / 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(p.angle);
        ctx.shadowColor = "#ff6a00"; ctx.shadowBlur = 22;
        const bg = ctx.createLinearGradient(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE / 2, PLAYER_SIZE / 2);
        bg.addColorStop(0, "#ffaa00"); bg.addColorStop(1, "#ff2200");
        ctx.fillStyle = bg;
        ctx.fillRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        const inner = PLAYER_SIZE * 0.35;
        ctx.fillRect(-inner / 2, -inner / 2, inner, inner);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
        ctx.strokeRect(-PLAYER_SIZE / 2 + 1, -PLAYER_SIZE / 2 + 1, PLAYER_SIZE - 2, PLAYER_SIZE - 2);
        ctx.shadowBlur = 0;
        ctx.restore();
      }
    }

    function loop() {
      update();
      draw();
      rafRef.current = requestAnimationFrame(loop);
    }
    let frame = 8;
playerRef.current = initPlayer();
rafRef.current = requestAnimationFrame(loop);
    playerRef.current = initPlayer();
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [initPlayer]);

  const isOverlay = ui.state !== "playing";

  return (
    <div style={{ background: "#0a0010", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Orbitron', monospace", position: "relative", overflow: "hidden" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap');`}</style>

      {/* HUD */}
      <div style={{ position: "absolute", top: 20, left: 0, right: 0, display: "flex", justifyContent: "space-between", padding: "0 30px", zIndex: 10, pointerEvents: "none" }}>
        <span style={{ color: "#fff", fontSize: 13, opacity: 0.7, letterSpacing: 2 }}>ATTEMPTS: {ui.attempts}</span>
        <span style={{ color: "#fff", fontSize: 18, fontWeight: 900, letterSpacing: 3, textShadow: "0 0 20px #ff6a00" }}>{ui.pct}%</span>
      </div>

      <canvas
        ref={canvasRef}
        width={900}
        height={400}
        onClick={handleInput}
        onTouchStart={e => { e.preventDefault(); handleInput(); }}
        style={{ display: "block", border: "2px solid #ff6a0044", boxShadow: "0 0 60px #ff6a0033, 0 0 120px #ee0979aa", borderRadius: 4, cursor: "pointer", touchAction: "none" }}
      />

      {/* Progress bar */}
      <div style={{ position: "absolute", bottom: 20, left: 30, right: 30, height: 6, background: "#ffffff15", borderRadius: 3, zIndex: 10, pointerEvents: "none" }}>
        <div style={{ height: "100%", width: `${ui.pct}%`, background: "linear-gradient(90deg,#ff6a00,#ee0979)", borderRadius: 3, boxShadow: "0 0 10px #ff6a00", transition: "width 0.1s linear" }} />
      </div>

      {/* Overlay */}
      {isOverlay && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.75)", zIndex: 20 }}>
          <h1 style={{ fontSize: 52, fontWeight: 900, background: "linear-gradient(90deg,#ff6a00,#ee0979,#ff6a00)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: 4, marginBottom: 10 }}>
            {ui.state === "win" ? "🏆 GG!" : ui.state === "dead" && ui.pct > 0 ? `${ui.pct}% 💀` : "GD NO EFFICIENT"}
          </h1>
          <div style={{ color: "#fff", fontSize: 14, letterSpacing: 4, opacity: 0.6, marginBottom: 40 }}>
            {ui.state === "win" ? "YOU WIN!!" : ui.state === "dead" && ui.pct >= 90 ? "SO CLOSE..." : "CLICK OR SPACE TO JUMP"}
          </div>
          <div style={{ color: "#ff6a00", fontSize: 13, letterSpacing: 2, marginBottom: 30 }}>BEST: {ui.best}%</div>
          <button
            onClick={startAttempt}
            style={{ padding: "14px 50px", fontFamily: "Orbitron,monospace", fontSize: 16, fontWeight: 900, letterSpacing: 3, background: "linear-gradient(135deg,#ff6a00,#ee0979)", border: "none", color: "#fff", borderRadius: 4, cursor: "pointer", textTransform: "uppercase", boxShadow: "0 0 30px #ff6a0066" }}
          >
            {ui.state === "menu" ? "PLAY" : "RETRY"}
          </button>
        </div>
      )}
    </div>
  );
          }
