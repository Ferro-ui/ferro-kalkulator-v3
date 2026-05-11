import { useState } from 'react'
import { confidenceColor } from '../utils'
import { t } from '../translations'
import { labelSt } from '../styles'

export default function BlockRow({ block, onChange, index }) {
  const color = confidenceColor(block.confidence)
  const [open, setOpen] = useState(false)

  const handlePaslagChange = (newPct) => {
    const pct = parseFloat(newPct) || 0
    const base_low  = block.base_low  ?? block.price_low
    const base_high = block.base_high ?? block.price_high
    onChange({
      ...block,
      paslag_pct:  pct,
      price_low:   Math.round(base_low  * (1 + pct / 100) / 1000) * 1000,
      price_high:  Math.round(base_high * (1 + pct / 100) / 1000) * 1000,
    })
  }

  const fmtK = (n) => n ? Math.round(n / 1000).toLocaleString('nb-NO') + 'k' : '—'

  const numInput = (val, cb) => (
    <input type="number" value={val || ''} onChange={cb}
      style={{
        width: '100%', padding: '8px 10px', fontSize: 13,
        fontFamily: "'JetBrains Mono',monospace",
        background: 'var(--bg-input)',
        border: '1px solid var(--border)',
        borderRadius: 7, color: 'var(--text)',
        textAlign: 'right',
        transition: 'border-color 0.2s',
      }} />
  )

  return (
    <div className="block-card" style={{ animation: `blockEnter 0.35s ${index * 0.05}s ease both` }}>
      <div style={{ height: 2, background: color, opacity: 0.7 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px' }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: color + '18', border: `1px solid ${color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 800,
          fontFamily: "'Big Shoulders Display',sans-serif",
          color, flexShrink: 0,
        }}>{String(index + 1).padStart(2, '0')}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 15, fontWeight: 800,
            fontFamily: "'Big Shoulders Display',sans-serif",
            color: 'var(--navy)', letterSpacing: '0.01em', lineHeight: 1.2,
          }}>{block.name}</div>
          {block.basis && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.4 }}>{block.basis}</div>
          )}
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3, fontFamily: "'Big Shoulders Display',sans-serif" }}>Fra — Til</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>
            <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{fmtK(block.price_low)}</span>
            <span style={{ color: 'var(--text-dim)', margin: '0 4px', fontSize: 10 }}>–</span>
            <span style={{ color: 'var(--navy)' }}>{fmtK(block.price_high)}</span>
            <span style={{ color: 'var(--text-dim)', fontSize: 11, marginLeft: 2 }}>kr</span>
          </div>
        </div>

        <div style={{
          flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
          background: 'var(--cyan-pale)', border: '1px solid rgba(77,184,232,0.25)',
          borderRadius: 8, padding: '4px 10px', minWidth: 52,
        }}>
          <input type="number" value={block.paslag_pct ?? ''} onChange={e => handlePaslagChange(e.target.value)}
            style={{
              width: 40, background: 'none', border: 'none', color: 'var(--cyan-hover)',
              fontFamily: "'JetBrains Mono',monospace", fontSize: 15, fontWeight: 700,
              textAlign: 'center', padding: 0,
            }} />
          <div style={{ fontSize: 9, color: 'rgba(77,184,232,0.7)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: "'Big Shoulders Display',sans-serif", marginTop: 1 }}>påslag%</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 5, background: color + '14' }}>
            <span className="conf-dot" style={{ background: color }} />
            <span style={{ fontSize: 10, fontWeight: 800, color, fontFamily: "'Big Shoulders Display',sans-serif", letterSpacing: '0.04em' }}>{block.confidence || '?'}</span>
          </div>
          <button onClick={() => setOpen(!open)} style={{
            background: open ? 'var(--navy)' : 'var(--bg-input)',
            border: `1px solid ${open ? 'var(--navy)' : 'var(--border)'}`,
            cursor: 'pointer', width: 28, height: 28, display: 'flex',
            alignItems: 'center', justifyContent: 'center', borderRadius: 6,
            color: open ? '#fff' : 'var(--text-dim)', transition: 'all 0.2s'
          }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s' }}>
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div style={{ borderTop: '1px solid var(--border-light)', padding: '12px 18px 14px', background: 'var(--bg-input)', animation: 'fadeUp 0.2s ease' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: block.assumptions?.length || block.missing_info?.length ? 14 : 0 }}>
            <div>
              <div style={{ ...labelSt, marginBottom: 4 }}>{t('lblFrom')} (kr)</div>
              {numInput(block.price_low, e => onChange({ ...block, price_low: parseInt(e.target.value) || 0 }))}
            </div>
            <div>
              <div style={{ ...labelSt, marginBottom: 4 }}>{t('lblTo')} (kr)</div>
              {numInput(block.price_high, e => onChange({ ...block, price_high: parseInt(e.target.value) || 0 }))}
            </div>
          </div>
          {block.assumptions?.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ ...labelSt, marginBottom: 5 }}>{t('antagelser')}</div>
              {block.assumptions.map((a, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text-dim)', padding: '2px 0', display: 'flex', gap: 8 }}>
                  <span style={{ color: 'var(--cyan)', opacity: 0.5, fontSize: 10, marginTop: 2 }}>◆</span>{a}
                </div>
              ))}
            </div>
          )}
          {block.missing_info?.length > 0 && (
            <div>
              <div style={{ ...labelSt, color: 'var(--warning)', marginBottom: 5 }}>{t('missingInfo')}</div>
              {block.missing_info.map((m, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--warning)', padding: '2px 0', display: 'flex', gap: 8 }}>
                  <span style={{ opacity: 0.5, fontSize: 10, marginTop: 2 }}>▲</span>{m}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
