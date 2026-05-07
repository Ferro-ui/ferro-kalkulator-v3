import { useState } from 'react'
import { Card } from '../ui'
import { t } from '../../translations'
import { loadSigner, saveSigner } from '../../utils'
import { labelSt, inputSt } from '../../styles'

export default function TilbudModal({ onClose, onGenerate, generating, generatingStatus, aiForutsetninger }) {
  const [kunde, setKunde] = useState({ firma: '', kontakt: '', adresse: '' })
  const [signer, setSigner] = useState(loadSigner)
  const [forutsetninger, setForutsetninger] = useState(() => ({
    u_verdi_tak:       aiForutsetninger?.u_verdi_tak       ?? 0.18,
    u_verdi_vegg:      aiForutsetninger?.u_verdi_vegg      ?? 0.18,
    u_verdi_glass:     aiForutsetninger?.u_verdi_glass     ?? 1.2,
    tiltaksklasse:     aiForutsetninger?.tiltaksklasse     ?? '2',
    bruddgrense_kn_m2: aiForutsetninger?.bruddgrense_kn_m2 ?? 250,
    gyldighet_dager:   aiForutsetninger?.gyldighet_dager   ?? 14,
  }))

  const handleGenerate = () => { saveSigner(signer); onGenerate(kunde, signer, forutsetninger) }
  const updF = (key, val) => setForutsetninger(p => ({ ...p, [key]: val }))
  const miniSt = { ...inputSt, padding: '8px 10px', fontSize: 13, fontFamily: "'JetBrains Mono',monospace", textAlign: 'right' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,30,53,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16, overflowY: 'auto', backdropFilter: 'blur(4px)' }}>
      <Card style={{ width: '100%', maxWidth: 500, padding: 28, animation: 'fadeUp 0.3s ease', margin: 'auto' }}>
        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Big Shoulders Display',sans-serif", marginBottom: 4, color: 'var(--navy)' }}>{t('modalTitle')}</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 24 }}>{t('modalSubtitle')}</div>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--cyan-hover)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12, fontFamily: "'Big Shoulders Display',sans-serif" }}>{t('kunde')}</div>
        {[
          { label: t('firma'),   key: 'firma',   placeholder: t('firmaPlaceholder')   },
          { label: t('kontakt'), key: 'kontakt', placeholder: t('kontaktPlaceholder') },
          { label: t('adresse'), key: 'adresse', placeholder: t('adressePlaceholder') },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: 12 }}>
            <label style={labelSt}>{f.label}</label>
            <input value={kunde[f.key]} onChange={e => setKunde(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} style={inputSt} />
          </div>
        ))}

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--cyan-hover)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 20, marginBottom: 12, fontFamily: "'Big Shoulders Display',sans-serif" }}>{t('signatur')}</div>
        {[
          { label: t('navn'),     key: 'name',  placeholder: 'Marian Mychko'       },
          { label: t('stilling'), key: 'title', placeholder: 'Kalkulatør'          },
          { label: t('tlf'),      key: 'tlf',   placeholder: '91 92 36 26'         },
          { label: t('email'),    key: 'email', placeholder: 'marian@ferrostal.no'  },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: 12 }}>
            <label style={labelSt}>{f.label}</label>
            <input value={signer[f.key] || ''} onChange={e => setSigner(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} style={inputSt} />
          </div>
        ))}
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4, fontStyle: 'italic' }}>{t('signerSaveHint')}</div>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--cyan-hover)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 20, marginBottom: 12, fontFamily: "'Big Shoulders Display',sans-serif" }}>{t('forutsetninger')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
          {[
            { label: t('uVerdiTak'),   key: 'u_verdi_tak',  step: 0.01 },
            { label: t('uVerdiVegg'),  key: 'u_verdi_vegg', step: 0.01 },
            { label: t('uVerdiGlass'), key: 'u_verdi_glass',step: 0.1  },
          ].map(fld => (
            <div key={fld.key}>
              <label style={{ ...labelSt, marginBottom: 4 }}>{fld.label}</label>
              <input type="number" step={fld.step} value={forutsetninger[fld.key] ?? ''}
                onChange={e => updF(fld.key, e.target.value === '' ? null : parseFloat(e.target.value))}
                placeholder="–" style={miniSt} />
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 4 }}>
          {[
            { label: t('tiltaksklasse'), key: 'tiltaksklasse',     type: 'text',   val: forutsetninger.tiltaksklasse,      cb: e => updF('tiltaksklasse', e.target.value) },
            { label: t('bruddgrense'),   key: 'bruddgrense_kn_m2', type: 'number', val: forutsetninger.bruddgrense_kn_m2,  cb: e => updF('bruddgrense_kn_m2', parseInt(e.target.value) || 0) },
            { label: t('gyldighet'),     key: 'gyldighet_dager',   type: 'number', val: forutsetninger.gyldighet_dager,    cb: e => updF('gyldighet_dager', parseInt(e.target.value) || 14) },
          ].map(f => (
            <div key={f.key}>
              <label style={{ ...labelSt, marginBottom: 4 }}>{f.label}</label>
              <input type={f.type} value={f.val} onChange={f.cb} style={miniSt} />
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6, fontStyle: 'italic' }}>{t('uVerdiHint')}</div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={handleGenerate} disabled={generating} className="btn-primary"
            style={{ flex: 1, padding: '14px', opacity: generating ? 0.7 : 1, cursor: generating ? 'wait' : 'pointer' }}>
            {generating ? (generatingStatus || t('generating')) : t('generateDocx')}
          </button>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '14px 20px' }}>{t('cancel')}</button>
        </div>
      </Card>
    </div>
  )
}
