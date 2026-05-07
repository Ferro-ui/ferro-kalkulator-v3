import { useEffect, useRef, useState } from 'react'
import { Card } from './ui'
import BlockRow from './BlockRow'
import { fmt, fmtKr } from '../utils'
import { t } from '../translations'

function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0)
  const prev = useRef(0)
  useEffect(() => {
    if (target === 0) { setValue(0); return }
    const start = prev.current
    const diff = target - start
    const startTime = performance.now()
    let raf
    const step = (now) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 4)
      setValue(Math.round(start + diff * ease))
      if (progress < 1) raf = requestAnimationFrame(step)
      else prev.current = target
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

export default function ResultsPanel({
  result, blocks, onBlockChange,
  stalPrice, setStalPrice, riggPct, setRiggPct,
  totalLow, totalHigh, stal, riggLow, riggHigh, grandLow, grandHigh, midTotal,
  onDownloadDocx, onExportTxt, onReanalyze,
}) {
  const animatedGrandLow  = useCountUp(Math.round(grandLow))
  const animatedGrandHigh = useCountUp(Math.round(grandHigh))
  const hasStålBlock = blocks.some(b => b.id === 'stål')

  return (
    <div>
      {/* AI summary */}
      <Card style={{ padding: '18px 22px', marginBottom: 14, borderColor: 'rgba(77,184,232,0.3)' }} className="stagger-1">
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 3, height: 40, background: 'var(--cyan)', borderRadius: 2, flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--cyan-hover)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'Big Shoulders Display',sans-serif" }}>{t('aiAnalysis')}</div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)', marginBottom: result.building?.dimensions ? 8 : 0 }}>{result.project_summary}</div>
            {result.building?.dimensions && (
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: "'JetBrains Mono',monospace" }}>
                {result.building.type && <span>{result.building.type} · </span>}
                {result.building.dimensions}
                {result.building.location && <span> · {result.building.location}</span>}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Stål — manual input only shown when calculator didn't return a stål block */}
      {!hasStålBlock && (
        <Card style={{ padding: '14px 18px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 16 }} className="stagger-2">
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "'Big Shoulders Display',sans-serif", color: 'var(--navy)' }}>{t('steelWork')}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{t('steelWorkHint')}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="number" placeholder="0" value={stalPrice} onChange={e => setStalPrice(e.target.value)}
              style={{ width: 150, padding: '9px 12px', fontSize: 14, fontFamily: "'JetBrains Mono',monospace", background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--navy)', textAlign: 'right', fontWeight: 600, transition: 'border-color 0.2s' }}
              onFocus={e => e.target.style.borderColor = 'var(--cyan)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'} />
            <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: "'Big Shoulders Display',sans-serif", fontWeight: 700 }}>kr</span>
          </div>
        </Card>
      )}

      {/* Block cards */}
      <div className="stagger-3" style={{ marginBottom: 8 }}>
        {blocks.map((b, i) => <BlockRow key={b.id || i} block={b} index={i} onChange={upd => onBlockChange(i, upd)} />)}
      </div>

      {/* Rigg */}
      <Card style={{ padding: '12px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12 }} className="stagger-4">
        <span style={{ fontSize: 13, color: 'var(--text-dim)', flex: 1 }}>{t('rigg')}</span>
        <input type="number" min="0" max="30" step="0.5" value={riggPct} onChange={e => setRiggPct(parseFloat(e.target.value) || 0)}
          style={{ width: 72, padding: '8px 10px', fontSize: 14, textAlign: 'right', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--navy)', fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }} />
        <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 700 }}>%</span>
      </Card>

      {/* Grand total */}
      <div className="total-band stagger-5" style={{ marginBottom: 18 }}>
        <div style={{ marginBottom: 20, position: 'relative', zIndex: 1 }}>
          {[
            stal > 0 && { label: t('steelWork'), lo: stal, hi: stal },
            { label: `${blocks.length} ${t('subtotalBlocks')}`, lo: totalLow, hi: totalHigh },
            { label: `${t('subtotalRigg')} (${riggPct}%)`, lo: riggLow, hi: riggHigh },
          ].filter(Boolean).map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(239,243,247,0.45)', marginBottom: 8 }}>
              <span style={{ fontFamily: "'Barlow',sans-serif" }}>{r.label}</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>{r.lo === r.hi ? fmtKr(r.lo) : `${fmt(Math.round(r.lo))} – ${fmtKr(Math.round(r.hi))}`}</span>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid rgba(77,184,232,0.2)', paddingTop: 20, position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 9, color: 'rgba(77,184,232,0.65)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: "'Big Shoulders Display',sans-serif", fontWeight: 800 }}>{t('sumEksMva')}</div>
          <div style={{ fontSize: 36, fontWeight: 900, fontFamily: "'JetBrains Mono',monospace", color: 'var(--cyan)', marginBottom: 6, letterSpacing: '-0.02em', lineHeight: 1 }}>
            {animatedGrandLow.toLocaleString('nb-NO')}
            <span style={{ fontSize: 20, opacity: 0.55, margin: '0 8px' }}>–</span>
            {animatedGrandHigh.toLocaleString('nb-NO')}
            <span style={{ fontSize: 16, color: 'rgba(77,184,232,0.55)', marginLeft: 6 }}>kr</span>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(239,243,247,0.45)', fontFamily: "'JetBrains Mono',monospace", marginBottom: 8 }}>
            {t('sumInkMva')} {fmt(Math.round(grandLow * 1.25))} – {fmtKr(Math.round(grandHigh * 1.25))}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(239,243,247,0.35)', fontFamily: "'Barlow',sans-serif" }}>
            {t('midpoint')} <strong style={{ color: 'rgba(77,184,232,0.75)', fontFamily: "'JetBrains Mono',monospace" }}>{fmtKr(midTotal)}</strong>
          </div>
        </div>
      </div>

      {/* Warnings & exclusions */}
      {(result.warnings?.length > 0 || result.exclusions?.length > 0) && (
        <Card style={{ padding: '16px 18px', marginBottom: 18 }} className="stagger-5">
          {result.exclusions?.length > 0 && (
            <div style={{ marginBottom: result.warnings?.length ? 14 : 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Big Shoulders Display',sans-serif" }}>{t('utelatt')}</div>
              {result.exclusions.map((e, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text-dim)', padding: '2px 0', display: 'flex', gap: 6 }}>
                  <span style={{ color: 'var(--border)', fontWeight: 900 }}>–</span>{e}
                </div>
              ))}
            </div>
          )}
          {result.warnings?.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warning)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Big Shoulders Display',sans-serif" }}>{t('forbehold')}</div>
              {result.warnings.map((w, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--warning)', padding: '2px 0', display: 'flex', gap: 6 }}>
                  <span style={{ opacity: 0.6 }}>▲</span>{w}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 60 }} className="stagger-6">
        <button onClick={onDownloadDocx} className="btn-primary"
          style={{ flex: 2, padding: '16px', fontSize: 16, fontFamily: "'Big Shoulders Display',sans-serif", fontWeight: 800, letterSpacing: '0.02em' }}>
          {t('downloadDocx')}
        </button>
        <button onClick={onExportTxt} className="btn-ghost"
          style={{ flex: 1, padding: '16px', fontSize: 13 }}>
          {t('exportTxt')}
        </button>
        <button onClick={onReanalyze} className="btn-accent-outline"
          style={{ padding: '16px 18px', fontSize: 16 }}>&#x21BA;</button>
      </div>
    </div>
  )
}
