import { useState } from 'react';
import { PLAYERS } from '../data/players';
import { GAMES } from '../data/games';
import { calcCm } from '../utils';

export default function Stats() {
  const [userCmInput, setUserCmInput] = useState('');
  const userCm = parseFloat(userCmInput) || 0;

  const cms = PLAYERS.map(p => {
    const g = GAMES.find(x => x.id === p.game);
    if (!g) return p.cm360 || 0;
    return p.cm360 != null ? p.cm360 : calcCm(g.yaw, p.sensH || 1, p.dpi, p.multiplier || 0.02, g.isR6);
  }).filter(c => c > 0 && c < 200).sort((a, b) => a - b);

  const avg = cms.length ? (cms.reduce((a, b) => a + b, 0) / cms.length) : 0;
  const median = cms.length ? cms[Math.floor(cms.length / 2)] : 0;

  const getTrainingPlan = (cm: number) => {
    if (!cm) return null;
    if (cm < 20) {
      return { title: 'Flick & Speed Training', desc: 'Sua sens é alta. Foque em controle de recoil e flicks precisos (ex: Pasu, Target Switching).' };
    } else if (cm < 35) {
      return { title: 'Balanced Training', desc: 'Sua sens é média. Foque em tracking contínuo e click-timing (ex: 1w4ts, Smoothness).' };
    } else {
      return { title: 'Arm Aim Training', desc: 'Sua sens é baixa. Treine movimentos amplos do braço e long-range tracking.' };
    }
  };

  const plan = getTrainingPlan(userCm);
  
  // Histogram logic
  const bucketSize = 5;
  const maxBucket = 70;
  const buckets = [];
  for (let i = 0; i < maxBucket; i += bucketSize) {
    const count = cms.filter(c => c >= i && c < i + bucketSize).length;
    buckets.push({ min: i, max: i + bucketSize, count });
  }
  const maxCount = Math.max(...buckets.map(b => b.count), 1);
  const userBucket = userCm ? Math.floor(userCm / bucketSize) : -1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Histogram */}
      <div className="glass-card">
        <h3 style={{ marginBottom: '1.5rem', color: 'var(--accent)' }}>📊 Sensitivities Distribution (cm/360°)</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '150px' }}>
          {buckets.map((b, i) => (
            <div key={i} style={{ 
              flex: 1, 
              background: i === userBucket ? 'var(--accent)' : 'var(--surface-3)', 
              height: `${(b.count / maxCount) * 100}%`,
              minHeight: '2px',
              borderRadius: '4px 4px 0 0',
              position: 'relative'
            }}>
              <div style={{ position: 'absolute', bottom: '-20px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                {b.min}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', fontSize: '0.8rem' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span><strong className="text-gradient">Avg:</strong> {avg.toFixed(1)} cm</span>
            <span><strong className="text-gradient">Med:</strong> {median.toFixed(1)} cm</span>
          </div>
          <div>Total: {cms.length} players</div>
        </div>
      </div>

      {/* Your Position */}
      <div className="glass-card">
        <h3 style={{ marginBottom: '1rem', color: 'var(--accent)' }}>🎯 Analyze your Sens</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', alignItems: 'center' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Enter your cm/360°</label>
            <input type="number" step="0.1" value={userCmInput} onChange={e => setUserCmInput(e.target.value)} placeholder="e.g. 34.5" />
          </div>
          
          {plan && (
            <div style={{ 
              background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.1), rgba(251, 191, 36, 0.05))',
              border: '1px solid var(--accent-dim)',
              padding: '1.5rem',
              borderRadius: 'var(--radius-md)'
            }}>
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚡ {plan.title}
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                {plan.desc}
              </p>
            </div>
          )}
        </div>
      </div>
      
    </div>
  );
}
