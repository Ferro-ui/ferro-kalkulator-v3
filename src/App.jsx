import { Fragment, useState } from 'react'
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
  const [activeTab, setActiveTab] = useState('overview')

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

      {/* Floating Dock Navbar */}
      <div className="floating-dock">
        <div className="dock-logo-zone">
          <img src={`data:image/png;base64,${FERRO_LOGO_B64}`} alt="Ferro Stålentreprenør AS" className="dock-logo" />
        </div>
        <div className="dock-controls">
          {result && (
            <>
              <button onClick={handleReset} className="dock-button">{t('nullstill')}</button>
              <div className="dock-separator" />
            </>
          )}
          <button onClick={() => setShowFeedbackModal(true)} className="dock-button" title="Registrer faktisk pris">📊</button>
          <button onClick={() => setShowHistorikkModal(true)} className="dock-button" title="Legg til i historikk">📁</button>
          <div className="dock-separator" />
          <button onClick={() => { setLang(getLang() === 'nb' ? 'uk' : 'nb'); window.location.reload() }} className="dock-button">
            {getLang() === 'nb' ? '🇺🇦' : '🇳🇴'}
          </button>
          <button onClick={() => setShowKey(!showKey)} className="dock-button" title="API-nøkkel">🔑</button>
        </div>
      </div>

      <div className="main-content">

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

        {/* Results with Tabs & Bento Grid */}
        {result && !analyzing && (
          <>
            {/* Tabs Header */}
            <div className="tabs-header" style={{ marginTop: 40 }}>
              <button
                className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                Oversikt
              </button>
              <button
                className={`tab-button ${activeTab === 'blocks' ? 'active' : ''}`}
                onClick={() => setActiveTab('blocks')}
              >
                Kostblokker
              </button>
              <button
                className={`tab-button ${activeTab === 'summary' ? 'active' : ''}`}
                onClick={() => setActiveTab('summary')}
              >
                Oppsummering
              </button>
            </div>

            {/* Tab 1: Overview */}
            {activeTab === 'overview' && (
              <div className="tab-content">
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
              </div>
            )}

            {/* Tab 2: Blocks with Bento Grid & Spotlight */}
            {activeTab === 'blocks' && (
              <div className="tab-content">
                <div className="bento-grid">
                  {blocks.map((block, i) => (
                    <div key={i} className={`bento-item ${i === 0 ? 'span-2' : ''}`}>
                      <div className="spotlight-card">
                        <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 700, color: 'var(--navy)', fontFamily: "'Big Shoulders Display',sans-serif" }}>
                          {block.name || `Block ${i + 1}`}
                        </div>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', marginBottom: 16 }}>
                          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--cyan)', fontFamily: "'JetBrains Mono',monospace" }}>
                            {block.priceFrom.toLocaleString('no-NO')} kr
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>→</div>
                          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--cyan)', fontFamily: "'JetBrains Mono',monospace" }}>
                            {block.priceTo.toLocaleString('no-NO')} kr
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 12 }}>
                          <strong>Antakelser:</strong> {block.assumptions || '—'}
                        </div>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 11 }}>
                          <div style={{ padding: '3px 10px', borderRadius: 4, background: 'rgba(77,184,232,0.1)', color: 'var(--cyan)', fontWeight: 700 }}>
                            Sikkerhet: {block.confidence || '—'}%
                          </div>
                          {block.riskDescription && (
                            <div style={{ color: 'var(--warning)' }}>⚠ {block.riskDescription}</div>
                          )}
                        </div>
                        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 12 }}>
                          <input
                            type="number"
                            value={block.priceFrom}
                            onChange={e => handleBlockChange(i, { priceFrom: parseFloat(e.target.value) })}
                            style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', marginBottom: 8, fontSize: 12 }}
                          />
                          <label style={{ fontSize: 11, color: 'var(--text-dim)' }}>Min pris</label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 3: Summary Stats Card */}
            {activeTab === 'summary' && (
              <div className="tab-content">
                <div className="stats-card">
                  <div className="stats-content">
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cyan)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 24, fontFamily: "'Big Shoulders Display',sans-serif" }}>
                      Budsjettsamling
                    </div>

                    <div className="stats-row">
                      <div className="stat-item">
                        <div className="stat-label">Arbeidsblokker</div>
                        <div className="stat-value">{blocks.length}</div>
                      </div>
                      <div className="stat-item">
                        <div className="stat-label">Totalt før påslag</div>
                        <div className="stat-value">{totalLow.toLocaleString('no-NO')} kr</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>— {totalHigh.toLocaleString('no-NO')} kr</div>
                      </div>
                      <div className="stat-item">
                        <div className="stat-label">Stålkonstruksjon</div>
                        <div className="stat-value">{stal.toLocaleString('no-NO')} kr</div>
                      </div>
                    </div>

                    <div className="stats-divider" />

                    <div className="stats-row">
                      <div className="stat-item">
                        <div className="stat-label">Rigg og drift ({riggPct}%)</div>
                        <div className="stat-value">{riggLow.toLocaleString('no-NO')} kr</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>— {riggHigh.toLocaleString('no-NO')} kr</div>
                      </div>
                      <div className="stat-item">
                        <div className="stat-label">Budsjettspenn</div>
                        <div className="stat-value" style={{ fontSize: 28 }}>{grandLow.toLocaleString('no-NO')}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>til {grandHigh.toLocaleString('no-NO')} kr</div>
                      </div>
                      <div className="stat-item">
                        <div className="stat-label">Midtpunkt</div>
                        <div className="stat-value">{midTotal.toLocaleString('no-NO')} kr</div>
                      </div>
                    </div>

                    <div className="stats-divider" />

                    <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                      <button onClick={() => setShowTilbudModal(true)} className="btn-primary" style={{ flex: 1, padding: '14px 20px', fontSize: 14 }}>
                        📄 Last ned .docx budsjett
                      </button>
                      <button onClick={handleExportSummary} className="btn-primary" style={{ flex: 1, padding: '14px 20px', fontSize: 14, background: 'rgba(77,184,232,0.15)', color: 'var(--cyan)', border: '1px solid var(--cyan)' }}>
                        💾 Estimat .txt
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  )
}
