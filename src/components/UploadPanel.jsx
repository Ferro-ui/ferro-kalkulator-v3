import { useState, useCallback, useRef } from 'react'
import { t, getLang } from '../translations'
import { FILE_TYPE_LABELS } from '../utils'

const FILE_ICONS = { 'application/pdf': '📄', 'image/jpeg': '🖼', 'image/png': '🖼', 'image/webp': '🖼' }

const FILE_TYPE_COLORS = {
  supplier_tilbud: 'var(--success)', drawing: 'var(--cyan-hover)',
  kalk: 'var(--warning)', our_tilbud: 'var(--cyan-hover)',
  reference: 'var(--text-dim)', other: 'var(--text-dim)',
}

export default function UploadPanel({ files, addFiles, setFileType, onRemove }) {
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files)
  }, [addFiles])

  return (
    <div>
      <div
        className={`upload-zone-v2${dragOver ? ' drag-over' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.txt,.csv"
          style={{ display: 'none' }}
          onChange={e => addFiles(e.target.files)}
        />
        <div className="upload-icon-ring">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M11 14V6M7.5 9.5l3.5-3.5 3.5 3.5" stroke="var(--cyan-hover)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M4 15.5c0 1.7 1.3 3 3 3h8c1.7 0 3-1.3 3-3" stroke="var(--cyan-hover)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "'Big Shoulders Display',sans-serif", color: 'var(--navy)', marginBottom: 5 }}>
          {t('uploadTitle')}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.02em' }}>
          {t('uploadSubtitle')}
        </div>
      </div>

      {files.length > 0 && (
        <div className="file-chips">
          {files.map((f, i) => {
            const typeLabels = FILE_TYPE_LABELS[getLang()] || FILE_TYPE_LABELS.nb
            const typeColor  = FILE_TYPE_COLORS[f.fileType] || 'var(--text-dim)'
            return (
              <div key={i} className="file-chip">
                <span style={{ fontSize: 13, flexShrink: 0 }}>{FILE_ICONS[f.file.type] || '📎'}</span>
                <span className="file-chip-name">{f.file.name}</span>
                <span className="file-chip-size">{(f.file.size / 1024 / 1024).toFixed(1)}M</span>
                <select
                  value={f.fileType}
                  onChange={e => setFileType(i, e.target.value)}
                  style={{ padding: '2px 5px', fontSize: 9, fontWeight: 800, border: `1px solid ${typeColor}40`, borderRadius: 4, background: typeColor + '18', color: typeColor, fontFamily: "'Big Shoulders Display',sans-serif", cursor: 'pointer', flexShrink: 0 }}
                >
                  {Object.entries(typeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
                <button className="file-chip-close" onClick={() => onRemove(i)}>×</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
