import { useState, useEffect, useRef, useCallback } from 'react';
import { GAMES } from '../data/games';
import { calcCm, calcExactSens } from '../utils';
import { sound } from '../utils/audio';
import AimArena from './AimArena';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crosshair, Target, Timer, Play, Pause, RotateCcw, Copy, Check,
  Undo2, Award, Zap, Volume2, VolumeX,
  Compass, Share2, ShieldCheck
} from 'lucide-react';

interface HistoryStep {
  iteration: number;
  lowBound: number;
  highBound: number;
  baseEstimate: number;
  optLow: number;
  optHigh: number;
  choice: 'low' | 'high' | 'tie';
  chosenSens: number;
}

// Recommended default sensitivities & hints per game
const GAME_METRICS: Record<string, { defaultSens: number; rangeHint: string; genre: string }> = {
  cs2: { defaultSens: 1.25, rangeHint: '0.8 - 2.5', genre: 'Tac FPS (Headshot priority)' },
  valorant: { defaultSens: 0.39, rangeHint: '0.25 - 0.55', genre: 'Tac FPS (Precision flicks)' },
  r6: { defaultSens: 12, rangeHint: '5 - 35', genre: 'CQB & Micro-tracking' },
  apex: { defaultSens: 1.25, rangeHint: '0.9 - 2.5', genre: 'Fast Tracking & Movement' },
  ow2: { defaultSens: 4.16, rangeHint: '3.0 - 8.0', genre: 'Hero Arena (Dynamic 3D)' },
  wz: { defaultSens: 4.16, rangeHint: '3.0 - 8.0', genre: 'Battle Royale' },
  fn: { defaultSens: 6.5, rangeHint: '4.0 - 12.0', genre: 'Fast Build & Flick' },
  pubg: { defaultSens: 35, rangeHint: '25 - 55', genre: 'Recoil Control' },
  rust: { defaultSens: 0.4, rangeHint: '0.2 - 0.8', genre: 'Spray Patterns' },
  finals: { defaultSens: 1.37, rangeHint: '0.8 - 3.0', genre: 'Arena Destruction' },
  marvel: { defaultSens: 4.16, rangeHint: '3.0 - 8.0', genre: 'Hero Third-Person' },
  fp: { defaultSens: 0.5, rangeHint: '0.3 - 1.0', genre: 'Fast FPS' },
  tarkov: { defaultSens: 0.22, rangeHint: '0.15 - 0.5', genre: 'Tactical Sim' },
  halo: { defaultSens: 1.25, rangeHint: '0.8 - 2.5', genre: 'High TTK Tracking' },
  dl: { defaultSens: 1.25, rangeHint: '0.8 - 2.5', genre: 'Vertical MOBA Shooter' },
  df: { defaultSens: 1.25, rangeHint: '0.8 - 2.5', genre: 'Large Scale FPS' },
  xd: { defaultSens: 1.25, rangeHint: '0.8 - 2.5', genre: 'Arcade Fast Paced' },
  sd: { defaultSens: 0.39, rangeHint: '0.25 - 0.55', genre: 'Tac FPS 3v3' },
};

export default function SensFinder() {
  // Navigation / Mode state
  const [activeTab, setActiveTab] = useState<'psa' | 'arena' | 'quick'>('psa');
  const [step, setStep] = useState<'setup' | 'active' | 'result'>('setup');

  // Audio state
  const [isMuted, setIsMuted] = useState(sound.getMuted());

  // Setup inputs
  const [gameId, setGameId] = useState('cs2');
  const [dpi, setDpi] = useState<number>(800);
  const [baseSens, setBaseSens] = useState<number>(1.25);
  const [r6Mult, setR6Mult] = useState<number>(0.02);
  const [maxIterations, setMaxIterations] = useState<number>(7);

  // PSA Calibration State
  const [iteration, setIteration] = useState(1);
  const [lowBound, setLowBound] = useState(0);
  const [highBound, setHighBound] = useState(0);
  const [baseEstimate, setBaseEstimate] = useState(0);
  const [optLow, setOptLow] = useState(0);
  const [optHigh, setOptHigh] = useState(0);
  const [history, setHistory] = useState<HistoryStep[]>([]);
  const [finalSens, setFinalSens] = useState<number>(1.25);

  // Quick Mode state
  const [quickSens, setQuickSens] = useState<number>(1.25);
  const [quickStepCount, setQuickStepCount] = useState<number>(0);

  // In-Game Test Timer
  const [timerDuration, setTimerDuration] = useState<number>(45);
  const [timerRemaining, setTimerRemaining] = useState<number>(45);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  // Copy feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Canvas confetti ref
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Current game
  const g = GAMES.find(x => x.id === gameId) || GAMES[0];

  // Auto-update base sens when game changes if user hasn't heavily customized
  const handleGameChange = (newGameId: string) => {
    setGameId(newGameId);
    const defaults = GAME_METRICS[newGameId];
    if (defaults) {
      setBaseSens(defaults.defaultSens);
      setQuickSens(defaults.defaultSens);
    }
    sound.play('toggle');
  };

  // Toggle Sound
  const toggleSound = () => {
    const next = !isMuted;
    setIsMuted(next);
    sound.setMuted(next);
  };

  // Copy to clipboard helper
  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    sound.play('click');
    setTimeout(() => {
      setCopiedKey(prev => (prev === key ? null : prev));
    }, 2000);
  };

  // ================= PSA ENGINE =================
  const startPsaCalibration = () => {
    const startingBase = baseSens > 0 ? baseSens : 1.25;
    const initialLow = startingBase * 0.5;
    const initialHigh = startingBase * 1.5;

    // Iteration 1 compares the two initial bounds
    const lowCandidate = initialLow + (startingBase - initialLow) * 0.5;
    const highCandidate = startingBase + (initialHigh - startingBase) * 0.5;

    setLowBound(initialLow);
    setHighBound(initialHigh);
    setBaseEstimate(startingBase);
    setOptLow(lowCandidate);
    setOptHigh(highCandidate);
    setIteration(1);
    setHistory([]);

    // Reset timer
    setTimerRemaining(timerDuration);
    setIsTimerRunning(false);

    setStep('active');
    sound.play('complete');
  };

  const handlePsaChoice = (choice: 'low' | 'high' | 'tie') => {
    sound.play('click');

    let chosenSensValue = optLow;
    let newLow = lowBound;
    let newHigh = highBound;
    let newBase = baseEstimate;

    if (choice === 'low') {
      // Lower was preferred: narrow down to lower bracket
      chosenSensValue = optLow;
      newHigh = baseEstimate;
      newLow = lowBound;
      newBase = (newLow + newHigh) / 2;
    } else if (choice === 'high') {
      // Higher was preferred: narrow down to upper bracket
      chosenSensValue = optHigh;
      newLow = baseEstimate;
      newHigh = highBound;
      newBase = (newLow + newHigh) / 2;
    } else {
      // Tie: keep middle
      chosenSensValue = baseEstimate;
      newLow = (lowBound + baseEstimate) / 2;
      newHigh = (baseEstimate + highBound) / 2;
      newBase = (newLow + newHigh) / 2;
    }

    // Next candidates
    const nextOptLow = newLow + (newBase - newLow) * 0.5;
    const nextOptHigh = newBase + (newHigh - newBase) * 0.5;

    // Record history for Undo
    const stepRecord: HistoryStep = {
      iteration,
      lowBound,
      highBound,
      baseEstimate,
      optLow,
      optHigh,
      choice,
      chosenSens: chosenSensValue,
    };
    setHistory(prev => [...prev, stepRecord]);

    // Check if reached max iterations
    if (iteration >= maxIterations) {
      const finalResult = g.isR6 ? Math.round(newBase) : Number(newBase.toFixed(3));
      setFinalSens(finalResult);
      setStep('result');
      sound.play('complete');
    } else {
      setLowBound(newLow);
      setHighBound(newHigh);
      setBaseEstimate(newBase);
      setOptLow(nextOptLow);
      setOptHigh(nextOptHigh);
      setIteration(prev => prev + 1);

      // Reset timer for next round
      setTimerRemaining(timerDuration);
      setIsTimerRunning(false);
    }
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const lastStep = history[history.length - 1];

    setLowBound(lastStep.lowBound);
    setHighBound(lastStep.highBound);
    setBaseEstimate(lastStep.baseEstimate);
    setOptLow(lastStep.optLow);
    setOptHigh(lastStep.optHigh);
    setIteration(lastStep.iteration);
    setHistory(prev => prev.slice(0, -1));

    setTimerRemaining(timerDuration);
    setIsTimerRunning(false);
    sound.play('undo');
  };

  const resetAll = () => {
    setStep('setup');
    setIteration(1);
    setHistory([]);
    setIsTimerRunning(false);
    sound.play('undo');
  };

  // Quick Mode Handlers
  const handleQuickChoice = (action: 'up' | 'down' | 'perfect') => {
    sound.play('click');
    if (action === 'perfect') {
      const finalVal = g.isR6 ? Math.round(quickSens) : Number(quickSens.toFixed(3));
      setFinalSens(finalVal);
      setStep('result');
      sound.play('complete');
      return;
    }

    const stepMultiplier = Math.max(0.04, 0.25 * Math.pow(0.75, quickStepCount));
    let nextVal = quickSens;
    if (action === 'up') {
      nextVal = quickSens * (1 + stepMultiplier);
    } else {
      nextVal = quickSens * (1 - stepMultiplier);
    }

    setQuickSens(Math.max(0.01, Number(nextVal.toFixed(g.isR6 ? 0 : 3))));
    setQuickStepCount(prev => prev + 1);
  };

  // Timer Tick Effect
  useEffect(() => {
    let interval: number | undefined;
    if (isTimerRunning && timerRemaining > 0) {
      interval = window.setInterval(() => {
        setTimerRemaining(prev => {
          if (prev <= 1) {
            sound.play('timer-done');
            setIsTimerRunning(false);
            return 0;
          }
          if (prev <= 4) {
            sound.play('timer-tick');
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerRemaining]);

  // Confetti Particle System for Results Screen
  const launchConfetti = useCallback(() => {
    const canvas = confettiCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.parentElement?.clientWidth || 600;
    canvas.height = 350;

    const colors = ['#f97316', '#fbbf24', '#38bdf8', '#a855f7', '#22c55e', '#ffffff'];
    const particles = Array.from({ length: 65 }, () => ({
      x: canvas.width / 2 + (Math.random() - 0.5) * 50,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 12,
      vy: -Math.random() * 10 - 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      radius: 4 + Math.random() * 4,
      alpha: 1,
      decay: 0.008 + Math.random() * 0.012
    }));

    let animId: number;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.3; // gravity
        p.alpha -= p.decay;

        if (p.alpha > 0) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });

      if (alive) {
        animId = requestAnimationFrame(render);
      }
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  useEffect(() => {
    if (step === 'result') {
      const timer = setTimeout(() => {
        launchConfetti();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [step, launchConfetti]);

  // Physical calculations for result
  const finalEffectiveYaw = g.isR6 ? g.yaw * (r6Mult / 0.02) : g.yaw;
  const finalCm = calcCm(finalEffectiveYaw, finalSens, dpi, r6Mult, g.isR6);
  const finalEdpi = Math.round(finalSens * dpi);

  // Aim Style Evaluation
  const getAimStyle = (cm: number) => {
    if (cm < 22) {
      return {
        title: 'Wrist Aimer (Alta Sensibilidade)',
        badge: '⚡ Flicks Rápidos & Agilidade',
        desc: 'Sua sensibilidade permite rotações completas de 360° com mínimos movimentos do punho. Excelente para jogos verticais e combate corpo a corpo frenético.',
        padSize: 'Médio (350 x 300 mm)',
        recommendedPads: 'Artisan Raiden, ZOWIE G-SR II, Razer Strider, SteelSeries QcK',
        training: 'Foque em controle de tremor (Smoothness) e micro-flicks controlados (ex: Centering, Microshot, Pasu).'
      };
    } else if (cm <= 42) {
      return {
        title: 'Hybrid / Balanced (Sensibilidade Média)',
        badge: '🎯 Equilíbrio Tático Padrão Ouro',
        desc: 'A faixa favorita da maioria dos jogadores profissionais de CS2 e Valorant (ex: ZywOo, TenZ, Aspas). Combina o braço para grandes rotações e o punho para micro-ajustes na cabeça.',
        padSize: 'Grande (L / XL - 450 x 400 mm)',
        recommendedPads: 'Artisan Zero / Hayate Otsu, Vaxee PA, SteelSeries QcK Heavy, Lethal Gaming Gear Saturn',
        training: 'Foque em tracking contínuo de strafe e crosshair placement (ex: Smoothness Sphere, 1w4ts, Dynamic Strafe).'
      };
    } else {
      return {
        title: 'Arm Aimer (Baixa Sensibilidade)',
        badge: '🛡️ Máxima Consistência & Estabilidade',
        desc: 'Foco absoluto em estabilidade e consistência milimétrica em longas distâncias (estilo NiKo, s1mple). Quase imune a tremores involuntários na mira.',
        padSize: 'Deskmat Extra Grande (XL / XXL - 500 x 500 mm ou Deskmat 900x400)',
        recommendedPads: 'Artisan Zero XSoft, ZOWIE G-SR-SE, Lethal Gaming Gear Jupiter, Aqua Control II',
        training: 'Foque em velocidade de reposicionamento de braço e swipes rápidos de 180° (ex: Tile Frenzy, Target Switching amplo).'
      };
    }
  };

  const aimStyle = getAimStyle(finalCm);

  // Multi-game conversions table
  const convertedGames = GAMES.map(targetGame => {
    const targetMult = targetGame.isR6 ? 0.02 : 1;
    const exactSens = calcExactSens(finalCm, targetGame.yaw, dpi, targetMult, targetGame.isR6);
    return {
      game: targetGame,
      sens: targetGame.isR6 ? Math.round(exactSens) : exactSens.toFixed(3),
      exactNum: exactSens,
      ads1x: targetGame.isR6 ? 58 : null
    };
  });

  // Full report clipboard formatter
  const copyFullReport = () => {
    const report = [
      `🎯 FPS Sens Forge — Relatório de Calibração`,
      `=============================================`,
      `🎮 Jogo Base: ${g.name}`,
      `🖱️ DPI: ${dpi} | eDPI: ${finalEdpi}`,
      `📏 Sensibilidade Final: ${g.isR6 ? Math.round(finalSens) : finalSens.toFixed(3)}`,
      `📐 Distância Física: ${finalCm.toFixed(1)} cm/360°`,
      `🥋 Estilo de Mira: ${aimStyle.title}`,
      `📦 Mousepad Recomendado: ${aimStyle.padSize}`,
      ``,
      `🔄 Conversões para outros jogos:`,
      ...convertedGames.slice(0, 8).map(cg => ` • ${cg.game.short}: ${cg.sens} ${cg.ads1x ? `(ADS 1x: ${cg.ads1x})` : ''}`),
      `=============================================`,
      `Gerado por FPS Sens Forge v22`
    ].join('\n');

    copyToClipboard(report, 'full-report');
  };

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* Top Modes Header & Sound Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ color: 'var(--accent)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Compass size={24} /> Sens Finder & Calibrador Pro
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
            Encontre e aperfeiçoe sua sensibilidade ideal usando o método científico PSA ou teste em tempo real na arena.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Mode Tabs */}
          <div style={{ display: 'flex', background: 'var(--surface-2)', padding: '3px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <button
              onClick={() => { setActiveTab('psa'); sound.play('toggle'); }}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: 600,
                background: activeTab === 'psa' ? 'var(--accent)' : 'transparent',
                color: activeTab === 'psa' ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.2s'
              }}
            >
              🔬 Método PSA
            </button>
            <button
              onClick={() => { setActiveTab('arena'); sound.play('toggle'); }}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: 600,
                background: activeTab === 'arena' ? 'var(--accent)' : 'transparent',
                color: activeTab === 'arena' ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.2s'
              }}
            >
              🎯 Arena de Mira
            </button>
            <button
              onClick={() => { setActiveTab('quick'); sound.play('toggle'); }}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: 600,
                background: activeTab === 'quick' ? 'var(--accent)' : 'transparent',
                color: activeTab === 'quick' ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.2s'
              }}
            >
              ⚡ Busca Rápida
            </button>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            title={isMuted ? 'Ativar Efeitos Sonoros' : 'Silenciar'}
            style={{
              padding: '8px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: isMuted ? 'var(--text-muted)' : 'var(--accent)',
              display: 'grid', placeItems: 'center'
            }}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      </div>

      {/* ================= TAB 2: AIM ARENA (STANDALONE) ================= */}
      {activeTab === 'arena' && (
        <AimArena
          gameId={gameId}
          sens={step === 'result' ? finalSens : baseSens}
          dpi={dpi}
          mult={r6Mult}
          onApplySens={(newS) => {
            setBaseSens(newS);
            setQuickSens(newS);
          }}
        />
      )}

      {/* ================= TAB 3: QUICK MODE ================= */}
      {activeTab === 'quick' && step !== 'result' && (
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '2rem' }}>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Modo Ajuste Rápido (1 Sensibilidade Direta)
            </span>
            <h3 style={{ marginTop: '4px', color: 'var(--text-primary)' }}>
              Teste este valor no {g.name}:
            </h3>
          </div>

          <div style={{ textAlign: 'center', background: 'var(--surface-2)', padding: '2.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div className="mono text-gradient" style={{ fontSize: '4.5rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
              {g.isR6 ? Math.round(quickSens) : quickSens.toFixed(3)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <span>cm/360°: <strong className="mono" style={{ color: 'var(--text-primary)' }}>{calcCm(finalEffectiveYaw, quickSens, dpi, r6Mult, g.isR6).toFixed(1)} cm</strong></span>
              <span>eDPI: <strong className="mono" style={{ color: 'var(--text-primary)' }}>{Math.round(quickSens * dpi)}</strong></span>
            </div>

            <button
              onClick={() => copyToClipboard(String(g.isR6 ? Math.round(quickSens) : quickSens.toFixed(3)), 'quick-sens')}
              className="btn-primary"
              style={{ marginTop: '1.5rem', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0.6rem 1.5rem', fontSize: '0.9rem' }}
            >
              {copiedKey === 'quick-sens' ? <Check size={16} /> : <Copy size={16} />}
              {copiedKey === 'quick-sens' ? 'Copiado para o Clipboard!' : 'Copiar Sensibilidade'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <button
              onClick={() => handleQuickChoice('down')}
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '1.25rem', borderRadius: 'var(--radius-md)', textAlign: 'center', transition: 'all 0.2s', color: 'var(--text-primary)' }}
              onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>⏬</div>
              <div style={{ fontWeight: 600 }}>Muito Rápida</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Diminuir valor</div>
            </button>

            <button
              onClick={() => handleQuickChoice('perfect')}
              style={{ background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(16, 185, 129, 0.05))', border: '1px solid #22c55e', padding: '1.25rem', borderRadius: 'var(--radius-md)', textAlign: 'center', transition: 'all 0.2s', color: '#22c55e' }}
            >
              <div style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>🎯</div>
              <div style={{ fontWeight: 700 }}>Ficou Perfeita!</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Finalizar Calibração</div>
            </button>

            <button
              onClick={() => handleQuickChoice('up')}
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '1.25rem', borderRadius: 'var(--radius-md)', textAlign: 'center', transition: 'all 0.2s', color: 'var(--text-primary)' }}
              onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>⏫</div>
              <div style={{ fontWeight: 600 }}>Muito Lenta</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Aumentar valor</div>
            </button>
          </div>
        </div>
      )}

      {/* ================= TAB 1: PSA METHOD (MAIN FLOW) ================= */}
      {activeTab === 'psa' && (
        <AnimatePresence mode="wait">
          {/* STEP 1: SETUP */}
          {step === 'setup' && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="glass-card"
              style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '2rem' }}
            >
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Calibração Científica
                </span>
                <h2 style={{ fontSize: '1.8rem', marginTop: '4px', marginBottom: '0.5rem' }} className="text-gradient">
                  Método PSA (Perfect Sensitivity Approximation)
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '620px', margin: '0 auto' }}>
                  O método PSA afunila sistematicamente sua sensibilidade através de comparações diretas A/B entre limites superiores e inferiores, até convergir para a coordenação motora exata dos seus braços e punhos.
                </p>
              </div>

              {/* Form Controls */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                {/* Game Selector */}
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>
                    Jogo Principal
                  </label>
                  <select value={gameId} onChange={e => handleGameChange(e.target.value)}>
                    {GAMES.map(game => (
                      <option key={game.id} value={game.id}>{game.name}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {GAME_METRICS[gameId]?.genre || 'FPS'}
                  </div>
                </div>

                {/* Mouse DPI */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>DPI do Mouse</label>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Configurado no seu mouse</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    {[400, 800, 1600, 3200].map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => { setDpi(d); sound.play('toggle'); }}
                        style={{
                          flex: 1,
                          padding: '6px 0',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.8rem',
                          background: dpi === d ? 'var(--accent)' : 'var(--surface-2)',
                          color: dpi === d ? '#fff' : 'var(--text-secondary)',
                          border: '1px solid var(--border)',
                          fontWeight: dpi === d ? 700 : 500
                        }}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    value={dpi}
                    onChange={e => setDpi(Math.max(100, parseInt(e.target.value) || 800))}
                    placeholder="Custom DPI"
                  />
                </div>

                {/* Base Sensibility */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Sensibilidade Base (Ponto de Partida)</label>
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>
                      Faixa: {GAME_METRICS[gameId]?.rangeHint || '0.5 - 3.0'}
                    </span>
                  </div>
                  <input
                    type="number"
                    step={g.isR6 ? '1' : '0.01'}
                    value={baseSens}
                    onChange={e => setBaseSens(parseFloat(e.target.value) || 0)}
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Escolha uma sensibilidade que pareça aceitável no momento. Vamos testar os limites ao redor dela.
                  </div>
                </div>

                {/* Precision Iterations */}
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>
                    Precisão da Calibração
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                    {[
                      { iters: 5, label: '5 Rodadas', sub: '~5 min' },
                      { iters: 7, label: '7 Rodadas', sub: 'Padrão Ouro' },
                      { iters: 9, label: '9 Rodadas', sub: 'Cirúrgico' }
                    ].map(item => (
                      <button
                        key={item.iters}
                        type="button"
                        onClick={() => { setMaxIterations(item.iters); sound.play('toggle'); }}
                        style={{
                          padding: '8px 4px',
                          borderRadius: 'var(--radius-sm)',
                          background: maxIterations === item.iters ? 'var(--surface-3)' : 'var(--surface-2)',
                          border: `1px solid ${maxIterations === item.iters ? 'var(--accent)' : 'var(--border)'}`,
                          color: maxIterations === item.iters ? 'var(--accent)' : 'var(--text-secondary)',
                          textAlign: 'center'
                        }}
                      >
                        <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{item.label}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{item.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* R6 Specific multiplier */}
                {g.isR6 && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>
                      Multiplier R6 (GameSettings.ini)
                    </label>
                    <select value={r6Mult} onChange={e => setR6Mult(parseFloat(e.target.value))}>
                      <option value="0.02">Padrão do Jogo (0.02)</option>
                      <option value="0.002">Beaulo Multiplier (0.002)</option>
                      <option value="0.00223">Spoit Multiplier (0.00223)</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Initial Bracket Preview Card */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.08), rgba(56, 189, 248, 0.04))',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem 1.5rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1.5rem',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>DISTÂNCIA FÍSICA INICIAL</div>
                  <div className="mono" style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent)' }}>
                    {calcCm(finalEffectiveYaw, baseSens, dpi, r6Mult, g.isR6).toFixed(1)} cm/360°
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>FAIXA INICIAL DE TESTES</div>
                  <div className="mono" style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    [ {(baseSens * 0.5).toFixed(g.isR6 ? 0 : 3)} ─── {(baseSens * 1.5).toFixed(g.isR6 ? 0 : 3)} ]
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>eDPI INICIAL</div>
                  <div className="mono" style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {Math.round(baseSens * dpi)}
                  </div>
                </div>
              </div>

              {/* Start Button */}
              <button
                onClick={startPsaCalibration}
                className="btn-primary"
                style={{
                  padding: '1.1rem',
                  fontSize: '1.15rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px'
                }}
              >
                <Crosshair size={22} />
                Iniciar Calibração PSA ({maxIterations} Rodadas)
              </button>
            </motion.div>
          )}

          {/* STEP 2: ACTIVE CALIBRATION */}
          {step === 'active' && (
            <motion.div
              key="active"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
            >
              {/* Progress & Controls Bar */}
              <div className="glass-card" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{
                      background: 'var(--accent)',
                      color: '#ffffff',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      fontWeight: 700
                    }}>
                      Rodada {iteration} de {maxIterations}
                    </span>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      Testando no <strong style={{ color: g.color }}>{g.name}</strong> ({dpi} DPI)
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {history.length > 0 && (
                      <button
                        onClick={handleUndo}
                        style={{
                          background: 'var(--surface-2)',
                          border: '1px solid var(--border)',
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.8rem',
                          color: 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Undo2 size={14} /> Desfazer
                      </button>
                    )}
                    <button
                      onClick={resetAll}
                      style={{
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)'
                      }}
                    >
                      Recomeçar
                    </button>
                  </div>
                </div>

                {/* Linear Progress Bar */}
                <div style={{ width: '100%', background: 'var(--surface-3)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${(iteration / maxIterations) * 100}%`,
                      background: 'linear-gradient(90deg, var(--accent), var(--accent-hover))',
                      height: '100%',
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>

                {/* Bracket Convergence Gauge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <span>Limite Inferior: <strong className="mono" style={{ color: 'var(--text-secondary)' }}>{g.isR6 ? Math.round(lowBound) : lowBound.toFixed(3)}</strong></span>
                  <span style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Target size={14} /> Faixa afunilando em {Math.round((1 - (highBound - lowBound) / (baseEstimate || 1)) * 100)}%
                  </span>
                  <span>Limite Superior: <strong className="mono" style={{ color: 'var(--text-secondary)' }}>{g.isR6 ? Math.round(highBound) : highBound.toFixed(3)}</strong></span>
                </div>
              </div>

              {/* Side-by-Side Comparison Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>

                {/* OPTION A: LOWER SENS */}
                <div className="glass-card" style={{
                  padding: '2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1.5rem',
                  borderTop: '4px solid #38bdf8'
                }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                        OPÇÃO A (MAIS BAIXA)
                      </span>
                      <button
                        onClick={() => copyToClipboard(String(g.isR6 ? Math.round(optLow) : optLow.toFixed(3)), 'optLow')}
                        style={{
                          background: 'var(--surface-2)',
                          border: '1px solid var(--border)',
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.75rem',
                          color: copiedKey === 'optLow' ? '#22c55e' : 'var(--text-secondary)',
                          display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                      >
                        {copiedKey === 'optLow' ? <Check size={14} /> : <Copy size={14} />}
                        {copiedKey === 'optLow' ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>

                    <div className="mono text-gradient" style={{ fontSize: '3.8rem', fontWeight: 700, margin: '1rem 0 0.5rem 0' }}>
                      {g.isR6 ? Math.round(optLow) : optLow.toFixed(3)}
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <span>cm/360°: <strong className="mono" style={{ color: 'var(--text-primary)' }}>{calcCm(finalEffectiveYaw, optLow, dpi, r6Mult, g.isR6).toFixed(1)} cm</strong></span>
                      <span>eDPI: <strong className="mono" style={{ color: 'var(--text-primary)' }}>{Math.round(optLow * dpi)}</strong></span>
                    </div>
                  </div>

                  <button
                    onClick={() => handlePsaChoice('low')}
                    className="btn-primary"
                    style={{
                      padding: '1rem',
                      fontSize: '1rem',
                      background: '#0284c7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <Check size={18} />
                    Opção A foi Mais Confortável
                  </button>
                </div>

                {/* OPTION B: HIGHER SENS */}
                <div className="glass-card" style={{
                  padding: '2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1.5rem',
                  borderTop: '4px solid #f97316'
                }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ background: 'rgba(249, 115, 22, 0.15)', color: '#f97316', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                        OPÇÃO B (MAIS ALTA)
                      </span>
                      <button
                        onClick={() => copyToClipboard(String(g.isR6 ? Math.round(optHigh) : optHigh.toFixed(3)), 'optHigh')}
                        style={{
                          background: 'var(--surface-2)',
                          border: '1px solid var(--border)',
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.75rem',
                          color: copiedKey === 'optHigh' ? '#22c55e' : 'var(--text-secondary)',
                          display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                      >
                        {copiedKey === 'optHigh' ? <Check size={14} /> : <Copy size={14} />}
                        {copiedKey === 'optHigh' ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>

                    <div className="mono text-gradient" style={{ fontSize: '3.8rem', fontWeight: 700, margin: '1rem 0 0.5rem 0' }}>
                      {g.isR6 ? Math.round(optHigh) : optHigh.toFixed(3)}
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <span>cm/360°: <strong className="mono" style={{ color: 'var(--text-primary)' }}>{calcCm(finalEffectiveYaw, optHigh, dpi, r6Mult, g.isR6).toFixed(1)} cm</strong></span>
                      <span>eDPI: <strong className="mono" style={{ color: 'var(--text-primary)' }}>{Math.round(optHigh * dpi)}</strong></span>
                    </div>
                  </div>

                  <button
                    onClick={() => handlePsaChoice('high')}
                    className="btn-primary"
                    style={{
                      padding: '1rem',
                      fontSize: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <Check size={18} />
                    Opção B foi Mais Confortável
                  </button>
                </div>
              </div>

              {/* Tie Option */}
              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={() => handlePsaChoice('tie')}
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    padding: '0.75rem 1.5rem',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  ⚖️ Ambas parecem boas / Manter a média e afunilar
                </button>
              </div>

              {/* In-Game Test Assistant & Timer Section */}
              <div className="glass-card" style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', alignItems: 'center' }}>
                {/* Timer Box */}
                <div style={{ background: 'var(--surface-2)', padding: '1.25rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Timer size={16} /> Cronômetro de Teste
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {[30, 45, 60].map(s => (
                        <button
                          key={s}
                          onClick={() => { setTimerDuration(s); setTimerRemaining(s); setIsTimerRunning(false); }}
                          style={{
                            fontSize: '0.7rem',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: timerDuration === s ? 'var(--accent)' : 'var(--surface-3)',
                            color: timerDuration === s ? '#fff' : 'var(--text-muted)'
                          }}
                        >
                          {s}s
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mono" style={{ fontSize: '3rem', fontWeight: 700, color: timerRemaining <= 5 && timerRemaining > 0 ? '#ef4444' : 'var(--text-primary)' }}>
                    00:{timerRemaining < 10 ? `0${timerRemaining}` : timerRemaining}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <button
                      onClick={() => { setIsTimerRunning(!isTimerRunning); sound.play('click'); }}
                      className="btn-primary"
                      style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      {isTimerRunning ? <Pause size={14} /> : <Play size={14} />}
                      {isTimerRunning ? 'Pausar' : 'Iniciar Teste'}
                    </button>
                    <button
                      onClick={() => { setTimerRemaining(timerDuration); setIsTimerRunning(false); sound.play('undo'); }}
                      style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                </div>

                {/* Practical In-Game Exercises Guide */}
                <div>
                  <h4 style={{ color: 'var(--accent)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Zap size={18} /> O que testar no jogo durante esta rodada:
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 700 }}>1.</span>
                      <span><strong>Strafe Tracking:</strong> Fixe a mira na cabeça de um bot e ande para esquerda/direita. A mira treme ou passa do alvo? (Sens alta). A mira fica para trás? (Sens baixa).</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 700 }}>2.</span>
                      <span><strong>Flicks de 90°:</strong> Vire rapidamente em alvos laterais. Sente que passou da cabeça (overshoot) ou faltou espaço de braço (undershoot)?</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--accent)', fontWeight: 700 }}>3.</span>
                      <span><strong>Micro-correções:</strong> Tente pequenos ajustes rápidos. Qual das duas sensibilidades proporcionou mais tranquilidade e menos tensão na mão?</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* History trail preview if available */}
              {history.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                  {history.map((h, i) => (
                    <div key={i} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>R{h.iteration}:</span>
                      <strong style={{ color: h.choice === 'low' ? '#38bdf8' : h.choice === 'high' ? '#f97316' : 'var(--text-primary)' }}>
                        {g.isR6 ? Math.round(h.chosenSens) : h.chosenSens.toFixed(3)}
                      </strong>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* STEP 3: CELEBRATION & FINAL REPORT */}
          {step === 'result' && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '2rem' }}
            >
              {/* Confetti Canvas */}
              <canvas
                ref={confettiCanvasRef}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '350px',
                  pointerEvents: 'none',
                  zIndex: 2
                }}
              />

              {/* Hero Banner Card */}
              <div className="glass-card" style={{
                textAlign: 'center',
                padding: '3rem 2rem',
                border: '1px solid var(--accent)',
                boxShadow: 'var(--shadow-glow)'
              }}>
                <div style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                  display: 'grid',
                  placeItems: 'center',
                  margin: '0 auto 1.5rem auto',
                  boxShadow: 'var(--shadow-glow)'
                }}>
                  <Award size={40} color="#ffffff" />
                </div>

                <span style={{ background: 'rgba(249, 115, 22, 0.15)', color: 'var(--accent)', padding: '4px 14px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 700 }}>
                  CALIBRAÇÃO CONCLUÍDA COM SUCESSO
                </span>

                <h2 style={{ fontSize: '2.4rem', marginTop: '0.75rem', marginBottom: '0.5rem' }} className="text-gradient">
                  Sua Sensibilidade Ideal para {g.name}
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                  Com base no afunilamento PSA e na sua memória motora com {dpi} DPI:
                </p>

                {/* Big Final Sens Display */}
                <div className="mono text-gradient" style={{ fontSize: '5rem', fontWeight: 800, margin: '1.5rem 0' }}>
                  {g.isR6 ? Math.round(finalSens) : finalSens.toFixed(3)}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => copyToClipboard(String(g.isR6 ? Math.round(finalSens) : finalSens.toFixed(3)), 'final-sens')}
                    className="btn-primary"
                    style={{ padding: '0.75rem 1.8rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    {copiedKey === 'final-sens' ? <Check size={18} /> : <Copy size={18} />}
                    {copiedKey === 'final-sens' ? 'Sensibilidade Copiada!' : 'Copiar Sensibilidade'}
                  </button>

                  <button
                    onClick={() => copyToClipboard(`sensitivity ${finalSens.toFixed(3)}`, 'console-cmd')}
                    style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      padding: '0.75rem 1.4rem',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {copiedKey === 'console-cmd' ? <Check size={16} /> : <Copy size={16} />}
                    {copiedKey === 'console-cmd' ? 'Comando Copiado!' : 'Copiar Comando de Console'}
                  </button>
                </div>
              </div>

              {/* Physical Profile & Aim Diagnosis */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {/* Physical Metrics */}
                <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <h4 style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Compass size={18} color="var(--accent)" />
                    Métricas Físicas de Mira
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div style={{ background: 'var(--surface-2)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>DISTÂNCIA FÍSICA (cm/360°)</div>
                      <div className="mono" style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--accent)' }}>
                        {finalCm.toFixed(1)} <span style={{ fontSize: '0.9rem', fontWeight: 400 }}>cm</span>
                      </div>
                    </div>
                    <div style={{ background: 'var(--surface-2)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>eDPI EFETIVO</div>
                      <div className="mono" style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {finalEdpi}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>ESTILO MECÂNICO</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {aimStyle.title}
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
                      {aimStyle.desc}
                    </p>
                  </div>
                </div>

                {/* Mousepad & Routine Recommendation */}
                <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <h4 style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={18} color="#22c55e" />
                    Setup & Equipamento Recomendado
                  </h4>

                  <div style={{ background: 'var(--surface-2)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TAMANHO DE MOUSEPAD IDEAL</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#22c55e' }}>
                      {aimStyle.padSize}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Modelos de referência: {aimStyle.recommendedPads}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>ROTINA NO AIMLABS / KOVAAKS</div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                      {aimStyle.training}
                    </p>
                  </div>
                </div>
              </div>

              {/* Universal Multi-Game Conversion Table */}
              <div className="glass-card" style={{ padding: '1.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <h3 style={{ color: 'var(--accent)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Share2 size={18} /> Conversão Universal para Outros Jogos
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                      Mantenha a exata mesma memória muscular de {finalCm.toFixed(1)} cm/360° em todos os seus jogos favoritos:
                    </p>
                  </div>

                  <button
                    onClick={copyFullReport}
                    style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-sm)',
                      color: copiedKey === 'full-report' ? '#22c55e' : 'var(--text-primary)',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {copiedKey === 'full-report' ? <Check size={16} /> : <Copy size={16} />}
                    {copiedKey === 'full-report' ? 'Relatório Completo Copiado!' : 'Copiar Relatório Completo'}
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                  {convertedGames.map(({ game, sens, ads1x }) => (
                    <div
                      key={game.id}
                      style={{
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        padding: '1rem',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        borderLeft: `3px solid ${game.color}`
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          {game.short}
                        </span>
                        <button
                          onClick={() => copyToClipboard(String(sens), `conv-${game.id}`)}
                          title={`Copiar para ${game.name}`}
                          style={{
                            background: 'var(--surface-3)',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            color: copiedKey === `conv-${game.id}` ? '#22c55e' : 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {copiedKey === `conv-${game.id}` ? <Check size={12} /> : <Copy size={12} />}
                          {copiedKey === `conv-${game.id}` ? 'OK' : 'Copiar'}
                        </button>
                      </div>

                      <div className="mono" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent)' }}>
                        {sens}
                      </div>

                      {ads1x && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          ADS 1x Recomendado: <strong style={{ color: 'var(--text-primary)' }}>{ads1x}</strong>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => { setActiveTab('arena'); sound.play('click'); }}
                  className="btn-primary"
                  style={{ padding: '0.85rem 1.8rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Target size={18} />
                  Testar esta Sensibilidade na Arena de Mira
                </button>
                <button
                  onClick={resetAll}
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    padding: '0.85rem 1.8rem',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <RotateCcw size={18} />
                  Fazer Nova Calibração
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

    </div>
  );
}
