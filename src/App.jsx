import { Fragment, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FERRO_LOGO_B64 } from './ferroLogo'
import { useProject } from './hooks/useProject'
import { Card, Spinner } from './components/ui'
import UploadPanel from './components/UploadPanel'
import ResultsPanel from './components/ResultsPanel'
import TilbudModal from './components/modals/TilbudModal'
import FeedbackModal from './components/modals/FeedbackModal'
import HistorikkModal from './components/modals/HistorikkModal'
import AnimatedCounter from './components/AnimatedCounter'
import PriceRangeSlider from './components/PriceRangeSlider'
import BudgetIndicator from './components/BudgetIndicator'
import SkeletonLoader from './components/SkeletonLoader'
import PriceSensitivityHeatmap from './components/PriceSensitivityHeatmap'
import Confetti from './components/Confetti'
import EmptyState from './components/EmptyState'
import CostBlockCard from './components/CostBlockCard'
import { t, getLang, setLang } from './translations'

export default function App() {
  const [activeTab, setActiveTab] = useState('overview')
  const [celebrateMode, setCelebrateMode] = useState(false)
  const [blockAdjustments, setBlockAdjustments] = useState({})

  const {
    apiKey, showKey, setShowKey,
    projectName, setProjectName,
    files, setFiles, addFiles, setFileType,
    extraInfo, setExtraInfo,
    analyzing, status, error,
    result, blocks: originalBlocks,
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

  // Apply adjustments to blocks
  const blocks = originalBlocks?.map((block, i) => ({
    ...block,
    priceFrom: blockAdjustments[i]?.min ?? block.priceFrom,
    priceTo: blockAdjustments[i]?.max ?? block.priceTo,
  })) || []

  const handleBlockAdjust = (idx, newRange) => {
    setBlockAdjustments(prev => ({
      ...prev,
      [idx]: newRange
    }))
  }

  // Animation variants
  const blockVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.1,
        duration: 0.5,
        ease: 'easeOut',
      },
    }),
  }

  const tabVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.2 } },
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <Confetti trigger={celebrateMode} />

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
      <motion.div
        className="floating-dock"
        initial={{ y: -70 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
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
      </motion.div>

      <div className="main-content">
        {/* Hero */}
        <motion.div style={{ marginBottom: 36 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
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
        </motion.div>

        {/* API Key Display */}
        {showKey && (
          <motion.div style={{ margin: '20px 0', padding: 16, background: 'rgba(77,184,232,0.1)', borderRadius: 8, border: '1px solid rgba(77,184,232,0.2)', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, wordBreak: 'break-all' }} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            {apiKey || '—'}
          </motion.div>
        )}

        {/* Error Display */}
        {error && (
          <motion.div style={{ padding: '14px 18px', marginBottom: 20, borderRadius: 10, background: 'rgba(192,48,48,0.06)', border: '1px solid rgba(192,48,48,0.20)', color: 'var(--danger)', fontSize: 13 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            ⚠ {error}
          </motion.div>
        )}

        {/* Input Form */}
        {!result || analyzing ? (
          <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Show EmptyState if no files uploaded yet */}
            {files.length === 0 && !analyzing && (
              <EmptyState
                onAction={() => document.querySelector('input[type="file"]')?.click()}
                actionLabel="Last opp fil nå"
                icon="📄"
              />
            )}

            {/* Show UploadPanel for file input and analysis */}
            <UploadPanel
              files={files}
              setFiles={setFiles}
              addFiles={addFiles}
              projectName={projectName}
              setProjectName={setProjectName}
              extraInfo={extraInfo}
              setExtraInfo={setExtraInfo}
              onAnalyze={handleAnalyze}
              analyzing={analyzing}
              status={status}
            />
          </motion.div>
        ) : null}

        {/* Loading Skeleton */}
        {analyzing && <SkeletonLoader />}

        {/* Results with Tabs & Enhanced Features */}
        <AnimatePresence>
          {result && !analyzing && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
              {/* Tabs Header */}
              <motion.div className="tabs-header" style={{ marginTop: 40 }} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                {['overview', 'blocks', 'summary'].map((tab) => (
                  <button
                    key={tab}
                    className={`tab-button ${activeTab === tab ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      padding: '12px 20px',
                      borderBottom: activeTab === tab ? '2px solid var(--cyan)' : '1px solid var(--border)',
                      color: activeTab === tab ? 'var(--cyan)' : 'var(--text-dim)',
                      background: 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {tab === 'overview' && 'Oversikt'}
                    {tab === 'blocks' && 'Kostblokker'}
                    {tab === 'summary' && 'Oppsummering'}
                  </button>
                ))}
              </motion.div>

              {/* Tab Content */}
              <AnimatePresence mode="wait">
                {/* Tab 1: Overview */}
                {activeTab === 'overview' && (
                  <motion.div key="overview" variants={tabVariants} initial="initial" animate="animate" exit="exit">
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
                    <BudgetIndicator current={grandLow} target={result?.targetBudget} />
                  </motion.div>
                )}

                {/* Tab 2: Cost Blockers with Interactive Cards */}
                {activeTab === 'blocks' && (
                  <motion.div key="blocks" variants={tabVariants} initial="initial" animate="animate" exit="exit">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, marginTop: 20 }}>
                      {blocks.map((block, i) => (
                        <CostBlockCard
                          key={i}
                          block={block}
                          index={i}
                          onChange={(updatedBlock) => {
                            handleBlockAdjust(i, {
                              min: updatedBlock.priceFrom || updatedBlock.price_low,
                              max: updatedBlock.priceTo || updatedBlock.price_high,
                            })
                          }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Tab 3: Summary with Heat Map */}
                {activeTab === 'summary' && (
                  <motion.div key="summary" variants={tabVariants} initial="initial" animate="animate" exit="exit">
                    <div className="stats-card">
                      <div className="stats-content">
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cyan)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 24, fontFamily: "'Big Shoulders Display',sans-serif" }}>
                          Budsjettsamling
                        </div>

                        <div className="stats-row">
                          <div className="stat-item">
                            <div className="stat-label">Arbeidsblokker</div>
                            <div className="stat-value">
                              <AnimatedCounter to={blocks.length} duration={0.6} />
                            </div>
                          </div>
                          <div className="stat-item">
                            <div className="stat-label">Totalt før påslag</div>
                            <div className="stat-value">
                              <AnimatedCounter to={totalLow} duration={1.5} />
                            </div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>— <AnimatedCounter to={totalHigh} duration={1.5} /></div>
                          </div>
                          <div className="stat-item">
                            <div className="stat-label">Stålkonstruksjon</div>
                            <div className="stat-value">
                              <AnimatedCounter to={stal} duration={1.2} />
                            </div>
                          </div>
                        </div>

                        <div className="stats-divider" />

                        <div className="stats-row">
                          <div className="stat-item">
                            <div className="stat-label">Rigg og drift ({riggPct}%)</div>
                            <div className="stat-value">
                              <AnimatedCounter to={riggLow} duration={1.3} />
                            </div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>— <AnimatedCounter to={riggHigh} duration={1.3} /></div>
                          </div>
                          <div className="stat-item">
                            <div className="stat-label">Budsjettspenn</div>
                            <div className="stat-value" style={{ fontSize: 28 }}>
                              <AnimatedCounter to={grandLow} duration={1.5} />
                            </div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>til <AnimatedCounter to={grandHigh} duration={1.5} /> kr</div>
                          </div>
                          <div className="stat-item">
                            <div className="stat-label">Midtpunkt</div>
                            <div className="stat-value">
                              <AnimatedCounter to={midTotal} duration={1.5} />
                            </div>
                          </div>
                        </div>

                        <div className="stats-divider" />

                        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                          <button onClick={() => { setShowTilbudModal(true); setCelebrateMode(true); }} className="btn-primary" style={{ flex: 1, padding: '14px 20px', fontSize: 14 }}>
                            📄 Last ned .docx budsjett
                          </button>
                          <button onClick={handleExportSummary} className="btn-primary" style={{ flex: 1, padding: '14px 20px', fontSize: 14, background: 'rgba(77,184,232,0.15)', color: 'var(--cyan)', border: '1px solid var(--cyan)' }}>
                            💾 Estimat .txt
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Price Sensitivity Heat Map */}
                    <PriceSensitivityHeatmap blocks={blocks} totalBudget={grandHigh} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
