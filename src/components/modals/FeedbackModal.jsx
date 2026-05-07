import { useState } from 'react'
import { Card } from '../ui'
import { loadFeedback, saveFeedback } from '../../utils'
import { labelSt, inputSt } from '../../styles'

export default function FeedbackModal({ onClose, currentProject, currentGrandLow, currentGrandHigh }) {
  const [entries, setEntries] = useState(loadFeedback)
  const [form, setForm] = useState({
    name: currentProject || '',
    ai_low:  currentGrandLow  ? Math.round(currentGrandLow)  : '',
    ai_high: currentGrandHigh ? Math.round(currentGrandHigh) : '',
    faktisk_tilbud: '', solgt_for: '', kommentar: '',
  })
  const [saved, setSaved] = useState(false)
  const upd = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const handleSave = () => {
    if (!form.faktisk_tilbud) return
    const entry = {
      name: form.name, dato: new Date().toISOString().split('T')[0],
      ai_low:  parseInt(form.ai_low)  || null,
      ai_high: parseInt(form.ai_high) || null,
      faktisk_tilbud: parseInt(form.faktisk_tilbud),
      solgt_for:  form.solgt_for  ? parseInt(form.solgt_for)  : null,
      kommentar:  form.kommentar  || null,
    }
    const updated = [...entries, entry]
    saveFeedback(updated)
    setEntries(updated)
    setSaved(true)
    setForm({ name: '', ai_low: '', ai_high: '', faktisk_tilbud: '', solgt_for: '', kommentar: '' })
    setTimeout(() => setSaved(false), 2500)
  }

  const monoSt = { ...inputSt, fontFamily: "'JetBrains Mono',monospace", textAlign: 'right' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,30,53,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16, overflowY: 'auto', backdropFilter: 'blur(4px)' }}>
      <Card style={{ width: '100%', maxWidth: 540, padding: 28, animation: 'fadeUp 0.3s ease', margin: 'auto' }}>
        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Big Shoulders Display',sans-serif", marginBottom: 4, color: 'var(--navy)' }}>Faktisk pris</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 24, lineHeight: 1.5 }}>Registrer hva prosjektet faktisk ble tilbudt.</div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelSt}>Prosjektnavn</label>
          <input value={form.name} onChange={e => upd('name', e.target.value)} placeholder="Lagerbygg Steinsholt..." style={inputSt} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          {[{ label: 'AI estimat Fra (kr)', key: 'ai_low', ph: '2 200 000' }, { label: 'AI estimat Til (kr)', key: 'ai_high', ph: '2 700 000' }].map(f => (
            <div key={f.key}>
              <label style={labelSt}>{f.label}</label>
              <input type="number" value={form[f.key]} onChange={e => upd(f.key, e.target.value)} placeholder={f.ph} style={monoSt} />
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <div>
            <label style={labelSt}>Faktisk tilbud sendt (kr) *</label>
            <input type="number" value={form.faktisk_tilbud} onChange={e => upd('faktisk_tilbud', e.target.value)} placeholder="2 950 000" style={monoSt} />
          </div>
          <div>
            <label style={labelSt}>Solgt for (kr)</label>
            <input type="number" value={form.solgt_for} onChange={e => upd('solgt_for', e.target.value)} placeholder="Hvis annet" style={monoSt} />
          </div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={labelSt}>Kommentar</label>
          <input value={form.kommentar} onChange={e => upd('kommentar', e.target.value)} placeholder="f.eks. ukjent grunnforhold..." style={inputSt} />
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: entries.length ? 24 : 0 }}>
          <button onClick={handleSave} disabled={!form.faktisk_tilbud} className="btn-primary" style={{
            flex: 1, padding: '13px',
            background: saved ? '#0D7A52' : undefined,
            opacity: !form.faktisk_tilbud ? 0.45 : 1,
            cursor: !form.faktisk_tilbud ? 'not-allowed' : 'pointer',
          }}>{saved ? '✓ Lagret' : 'Registrer'}</button>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '13px 20px' }}>Lukk</button>
        </div>
        {entries.length > 0 && (
          <div>
            <div style={{ ...labelSt, marginBottom: 10 }}>Registrerte ({entries.length})</div>
            {entries.map((e, i) => {
              const aiMid = e.ai_low && e.ai_high ? Math.round((e.ai_low + e.ai_high) / 2) : null
              const pct = aiMid && e.faktisk_tilbud ? Math.round(((e.faktisk_tilbud - aiMid) / aiMid) * 100) : null
              const pctColor = pct > 0 ? 'var(--success)' : pct < 0 ? 'var(--danger)' : 'var(--text-dim)'
              return (
                <div key={i} style={{ padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 8, marginBottom: 6, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: 'var(--navy)', marginBottom: 2 }}>{e.name || '(uten navn)'} <span style={{ fontWeight: 400, color: 'var(--text-dim)' }}>{e.dato}</span></div>
                    <div style={{ color: 'var(--text-dim)', fontFamily: "'JetBrains Mono',monospace" }}>
                      {e.ai_low && e.ai_high && <span>{e.ai_low.toLocaleString('nb-NO')}–{e.ai_high.toLocaleString('nb-NO')} → </span>}
                      <span style={{ color: 'var(--text)' }}>{e.faktisk_tilbud?.toLocaleString('nb-NO')} kr</span>
                      {pct !== null && <span style={{ color: pctColor, marginLeft: 8, fontWeight: 700 }}>{pct > 0 ? '+' : ''}{pct}%</span>}
                    </div>
                  </div>
                  <button onClick={() => { const u = entries.filter((_, j) => j !== i); saveFeedback(u); setEntries(u) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 18, lineHeight: 1 }}>×</button>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
