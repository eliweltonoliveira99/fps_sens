import { useState, useEffect } from 'react';
import { GAMES } from '../data/games';
import { calcCm, calcExactSens } from '../utils';
import { motion } from 'framer-motion';

export default function Converter() {
  const [srcGame, setSrcGame] = useState('cs2');
  const [srcSens, setSrcSens] = useState<number | string>(1.25);
  const [srcDpi, setSrcDpi] = useState<number | string>(800);
  const [srcMult, setSrcMult] = useState<number | string>(0.02);
  
  const [dstGame, setDstGame] = useState('r6');
  const [dstDpi, setDstDpi] = useState<number | string>(800);
  const [dstMult, setDstMult] = useState<number | string>(0.02);
  const [targetAds, setTargetAds] = useState<number | string>(58);
  const [targetAds25, setTargetAds25] = useState<number | string>(102);
  const [targetAds3, setTargetAds3] = useState<number | string>(103);
  const [targetAds8, setTargetAds8] = useState<number | string>(108); // Estimate for 8x based on scaling
  
  const [resultSens, setResultSens] = useState<number>(0);
  const [cm360, setCm360] = useState<number>(0);

  const sG = GAMES.find(g => g.id === srcGame);
  const dG = GAMES.find(g => g.id === dstGame);

  useEffect(() => {
    if (sG && dG && typeof srcSens === 'number' && typeof srcDpi === 'number' && typeof dstDpi === 'number') {
      const srcM = sG.isR6 && typeof srcMult === 'number' ? srcMult : 1;
      const dstM = dG.isR6 && typeof dstMult === 'number' ? dstMult : 1;
      
      const cm = calcCm(sG.yaw, srcSens, srcDpi, srcM, sG.isR6);
      setCm360(cm);
      
      const exact = calcExactSens(cm, dG.yaw, dstDpi, dstM, dG.isR6);
      setResultSens(exact);
    } else {
      setCm360(0);
      setResultSens(0);
    }
  }, [srcGame, srcSens, srcDpi, srcMult, dstGame, dstDpi, dstMult, sG, dG]);

  const handleNumChange = (val: string, setter: (v: number | string) => void) => {
    if (val === '') setter('');
    else {
      const num = parseFloat(val);
      if (!isNaN(num)) setter(num);
    }
  };

  const getR6Variations = () => {
    if (!dG?.isR6 || typeof targetAds !== 'number' || resultSens <= 0) return [];
    
    const baseHip = Math.round(resultSens);
    const constant1 = baseHip * targetAds;
    const constant25 = typeof targetAds25 === 'number' ? baseHip * targetAds25 : null;
    const constant3 = typeof targetAds3 === 'number' ? baseHip * targetAds3 : null;
    const constant8 = typeof targetAds8 === 'number' ? baseHip * targetAds8 : null;
    
    const variations = [];
    
    // Determine the step size based on the multiplier or the base hipfire magnitude
    const mult = typeof dstMult === 'number' ? dstMult : 0.02;
    const step = (mult <= 0.005 || baseHip >= 20) ? 5 : 1;
    
    // Create a sliding window around the current baseHip (-2 steps, -1 step, 0, +1 step, +2 steps)
    const offsets = [-2, -1, 0, 1, 2];
    
    for (const offset of offsets) {
      const hip = baseHip + (offset * step);
      if (hip <= 0) continue;
      
      const ads1 = Math.round(constant1 / hip);
      
      let desc = '';
      if (offset === 0) desc = '👉 (Sua sensibilidade exata)';
      else if (offset < 0) desc = '(Menos hipfire, mais ADS)';
      else desc = '(Mais hipfire, menos ADS)';

      variations.push({
        hip: hip,
        ads: ads1,
        ads25: constant25 ? Math.round(constant25 / hip) : '-',
        ads3: constant3 ? Math.round(constant3 / hip) : '-',
        ads8: constant8 ? Math.round(constant8 / hip) : '-',
        desc: desc
      });
    }
    
    return variations;
  };

  return (
    <div style={{ display: 'grid', gap: '2.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
      {/* Left Column: Inputs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div className="glass-card" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem' }}>🎮</span> Source Game
          </h3>
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                <span>🕹️</span> Game
              </label>
              <select value={srcGame} onChange={e => setSrcGame(e.target.value)}>
                {GAMES.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <span>⚙️</span> Sensitivity
                </label>
                <input type="number" step="0.01" value={srcSens} onChange={e => handleNumChange(e.target.value, setSrcSens)} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <span>🖱️</span> DPI
                </label>
                <input type="number" step="50" value={srcDpi} onChange={e => handleNumChange(e.target.value, setSrcDpi)} />
              </div>
            </div>
            {sG?.isR6 && (
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <span>✖️</span> Multiplier
                </label>
                <input type="number" step="0.001" value={srcMult} onChange={e => handleNumChange(e.target.value, setSrcMult)} />
              </div>
            )}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem' }}>🎯</span> Target Game
          </h3>
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                <span>🕹️</span> Game
              </label>
              <select value={dstGame} onChange={e => setDstGame(e.target.value)}>
                {GAMES.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                <span>🖱️</span> Target DPI
              </label>
              <input type="number" step="50" value={dstDpi} onChange={e => handleNumChange(e.target.value, setDstDpi)} />
            </div>
            {dG?.isR6 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    <span>✖️</span> Multiplier
                  </label>
                  <input type="number" step="0.001" value={dstMult} onChange={e => handleNumChange(e.target.value, setDstMult)} />
                </div>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    <span>🔭</span> Base ADS 1x
                  </label>
                  <input type="number" step="1" value={targetAds} onChange={e => handleNumChange(e.target.value, setTargetAds)} />
                </div>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    <span>🔭</span> Base ADS 2.5x
                  </label>
                  <input type="number" step="1" value={targetAds25} onChange={e => handleNumChange(e.target.value, setTargetAds25)} />
                </div>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    <span>🔭</span> Base ADS 3x
                  </label>
                  <input type="number" step="1" value={targetAds3} onChange={e => handleNumChange(e.target.value, setTargetAds3)} />
                </div>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    <span>🔭</span> Base ADS 8x
                  </label>
                  <input type="number" step="1" value={targetAds8} onChange={e => handleNumChange(e.target.value, setTargetAds8)} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Results */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '8px', height: '8px', background: 'var(--accent)', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 10px var(--accent)' }}></span>
          Conversion Result
        </h3>
        
        <div style={{ 
          background: 'linear-gradient(135deg, var(--surface-2), var(--surface-1))',
          borderRadius: 'var(--radius-lg)',
          padding: '2rem',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: '2rem',
          border: '1px solid var(--border)'
        }}>
          <div style={{ position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%', background: 'radial-gradient(circle, var(--accent-dim) 0%, transparent 60%)', opacity: 0.5, pointerEvents: 'none' }}></div>
          
          <div style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text-secondary)', marginBottom: '0.5rem', position: 'relative' }}>
            {dG?.short} Sensitivity
          </div>
          
          <motion.div 
            key={resultSens}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="mono text-gradient"
            style={{ fontSize: '3.5rem', fontWeight: 700, lineHeight: 1 }}
          >
            {resultSens > 0 ? (dG?.isR6 ? Math.round(resultSens) : resultSens.toFixed(4)) : '0.00'}
          </motion.div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: dG?.isR6 ? '1.5rem' : 'auto' }}>
          <div style={{ background: 'var(--surface-2)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Physical Distance</div>
            <div className="mono" style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>{cm360 > 0 ? cm360.toFixed(1) : '0.0'} cm/360°</div>
          </div>
          <div style={{ background: 'var(--surface-2)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>eDPI (Source)</div>
            <div className="mono" style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>{typeof srcSens === 'number' && typeof srcDpi === 'number' ? Math.round(srcSens * srcDpi) : 0}</div>
          </div>
        </div>

        {dG?.isR6 && resultSens > 0 && typeof targetAds === 'number' && (
          <div style={{ background: 'var(--surface-2)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent-dim)', marginTop: 'auto' }}>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--accent)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Alternative Sensitivities (Same ADS Feel)</h4>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '0.75rem' }}>
              {getR6Variations().map((v, i) => (
                <li key={i} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--accent)', marginTop: '2px' }}>•</span>
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>Hipfire {v.hip} | ADS 1x: {v.ads} | 2.5x: {v.ads25} | 3x: {v.ads3} | 8x: {v.ads8}</strong>
                    {v.desc && <span style={{ fontStyle: 'italic', display: 'block', marginTop: '2px', color: 'var(--text-muted)' }}>{v.desc}</span>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
