import { useState, useCallback, useEffect } from 'react'
import { analyzeProject } from '../analyzeProject'
import {
  saveProject, loadProject, clearProject,
  saveApiKey, loadApiKey,
  exportSummary,
  detectFileType,
  loadManualProjects,
} from '../utils'
import { t } from '../translations'

export function useProject() {
  const [apiKey, setApiKey]       = useState(loadApiKey)
  const [showKey, setShowKey]     = useState(false)
  const [projectName, setProjectName] = useState('')
  const [files, setFiles]         = useState([])
  const [extraInfo, setExtraInfo] = useState('')
  const [status, setStatus]       = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError]         = useState('')
  const [result, setResult]       = useState(null)
  const [blocks, setBlocks]       = useState([])
  const [stalPrice, setStalPrice] = useState('')
  const [riggPct, setRiggPct]     = useState(8)
  const [showTilbudModal, setShowTilbudModal]       = useState(false)
  const [showFeedbackModal, setShowFeedbackModal]   = useState(false)
  const [showHistorikkModal, setShowHistorikkModal] = useState(false)
  const [generatingBrev, setGeneratingBrev] = useState(false)
  const [brevStatus, setBrevStatus] = useState('')

  useEffect(() => {
    const saved = loadProject()
    if (saved) {
      setProjectName(saved.projectName || '')
      setResult(saved.result   || null)
      setBlocks(saved.blocks   || [])
      setStalPrice(saved.stalPrice || '')
      setRiggPct(saved.riggPct || 8)
      setExtraInfo(saved.extraInfo || '')
    }
  }, [])

  useEffect(() => {
    if (result) saveProject({ projectName, result, blocks, stalPrice, riggPct, extraInfo })
  }, [result, blocks, projectName, stalPrice, riggPct, extraInfo])

  const handleKeyChange = (k) => { setApiKey(k); saveApiKey(k) }

  const addFiles = useCallback((newFiles) => {
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.file.name + f.file.size))
      return [...prev, ...Array.from(newFiles)
        .filter(f => !existing.has(f.name + f.size))
        .map(f => ({ file: f, fileType: detectFileType(f.name) }))]
    })
  }, [])

  const setFileType = (idx, ft) => setFiles(prev => prev.map((f, i) => i === idx ? { ...f, fileType: ft } : f))

  const handleAnalyze = async () => {
    if (files.length === 0 && !extraInfo.trim()) { setError(t('errAddFiles')); return }
    setAnalyzing(true); setError(''); setResult(null); setBlocks([])
    try {
      const history = loadManualProjects()
      const res = await analyzeProject(files, extraInfo, apiKey, setStatus, history)
      setResult(res)
      const enrichedBlocks = (res.blocks || [])
        .filter(b => b.included)
        .map(b => {
          const pct = b.paslag_pct ?? 15
          return { ...b, paslag_pct: pct, base_low: Math.round((b.price_low || 0) / (1 + pct / 100)), base_high: Math.round((b.price_high || 0) / (1 + pct / 100)) }
        })
      setBlocks(enrichedBlocks)
      setRiggPct(res.recommended_rigg_pct || 8)
      if (enrichedBlocks.some(b => b.id === 'stål')) setStalPrice('')
    } catch (e) { setError(e.message) }
    finally { setAnalyzing(false); setStatus('') }
  }

  const handleBlockChange = (idx, upd) => setBlocks(prev => prev.map((b, i) => i === idx ? upd : b))

  const handleReset = () => {
    if (confirm(t('resetConfirm'))) {
      clearProject(); setFiles([]); setResult(null); setBlocks([])
      setProjectName(''); setExtraInfo(''); setStalPrice(''); setRiggPct(8); setError('')
    }
  }

  const handleGenerateBrev = async (kunde, signer, forutsetninger) => {
    setGeneratingBrev(true); setBrevStatus('Genererer .docx...')
    try {
      const { generateAndDownloadDocx } = await import('../generateDocx.js')
      await generateAndDownloadDocx({ projectName, result, blocks, stalPrice, riggPct, kunde, signer, forutsetninger })
      setShowTilbudModal(false)
    } catch (e) { setError(t('errDocx') + e.message) }
    finally { setGeneratingBrev(false); setBrevStatus('') }
  }

  const handleExportSummary = () => exportSummary(result, projectName, stalPrice, riggPct)

  // Computed totals
  const totalLow  = blocks.reduce((s, b) => s + (b.price_low  || 0), 0)
  const totalHigh = blocks.reduce((s, b) => s + (b.price_high || 0), 0)
  const stal      = parseInt(stalPrice) || 0
  const riggLow   = totalLow  * (riggPct / 100)
  const riggHigh  = totalHigh * (riggPct / 100)
  const grandLow  = totalLow  + riggLow  + stal
  const grandHigh = totalHigh + riggHigh + stal
  const midTotal  = Math.round((grandLow + grandHigh) / 2)

  return {
    apiKey, showKey, setShowKey,
    projectName, setProjectName,
    files, setFiles, addFiles, setFileType,
    extraInfo, setExtraInfo,
    status, analyzing, error,
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
  }
}
