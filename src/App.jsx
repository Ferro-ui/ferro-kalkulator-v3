import { Fragment } from 'react'
import { FERRO_LOGO_B64 } from './ferroLogo'
import { useProject } from './hooks/useProject'
import { Card, Spinner } from './components/ui'
import UploadPanel from './components/UploadPanel'
import ResultsPanel from './components/ResultsPanel'
import TilbudModal from './components/modals/TilbudModal'
import FeedbackModal from './components/modals/FeedbackModal'
import HistorikkModal from './components/modals/HistorikkModal'
import { t, getLang, setLang } from './translations'

export default function App() {
  const {
    apiKey, showKey, setShowKey,
    projectName, setProjectName,
    files, setFiles, addFiles, setFileType,
    extraInfo, setExtraInfo,
    analyzing, status, error,
    result, blocks,
    stalPrice, setStalPrice,
    riggPct, setRiggPct,
    showTilbudModal, setShowTilbudModal,
    showFeedbackModal, setShowFeedbackModal,
    showHistorikkModal, setShowHistorikkModal,
    generatingBrev, brevStatus,
    handleKeyChange,
    handleAnalyze,
    handleBlockChange,
    handleReset,
    handleGenerateBrev,
    handleExportSummary,
    totalLow, totalHigh, stal, riggLow, riggHigh, grandLow, grandHigh, midTotal,
  } = useProject()

  return (
    <div style={{ minHeight: '100vh' }}>

      {showTilbudModal && (
        <TilbudModal
          onClose={() => setShowTilbudModal(false)}
          onGenerate={handleGenerateBrev}
          generating={generatingBrev}
          generatingStatus={brevStatus}
          aiForutsetninger={result?.forutsetninger}
        />
      )}
      {showFeedbackModal && (
        <FeedbackModal
          onClose={() => setShowFeedbackModal(false)}
          currentProject={projectName}
          currentGrandLow={result ? grandLow : null}
          currentGrandHigh={result ? grandHigh : null}
        />
      )}
      {showHistorikkModal && (
        <HistorikkModal onClose={() => setShowHistorikkModal(false)} apiKey={apiKey} />
      )}

      {/* Navbar */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        height: 58, display: 'flex', alignItems: 'stretch',
        background: 'rgba(13,30,53,0.94)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(77,184,232,0.18)',
        boxShadow: '0 4px 28px rgba(0,0,0,0.22)',
      }}>
        <div className="nav-logo-zone">
          <img src={`data:image/png;base64,${FERRO_LOGO_B64}`} alt="Ferro Stålentreprenør AS"
            className="nav-logo-img" />
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 16px', gap: 4 }}>
          {result && (
            <button onClick={handleReset} className="nav-ghost">
              {t('nullstill')}
            </button>
          )}
          <div className="nav-sep" />
          <button onClick={() => setShowFeedbackModal(true)} title="Registrer faktisk pris" className="nav-icon-btn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </button>
          <button onClick={() => setShowHistorikkModal(true)} title="Legg til i historikk" className="nav-icon-btn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><polyline points="12 7 12 12 15 15"/>
            </svg>
          </button>
          <div className="nav-sep" />
          <button
            onClick={() => { setLang(getLang() === 'nb' ? 'uk' : 'nb'); window.location.reload() }}
            className="nav-pill-btn">
            {getLang() === 'nb' ? 'UA' : 'NO'}
          </button>
          <button onClick={() => setShowKey(!showKey)} className={`nav-pill-btn nav-key-btn${apiKey ? ' nav-key-active' : ''}`} title="API-nøkkel">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>
            </svg>
            <span className="nav-key-dot" />
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '44px 20px' }}>

        {/* Hero */}
        <div style={{ marginBottom: 36 }} className="stagger-1">
          <div style={{ width: 40, height: 4, background: 'var(--cyan)', borderRadius: 2, marginBottom: 14 }} />
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: "'Big Shoulders Display',sans-serif", marginBottom: 6 }}>
            Ferro Stålentreprenør AS
          </div>
          <h1 style={{ fontSize: 46, fontWeight: 900, fontFamily: "'Big Shoulders Display',sans-serif", color: 'var(--navy)', letterSpacing: '-0.02em', lineHeight: 1.05, marginBottom: 16 }}>
            {t('appTitle')}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {t('appSubtitle').split(' → ').map((step, i, arr) => (
              <Fragment key={i}>
                <span className="step-pill">{step}</span>
                {i < arr.length - 1 && <span className="step-arrow">→</span>}
              </Fragment>
            ))}
          </div>
        </div>

        {/* API key panel */}
        {showKey && (
          <Card style={{ padding: '18px 20px', marginBottom: 20, animation: 'fadeUp 0.25s ease' }}>
            <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "'Big Shoulders Display',sans-serif", marginBottom: 4, color: 'var(--navy)' }}>{t('apiKeyTitle')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 14 }}>{t('apiKeyHint')}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="password" placeholder="sk-ant-..." value={apiKey} onChange={e => handleKeyChange(e.target.value)}
                style={{ flex: 1, padding: '10px 14px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontFamily: "'JetBrains Mono',monospace" }} />
              <button onClick={() => setShowKey(false)} className="btn-primary" style={{ padding: '10px 20px', fontSize: 13 }}>{t('save')}</button>
            </div>
          </Card>
        )}

        {/* Input panel */}
        {!analyzing && (
          <>
            <div className="input-panel stagger-2">

              {/* Project name */}
              <div className="input-section">
                <input
                  type="text"
                  className="project-name-field"
                  placeholder={t('projectNamePlaceholder')}
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                />
              </div>

              {/* Upload */}
              <div className="input-section">
                <div className="section-label">
                  <span className="section-num">01</span>
                  {t('sectionFiles')}
                </div>
                <UploadPanel
                  files={files}
                  addFiles={addFiles}
                  setFileType={setFileType}
                  onRemove={i => setFiles(p => p.filter((_, j) => j !== i))}
                />
              </div>

              {/* Extra info */}
              <div className="input-section">
                <div className="section-label">
                  <span className="section-num">02</span>
                  {t('extraInfoTitle')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8, lineHeight: 1.5 }}>{t('extraInfoHint')}</div>
                <textarea
                  placeholder={t('extraInfoPlaceholder')}
                  value={extraInfo}
                  onChange={e => setExtraInfo(e.target.value)}
                  rows={3}
                  style={{ width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontFamily: "'Barlow',sans-serif", resize: 'vertical', lineHeight: 1.6, transition: 'border-color 0.2s' }}
                />
              </div>

            </div>
            <button onClick={handleAnalyze} className="btn-primary btn-analyze"
              style={{ width: '100%', padding: '18px', fontSize: 18, borderRadius: 10, marginBottom: 28, letterSpacing: '0.03em', fontFamily: "'Big Shoulders Display',sans-serif", fontWeight: 900 }}>
              {t('analyzeBtn')}
            </button>
          </>
        )}

        {/* Project name while analyzing / showing results */}
        {analyzing && (
          <div style={{ marginBottom: 16 }}>
            <input
              type="text"
              className="project-name-field"
              placeholder={t('projectNamePlaceholder')}
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
            />
          </div>
        )}

        {/* Loading */}
        {analyzing && (
          <Card style={{ padding: '52px 24px', textAlign: 'center', marginBottom: 28, animation: 'fadeUp 0.3s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}><Spinner /></div>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Big Shoulders Display',sans-serif", marginBottom: 6, color: 'var(--navy)' }}>{status || t('analyzing')}</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{t('analyzingSub')}</div>
          </Card>
        )}

        {/* Error */}
        {error && (
          <div style={{ padding: '14px 18px', marginBottom: 20, borderRadius: 10, background: 'rgba(192,48,48,0.06)', border: '1px solid rgba(192,48,48,0.20)', color: 'var(--danger)', fontSize: 13 }}>
            ⚠ {error}
          </div>
        )}

        {/* Results */}
        {result && !analyzing && (
          <ResultsPanel
            result={result}
            blocks={blocks}
            onBlockChange={handleBlockChange}
            stalPrice={stalPrice}
            setStalPrice={setStalPrice}
            riggPct={riggPct}
            setRiggPct={setRiggPct}
            totalLow={totalLow}
            totalHigh={totalHigh}
            stal={stal}
            riggLow={riggLow}
            riggHigh={riggHigh}
            grandLow={grandLow}
            grandHigh={grandHigh}
            midTotal={midTotal}
            onDownloadDocx={() => setShowTilbudModal(true)}
            onExportTxt={handleExportSummary}
            onReanalyze={handleAnalyze}
          />
        )}

      </div>
    </div>
  )
}
