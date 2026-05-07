import { useState, useCallback, useRef } from 'react'
import { Card, Spinner } from '../ui'
import { extractProjectHistory } from '../../analyzeProject'
import {
  saveManualProject, loadManualProjects, deleteManualProject, exportManualProjectsJSON,
  detectFileType, FILE_TYPE_LABELS,
} from '../../utils'
import { getLang } from '../../translations'
import { labelSt, inputSt } from '../../styles'

const PRIS_FIELDS = [
  { key: 'yttervegg',     label: 'Yttervegg'       },
  { key: 'innervegg',     label: 'Innervegg'       },
  { key: 'tak',           label: 'Tak'             },
  { key: 'kran_lift',     label: 'Kran / lift'     },
  { key: 'dorer_vinduer', label: 'Dører / vinduer' },
  { key: 'betong',        label: 'Betong'          },
  { key: 'graving',       label: 'Graving'         },
  { key: 'sum_eks_mva',   label: 'SUM eks. mva'    },
]

export default function HistorikkModal({ onClose, apiKey }) {
  const [files, setFiles]           = useState([])
  const [dragOver, setDragOver]     = useState(false)
  const [navn, setNavn]             = useState('')
  const [extracting, setExtracting] = useState(false)
  const [status, setStatus]         = useState('')
  const [extracted, setExtracted]   = useState(null)
  const [error, setError]           = useState('')
  const [saved, setSaved]           = useState(false)
  const [manualProjects, setManualProjects] = useState(loadManualProjects)
  const fileInputRef = useRef(null)

  const addFiles = useCallback((newFiles) => {
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.file.name + f.file.size))
      return [...prev, ...Array.from(newFiles)
        .filter(f => !existing.has(f.name + f.size))
        .map(f => ({ file: f, fileType: detectFileType(f.name) }))]
    })
  }, [])

  const handleExtract = async () => {
    if (!apiKey) { setError('Legg inn API-nøkkel først'); return }
    if (!files.length) { setError('Last opp minst én fil'); return }
    setExtracting(true); setError(''); setExtracted(null)
    try {
      const data = await extractProjectHistory(files, apiKey, setStatus)
      setExtracted({ bygg: data.bygg || {}, scope: data.scope || '', priser_til_kunde: data.priser_til_kunde || {}, innkjop: data.innkjop || {}, merknader: data.merknader || '' })
    } catch (e) { setError(e.message) }
    finally { setExtracting(false); setStatus('') }
  }

  const handleSave = () => {
    if (!navn.trim()) { setError('Fyll inn prosjektnavn'); return }
    try {
      const entry = saveManualProject({ navn: navn.trim(), ...extracted })
      setManualProjects([...manualProjects, entry])
      setSaved(true)
      setNavn(''); setFiles([]); setExtracted(null)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) { setError(e.message) }
  }

  const updPris = (key, val) => setExtracted(p => ({ ...p, priser_til_kunde: { ...p.priser_til_kunde, [key]: val === '' ? null : parseInt(val) || null } }))
  const updBygg = (key, val) => setExtracted(p => ({ ...p, bygg: { ...p.bygg, [key]: val } }))
  const monoSt = { ...inputSt, fontFamily: "'JetBrains Mono',monospace", textAlign: 'right' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,30,53,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 100, padding: '24px 16px', overflowY: 'auto', backdropFilter: 'blur(4px)' }}>
      <Card style={{ width: '100%', maxWidth: 580, padding: 28, animation: 'fadeUp 0.3s ease', margin: 'auto' }}>
        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Big Shoulders Display',sans-serif", marginBottom: 4, color: 'var(--navy)' }}>Legg til i historikk</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 24 }}>Last opp filer fra et fullført prosjekt.</div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>Prosjektnavn *</label>
          <input value={navn} onChange={e => setNavn(e.target.value)} placeholder="Lagerbygg Steinsholt..." style={inputSt} />
        </div>

        {!extracting && (
          <div className={`drop-zone${dragOver ? ' drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
            onClick={() => fileInputRef.current?.click()}
            style={{ padding: '24px 16px', marginBottom: 10 }}
          >
            <input ref={fileInputRef} type="file" multiple accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={e => addFiles(e.target.files)} />
            <div style={{ fontSize: 28, marginBottom: 6 }}>📂</div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Big Shoulders Display',sans-serif", color: 'var(--navy)' }}>Dra filer hit</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>PDF, tegninger, xlsx</div>
          </div>
        )}

        {files.length > 0 && !extracting && (
          <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {files.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: 'var(--bg-input)', borderRadius: 8, fontSize: 12, border: '1px solid var(--border)' }}>
                <span>📎</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.file.name}</span>
                <span style={{ color: 'var(--text-dim)' }}>{(f.file.size / 1024 / 1024).toFixed(1)}M</span>
                <button onClick={() => setFiles(p => p.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 16 }}>×</button>
              </div>
            ))}
          </div>
        )}

        {extracting && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}><Spinner /></div>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Big Shoulders Display',sans-serif", color: 'var(--navy)' }}>{status || 'Analyserer...'}</div>
          </div>
        )}

        {extracted && !extracting && (
          <div style={{ marginTop: 4, marginBottom: 16, border: '1px solid rgba(77,184,232,0.3)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', background: 'var(--cyan-pale)', fontSize: 10, fontWeight: 700, color: 'var(--cyan-hover)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'Big Shoulders Display',sans-serif" }}>
              ✓ AI fant følgende — kontroller og korriger
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ ...labelSt, marginBottom: 8 }}>Bygginformasjon</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                {[
                  { key: 'type',        label: 'Byggtype',    ph: 'Kaldtlager / Vaskehall...' },
                  { key: 'dimensjoner', label: 'Dimensjoner', ph: '20×12×6m' },
                  { key: 'bra_m2',      label: 'BRA m²',      ph: '240' },
                  { key: 'lokasjon',    label: 'Lokasjon',    ph: 'Steinsholt' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ ...labelSt, marginBottom: 4 }}>{f.label}</label>
                    <input value={extracted.bygg[f.key] ?? ''} onChange={e => updBygg(f.key, e.target.value)} placeholder={f.ph} style={inputSt} />
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelSt}>Scope</label>
                <input value={extracted.scope} onChange={e => setExtracted(p => ({ ...p, scope: e.target.value }))} placeholder="Yttervegg + tak + porter..." style={inputSt} />
              </div>
              <div style={{ ...labelSt, marginBottom: 8 }}>Priser til kunde (kr)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                {PRIS_FIELDS.map(f => (
                  <div key={f.key}>
                    <label style={{ ...labelSt, color: f.key === 'sum_eks_mva' ? 'var(--gold)' : undefined }}>{f.label}</label>
                    <input type="number" value={extracted.priser_til_kunde[f.key] ?? ''} onChange={e => updPris(f.key, e.target.value)} placeholder="–"
                      style={{ ...monoSt, borderColor: f.key === 'sum_eks_mva' ? 'rgba(196,139,0,0.3)' : undefined }} />
                  </div>
                ))}
              </div>
              <div>
                <label style={labelSt}>Merknader</label>
                <input value={extracted.merknader ?? ''} onChange={e => setExtracted(p => ({ ...p, merknader: e.target.value }))} placeholder="Spesielle løsninger..." style={inputSt} />
              </div>
            </div>
          </div>
        )}

        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12, padding: '8px 12px', background: 'rgba(192,48,48,0.06)', borderRadius: 8, border: '1px solid rgba(192,48,48,0.18)' }}>⚠ {error}</div>}

        <div style={{ display: 'flex', gap: 8, marginBottom: manualProjects.length ? 24 : 0 }}>
          {!extracted ? (
            <button onClick={handleExtract} disabled={extracting || !files.length} className="btn-primary"
              style={{ flex: 1, padding: '12px', opacity: (!files.length || extracting) ? 0.45 : 1 }}>
              {extracting ? (status || 'Analyserer...') : '🔍 Analyser filer'}
            </button>
          ) : (
            <>
              <button onClick={handleSave} className="btn-primary" style={{ flex: 2, padding: '12px', background: saved ? '#0D7A52' : undefined }}>
                {saved ? '✓ Lagret!' : '💾 Lagre i historikk'}
              </button>
              <button onClick={() => { setExtracted(null); setFiles([]) }} className="btn-ghost" style={{ padding: '12px 14px' }}>↺ Ny</button>
            </>
          )}
          <button onClick={onClose} className="btn-ghost" style={{ padding: '12px 16px' }}>Lukk</button>
        </div>

        {manualProjects.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={labelSt}>Lagret ({manualProjects.length})</div>
              <button onClick={exportManualProjectsJSON} className="btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}>↓ JSON</button>
            </div>
            {manualProjects.map((p, i) => (
              <div key={i} style={{ padding: '9px 12px', background: 'var(--bg-input)', borderRadius: 8, marginBottom: 6, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: 'var(--navy)' }}>{p.navn} <span style={{ fontWeight: 400, color: 'var(--text-dim)' }}>{p.dato_lagt_til}</span></div>
                  <div style={{ color: 'var(--text-dim)', marginTop: 2 }}>
                    {p.bygg?.type}{p.bygg?.dimensjoner ? ` · ${p.bygg.dimensjoner}` : ''}
                    {p.priser_til_kunde?.sum_eks_mva ? ` · ${p.priser_til_kunde.sum_eks_mva.toLocaleString('nb-NO')} kr` : ''}
                  </div>
                </div>
                <button onClick={() => { deleteManualProject(i); setManualProjects(loadManualProjects()) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 18 }}>×</button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
