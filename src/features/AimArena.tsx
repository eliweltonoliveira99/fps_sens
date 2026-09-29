import { useState, useRef, useEffect, useCallback } from 'react';
import { GAMES } from '../data/games';
import { calcCm } from '../utils';
import { sound } from '../utils/audio';
import { Crosshair, RotateCcw, Target, Zap, ShieldAlert, Sparkles, Volume2, VolumeX } from 'lucide-react';

interface AimArenaProps {
  gameId: string;
  sens: number;
  dpi: number;
  mult?: number;
  onApplySens?: (newSens: number) => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
  size: number;
}

interface FlickTarget {
  x: number;
  y: number;
  radius: number;
  createdAt: number;
  color: string;
}

export default function AimArena({ gameId, sens, dpi, mult = 0.02, onApplySens }: AimArenaProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [drillMode, setDrillMode] = useState<'tracking' | 'flick'>('tracking');
  const [crosshairStyle, setCrosshairStyle] = useState<'cross' | 'dot' | 'circle'>('cross');
  const [isMuted, setIsMuted] = useState(sound.getMuted());

  // Interactive local sens for immediate experimentation
  const [localSens, setLocalSens] = useState<number>(sens);

  useEffect(() => {
    setLocalSens(sens);
  }, [sens]);

  // Performance metrics
  const [trackingScore, setTrackingScore] = useState(0);
  const [flickHits, setFlickHits] = useState(0);
  const [flickMisses, setFlickMisses] = useState(0);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [overshoots, setOvershoots] = useState(0);
  const [undershoots, setUndershoots] = useState(0);

  // References for the animation loop
  const stateRef = useRef({
    // Camera angle/position offset
    camX: 0,
    camY: 0,
    // Tracking target state
    targetX: 0,
    targetY: 0,
    targetVx: 3.5,
    targetVy: 0.8,
    targetRadius: 26,
    // Flick target
    flickTarget: null as FlickTarget | null,
    // Particles
    particles: [] as Particle[],
    // Analytics
    lastMouseDx: 0,
    lastMouseTime: 0,
    recentDeltas: [] as number[],
    isHoveringTarget: false,
    framesOnTarget: 0,
    framesTotal: 0,
  });

  const selectedGame = GAMES.find(g => g.id === gameId) || GAMES[0];
  const cm360 = calcCm(selectedGame.yaw, localSens, dpi, mult, selectedGame.isR6);

  // Toggle audio
  const toggleSound = () => {
    const next = !isMuted;
    setIsMuted(next);
    sound.setMuted(next);
  };

  // Adjust local sens
  const adjustSensPercent = (percent: number) => {
    const next = Math.max(0.01, Number((localSens * (1 + percent / 100)).toFixed(selectedGame.isR6 ? 0 : 3)));
    setLocalSens(next);
    sound.play('toggle');
    if (onApplySens) onApplySens(next);
  };

  const spawnFlickTarget = useCallback((width: number, height: number) => {
    const margin = 70;
    const x = margin + Math.random() * (width - margin * 2);
    const y = margin + Math.random() * (height - margin * 2);
    stateRef.current.flickTarget = {
      x,
      y,
      radius: 22,
      createdAt: performance.now(),
      color: selectedGame.color || '#f97316'
    };
  }, [selectedGame.color]);

  const resetStats = () => {
    setTrackingScore(0);
    setFlickHits(0);
    setFlickMisses(0);
    setReactionTimes([]);
    setOvershoots(0);
    setUndershoots(0);
    stateRef.current.framesOnTarget = 0;
    stateRef.current.framesTotal = 0;
    sound.play('undo');
  };

  // Setup pointer lock listeners
  useEffect(() => {
    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === canvasRef.current;
      setIsLocked(locked);
    };

    document.addEventListener('pointerlockchange', onPointerLockChange);
    return () => {
      document.removeEventListener('pointerlockchange', onPointerLockChange);
    };
  }, []);

  // Main canvas animation & physics loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    // Initialize targets
    const width = canvas.width;
    const height = canvas.height;
    stateRef.current.targetX = width / 2;
    stateRef.current.targetY = height / 2;
    spawnFlickTarget(width, height);

    const render = () => {
      const state = stateRef.current;
      const w = canvas.width;
      const h = canvas.height;
      const centerX = w / 2;
      const centerY = h / 2;

      // Clear with dark subtle trail
      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(0, 0, w, h);

      // Draw perspective background grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      const offsetX = (state.camX * 0.5) % gridSize;
      const offsetY = (state.camY * 0.5) % gridSize;

      for (let x = offsetX; x < w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = offsetY; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Draw horizon / center alignment subtle guideline
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.moveTo(centerX - 100, centerY);
      ctx.lineTo(centerX + 100, centerY);
      ctx.moveTo(centerX, centerY - 60);
      ctx.lineTo(centerX, centerY + 60);
      ctx.stroke();

      // ================= DRILL 1: TRACKING =================
      if (drillMode === 'tracking') {
        // Move tracking target with human-like strafe oscillations
        state.targetX += state.targetVx;
        state.targetY += state.targetVy;

        // Bounce horizontally with random direction switches
        const pad = 60;
        if (state.targetX < pad) {
          state.targetX = pad;
          state.targetVx = Math.abs(state.targetVx);
        } else if (state.targetX > w - pad) {
          state.targetX = w - pad;
          state.targetVx = -Math.abs(state.targetVx);
        } else if (Math.random() < 0.015) {
          state.targetVx = (Math.random() > 0.5 ? 1 : -1) * (2.8 + Math.random() * 2.2);
        }

        // Slight vertical bobbing
        if (state.targetY < centerY - 60 || state.targetY > centerY + 60) {
          state.targetVy *= -1;
        }

        // Target coordinates relative to camera view
        // With pointer lock, moving mouse moves the camera, so target rendered at targetPos - cameraOffset
        const renderX = state.targetX - state.camX;
        const renderY = state.targetY - state.camY;

        // Check if crosshair (at screen center w/2, h/2) is hovering target
        const dist = Math.hypot(renderX - centerX, renderY - centerY);
        const isHovering = dist <= state.targetRadius;
        state.isHoveringTarget = isHovering;

        state.framesTotal++;
        if (isHovering) {
          state.framesOnTarget++;
          // Sparkle particles occasionally
          if (Math.random() < 0.4) {
            state.particles.push({
              x: renderX + (Math.random() - 0.5) * 20,
              y: renderY + (Math.random() - 0.5) * 20,
              vx: (Math.random() - 0.5) * 3,
              vy: (Math.random() - 0.5) * 3,
              alpha: 1,
              color: '#22c55e',
              size: 3 + Math.random() * 3
            });
          }
        }

        // Update react state periodically (every 10 frames)
        if (state.framesTotal % 10 === 0) {
          setTrackingScore(Math.round((state.framesOnTarget / state.framesTotal) * 100));
        }

        // Render Tracking Bot Target
        ctx.save();
        ctx.shadowColor = isHovering ? '#22c55e' : (selectedGame.color || '#f97316');
        ctx.shadowBlur = isHovering ? 25 : 12;

        // Outer aura
        ctx.beginPath();
        ctx.arc(renderX, renderY, state.targetRadius, 0, Math.PI * 2);
        ctx.fillStyle = isHovering ? 'rgba(34, 197, 94, 0.25)' : 'rgba(249, 115, 22, 0.15)';
        ctx.fill();
        ctx.strokeStyle = isHovering ? '#22c55e' : (selectedGame.color || '#f97316');
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Inner core
        ctx.beginPath();
        ctx.arc(renderX, renderY, state.targetRadius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = isHovering ? '#4ade80' : '#fbbf24';
        ctx.fill();

        // Direction arrow
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const arrowDir = state.targetVx > 0 ? 1 : -1;
        ctx.moveTo(renderX + arrowDir * 8, renderY);
        ctx.lineTo(renderX + arrowDir * (state.targetRadius + 6), renderY);
        ctx.stroke();

        ctx.restore();
      }

      // ================= DRILL 2: FLICK =================
      if (drillMode === 'flick' && state.flickTarget) {
        const ft = state.flickTarget;
        const renderX = ft.x - state.camX;
        const renderY = ft.y - state.camY;

        ctx.save();
        ctx.shadowColor = ft.color;
        ctx.shadowBlur = 18;

        // Flick Target outer ring
        ctx.beginPath();
        ctx.arc(renderX, renderY, ft.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(249, 115, 22, 0.2)';
        ctx.fill();
        ctx.strokeStyle = ft.color;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Flick Target center dot
        ctx.beginPath();
        ctx.arc(renderX, renderY, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        ctx.restore();
      }

      // ================= RENDER PARTICLES =================
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.04;
        if (p.alpha <= 0) {
          state.particles.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // ================= RENDER CROSSHAIR (SCREEN CENTER) =================
      ctx.save();
      const chColor = state.isHoveringTarget ? '#22c55e' : '#ffffff';
      ctx.strokeStyle = chColor;
      ctx.fillStyle = chColor;
      ctx.shadowColor = chColor;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 1.8;

      if (crosshairStyle === 'dot') {
        ctx.beginPath();
        ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (crosshairStyle === 'circle') {
        ctx.beginPath();
        ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(centerX, centerY, 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Classic tactical crosshair
        const gap = 4;
        const len = 9;
        ctx.beginPath();
        // Top
        ctx.moveTo(centerX, centerY - gap);
        ctx.lineTo(centerX, centerY - gap - len);
        // Bottom
        ctx.moveTo(centerX, centerY + gap);
        ctx.lineTo(centerX, centerY + gap + len);
        // Left
        ctx.moveTo(centerX - gap, centerY);
        ctx.lineTo(centerX - gap - len, centerY);
        // Right
        ctx.moveTo(centerX + gap, centerY);
        ctx.lineTo(centerX + gap + len, centerY);
        ctx.stroke();

        // Center microdot
        ctx.beginPath();
        ctx.arc(centerX, centerY, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [drillMode, crosshairStyle, selectedGame.color, spawnFlickTarget]);

  // Handle mouse movement inside canvas (with pointer lock support)
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let movementX = 0;
    let movementY = 0;

    if (document.pointerLockElement === canvas) {
      movementX = e.movementX;
      movementY = e.movementY;
    } else {
      // If not pointer locked, allow gentle drag or hover tracking
      // Calculate delta from center
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const targetCamX = (mouseX - canvas.width / 2);
      const targetCamY = (mouseY - canvas.height / 2);
      stateRef.current.camX += (targetCamX - stateRef.current.camX) * 0.1;
      stateRef.current.camY += (targetCamY - stateRef.current.camY) * 0.1;
      return;
    }

    // Convert mouse movement to camera angular delta using real game yaw & sens
    // In-game: angle = movement * yaw * sens * mult
    // Screen FOV factor: 1 count of in-game angle = ~1.3 pixels on this canvas viewport
    const effectiveYaw = selectedGame.isR6 ? selectedGame.yaw * (mult / 0.02) : selectedGame.yaw;
    const pixelPerDegree = 1.35;
    const sensFactor = effectiveYaw * localSens * (dpi / 800) * 15 * pixelPerDegree;

    stateRef.current.camX += movementX * sensFactor;
    stateRef.current.camY += movementY * sensFactor;

    // Analyze overshooting vs undershooting heuristics
    const now = performance.now();
    const dt = now - stateRef.current.lastMouseTime;
    if (dt > 16) {
      const speed = Math.abs(movementX) / dt;
      // If user moved very fast and then suddenly stopped or reversed
      if (stateRef.current.recentDeltas.length > 5) {
        stateRef.current.recentDeltas.shift();
      }
      stateRef.current.recentDeltas.push(movementX);

      // Overshoot heuristic: sudden strong reversal after target pass
      if (stateRef.current.recentDeltas.length >= 4) {
        const d1 = stateRef.current.recentDeltas[0];
        const d2 = stateRef.current.recentDeltas[stateRef.current.recentDeltas.length - 1];
        if (Math.sign(d1) !== Math.sign(d2) && Math.abs(d1) > 15 && Math.abs(d2) > 8) {
          setOvershoots(prev => prev + 1);
        } else if (speed < 0.2 && Math.abs(movementX) > 2) {
          setUndershoots(prev => prev + 1);
        }
      }

      stateRef.current.lastMouseTime = now;
      stateRef.current.lastMouseDx = movementX;
    }
  };

  // Handle click on canvas (for flick mode & pointer lock trigger)
  const handleCanvasClick = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Trigger pointer lock if not locked
    if (document.pointerLockElement !== canvas) {
      canvas.requestPointerLock();
      sound.play('click');
      return;
    }

    // If already locked and in flick mode: check hit!
    if (drillMode === 'flick' && stateRef.current.flickTarget) {
      const ft = stateRef.current.flickTarget;
      const renderX = ft.x - stateRef.current.camX;
      const renderY = ft.y - stateRef.current.camY;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      const dist = Math.hypot(renderX - centerX, renderY - centerY);
      const isHit = dist <= ft.radius;

      if (isHit) {
        const reactTime = Math.round(performance.now() - ft.createdAt);
        setFlickHits(prev => prev + 1);
        setReactionTimes(prev => [...prev.slice(-19), reactTime]);
        sound.play('target-hit');

        // Explode particles
        for (let i = 0; i < 18; i++) {
          const angle = Math.random() * Math.PI * 2;
          const spd = 2 + Math.random() * 5;
          stateRef.current.particles.push({
            x: renderX,
            y: renderY,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            alpha: 1,
            color: ft.color,
            size: 3 + Math.random() * 3
          });
        }

        // Spawn new target
        spawnFlickTarget(canvas.width, canvas.height);
      } else {
        setFlickMisses(prev => prev + 1);
        sound.play('click');

        // Check if overshoot or undershoot relative to flick target
        if (dist > ft.radius) {
          if (dist < ft.radius * 2.2) {
            setOvershoots(prev => prev + 1);
          } else {
            setUndershoots(prev => prev + 1);
          }
        }
      }
    }
  };

  const avgReactionTime = reactionTimes.length
    ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
    : 0;

  const totalOvers = overshoots;
  const totalUnders = undershoots;
  const totalDeviations = totalOvers + totalUnders || 1;
  const overshootRatio = Math.round((totalOvers / totalDeviations) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Arena Control Toolbar */}
      <div className="glass-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ background: 'var(--surface-3)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>JOGO:</span>
            <span style={{ fontWeight: 600, color: selectedGame.color }}>{selectedGame.name}</span>
          </div>
          <div style={{ background: 'var(--surface-3)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SENS:</span>
            <span className="mono" style={{ fontWeight: 700, color: 'var(--accent)' }}>
              {selectedGame.isR6 ? Math.round(localSens) : localSens.toFixed(3)}
            </span>
          </div>
          <div style={{ background: 'var(--surface-3)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>DISTÂNCIA:</span>
            <span className="mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cm360.toFixed(1)} cm/360°</span>
          </div>
        </div>

        {/* Drill Mode & Crosshair options */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: 'var(--surface-2)', padding: '3px', borderRadius: 'var(--radius-sm)' }}>
            <button
              onClick={() => { setDrillMode('tracking'); sound.play('toggle'); }}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: 600,
                background: drillMode === 'tracking' ? 'var(--accent)' : 'transparent',
                color: drillMode === 'tracking' ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.2s'
              }}
            >
              🎯 Strafe Tracking
            </button>
            <button
              onClick={() => { setDrillMode('flick'); sound.play('toggle'); }}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: 600,
                background: drillMode === 'flick' ? 'var(--accent)' : 'transparent',
                color: drillMode === 'flick' ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.2s'
              }}
            >
              ⚡ Reflex Flicks
            </button>
          </div>

          {/* Crosshair Selector */}
          <div style={{ display: 'flex', background: 'var(--surface-2)', padding: '3px', borderRadius: 'var(--radius-sm)' }}>
            {(['cross', 'dot', 'circle'] as const).map(style => (
              <button
                key={style}
                onClick={() => setCrosshairStyle(style)}
                title={`Mira ${style}`}
                style={{
                  padding: '6px 10px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  background: crosshairStyle === style ? 'var(--surface-3)' : 'transparent',
                  color: crosshairStyle === style ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                {style}
              </button>
            ))}
          </div>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            title={isMuted ? 'Ativar Som' : 'Silenciar'}
            style={{
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-2)',
              color: isMuted ? 'var(--text-muted)' : 'var(--accent)',
              display: 'flex', alignItems: 'center'
            }}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          {/* Reset Stats */}
          <button
            onClick={resetStats}
            title="Resetar Estatísticas"
            style={{
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-2)',
              color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem'
            }}
          >
            <RotateCcw size={14} /> Reset
          </button>
        </div>
      </div>

      {/* Main Interactive Canvas Area */}
      <div style={{ position: 'relative', width: '100%', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={400}
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          style={{
            display: 'block',
            width: '100%',
            height: '400px',
            cursor: isLocked ? 'none' : 'crosshair',
            background: '#0b0f19'
          }}
        />

        {/* Lock Overlay when NOT pointer locked */}
        {!isLocked && (
          <div
            onClick={handleCanvasClick}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(11, 15, 25, 0.72)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'background 0.2s'
            }}
          >
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
              display: 'grid',
              placeItems: 'center',
              boxShadow: 'var(--shadow-glow)'
            }}>
              <Crosshair size={32} color="#ffffff" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.4rem', color: '#ffffff', marginBottom: '0.25rem' }}>
                Clique para Travar a Mira (Pointer Lock)
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '480px', margin: '0 auto' }}>
                Mova seu mouse livremente como se estivesse dentro do jogo.
                Pressione <strong style={{ color: 'var(--accent)' }}>[ESC]</strong> a qualquer instante para soltar o cursor.
              </p>
            </div>
            <div style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              padding: '0.4rem 1rem',
              borderRadius: '20px',
              fontSize: '0.8rem',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Sparkles size={14} /> Modo {drillMode === 'tracking' ? 'Strafe Tracking' : 'Reflex Flicks'} ativo
            </div>
          </div>
        )}

        {/* In-game HUD overlay when LOCKED */}
        {isLocked && (
          <div style={{
            position: 'absolute',
            top: '12px',
            left: '16px',
            right: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            pointerEvents: 'none',
            fontSize: '0.85rem'
          }}>
            <div style={{
              background: 'rgba(17, 24, 39, 0.75)',
              backdropFilter: 'blur(8px)',
              padding: '6px 14px',
              borderRadius: '20px',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              <span>Mira Travada • Pressione <strong>ESC</strong> para sair</span>
            </div>

            <div style={{
              background: 'rgba(17, 24, 39, 0.75)',
              backdropFilter: 'blur(8px)',
              padding: '6px 14px',
              borderRadius: '20px',
              border: '1px solid var(--border)',
              display: 'flex',
              gap: '1rem',
              fontFamily: 'JetBrains Mono, monospace'
            }}>
              {drillMode === 'tracking' ? (
                <>
                  <span style={{ color: 'var(--text-secondary)' }}>Precisão de Tracking: <strong style={{ color: trackingScore >= 60 ? '#22c55e' : 'var(--accent)' }}>{trackingScore}%</strong></span>
                </>
              ) : (
                <>
                  <span>Acertos: <strong style={{ color: '#22c55e' }}>{flickHits}</strong></span>
                  <span>Erros: <strong style={{ color: '#ef4444' }}>{flickMisses}</strong></span>
                  {avgReactionTime > 0 && <span>Reação: <strong style={{ color: 'var(--accent)' }}>{avgReactionTime}ms</strong></span>}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Real-time Diagnostics & Sens Micro-Adjuster */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        {/* Diagnostic Card */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={18} color="var(--accent)" />
            Diagnóstico de Controle Motor
          </h4>

          {/* Overshoot vs Undershoot Balance Bar */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
              <span style={{ color: '#60a5fa' }}>Undershoot: {100 - overshootRatio}%</span>
              <span style={{ color: '#f87171' }}>Overshoot: {overshootRatio}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'var(--surface-3)', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${100 - overshootRatio}%`, background: '#3b82f6', transition: 'width 0.3s' }} />
              <div style={{ width: `${overshootRatio}%`, background: '#ef4444', transition: 'width 0.3s' }} />
            </div>
          </div>

          {/* Diagnosis Advice */}
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {overshootRatio > 62 ? (
              <div style={{ color: '#fca5a5', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  <strong>Tendência de Overshoot:</strong> Sua mira passa com frequência além do alvo ao frear o movimento.
                  Recomendamos reduzir a sensibilidade em cerca de <strong>5% a 10%</strong> para obter mais consistência.
                </span>
              </div>
            ) : overshootRatio < 38 ? (
              <div style={{ color: '#93c5fd', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  <strong>Tendência de Undershoot:</strong> Sua mira freia antes de atingir o alvo, exigindo micro-ajustes extras.
                  Experimente aumentar a sensibilidade em <strong>5% a 10%</strong>.
                </span>
              </div>
            ) : (
              <div style={{ color: '#86efac', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <Target size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  <strong>Excelente Controle Motor:</strong> Proporção balanceada entre agilidade e frenagem. A sensibilidade atual está muito próxima do ponto ideal!
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Sensibility Micro-Adjuster Card */}
        <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h4 style={{ color: 'var(--accent)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Target size={18} />
              Ajuste Fino Imediato
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Modifique a sensibilidade instantaneamente e sinta a diferença em tempo real na arena acima:
            </p>

            {/* Quick +/- percentage buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
              <button
                onClick={() => adjustSensPercent(-10)}
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '8px 4px', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 600 }}
              >
                -10%
              </button>
              <button
                onClick={() => adjustSensPercent(-5)}
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '8px 4px', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 600 }}
              >
                -5%
              </button>
              <button
                onClick={() => adjustSensPercent(5)}
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '8px 4px', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 600 }}
              >
                +5%
              </button>
              <button
                onClick={() => adjustSensPercent(10)}
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '8px 4px', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 600 }}
              >
                +10%
              </button>
            </div>
          </div>

          {/* Current Sens Indicator */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-2)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)' }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>SENSIBILIDADE ATUAL DA ARENA</div>
              <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent)' }}>
                {selectedGame.isR6 ? Math.round(localSens) : localSens.toFixed(3)}
              </div>
            </div>
            {onApplySens && (
              <button
                onClick={() => { onApplySens(localSens); sound.play('click'); }}
                className="btn-primary"
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              >
                Aplicar no Calibrador
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
