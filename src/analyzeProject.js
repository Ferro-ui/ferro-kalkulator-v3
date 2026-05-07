// Routes project files to the Ferro backend for analysis.
// When VITE_BACKEND_URL is not set, calls Claude directly from the browser
// and runs the deterministic price calculator client-side.

import Anthropic from '@anthropic-ai/sdk'
import * as XLSX from 'xlsx'
import { calculatePrices } from './calculator.js'

const BASE_URL = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '')

const EXTRACTION_PROMPT = `Du er en erfaren kalkulator hos Ferro Stålentreprenør AS. Du leser tekniske byggetegninger og prosjektdokumenter.

OPPGAVE: Les ALLE vedlagte dokumenter og tegninger grundig. Ekstraher og BEREGN fakta — ingen prisestimat.

SLIK LESER DU STÅLBYGG-TEGNINGER:
- Mål i tegninger er ofte i MM — del på 1000 for meter
- Akseavstand (cc-avstand) × antall spenn = total lengde/bredde
- Eksempel: 6 spenn × 5000mm = 30m bygglengde
- Gesimshøyde = vegghoide for yttervegg-beregning
- yttervegg_m2 = 2 × (lengde + bredde) × gesimshøyde
- tak_m2 = grunnflate × 1.08 for flakt tak, × 1.15 for sadeltak
- Stykkliste/materialspesifikasjon inneholder ofte sandwich-type og isolasjonstykkelse
- Tittelblokk viser prosjektnavn og sted

Returner BARE gyldig JSON, ingen tekst rundt:
{
  "bygg_type": "lager|vaskehall|verksted|butikk|klubbhus|garasje|annet",
  "dimensjoner": "f.eks. 29×12×5.3m, eller null",
  "bra_m2": 348,
  "tak_m2": 376,
  "yttervegg_m2": 420,
  "innervegg_m2": null,
  "materialer": {
    "sandwich_type": "PIR 120mm|Steinull 150mm|Steinull 200mm|null",
    "tak_type": "PIR|TRP|Trapesblokk|null",
    "isolasjon_mm": null
  },
  "apninger": {
    "foldeporter_stk": null,
    "seksjonalporter_stk": null,
    "ruteporter_stk": null,
    "persondorer_stk": null,
    "vinduer_stk": null
  },
  "scope_items": ["stål","yttervegg","tak","kran_lift"],
  "lokasjon": "by/sted eller null",
  "confidence": "high|medium|low",
  "missing": ["kun felt som genuint IKKE kunne leses eller beregnes"]
}

Regler:
- BEREGN yttervegg_m2 og tak_m2 fra tegningens mål — returner IKKE null hvis dimensjoner er synlige
- Mål i mm i tegning: del på 1000. Mål i m: bruk direkte.
- Antall spenn × akseavstand = total bygglengde/-bredde
- bra_m2 = lengde × bredde (grunnflate)
- Null bare for felt som genuint ikke finnes noe sted i dokumentene
- confidence=high hvis dimensjoner er klart lesbare fra tegning
- Aldri gjet priser — returner INGEN prisfelt
- scope_items gyldige verdier: stål, yttervegg, innervegg, tak, dorer_vinduer, kran_lift, betong, graving
- scope_items: bare blokker Ferro faktisk skal levere (stål er typisk Ferro-leveranse)`

// ─── Main export ──────────────────────────────────────────────────────────────
export async function analyzeProject(wrappedFiles, extraInfo, apiKey, onStatus) {
  if (BASE_URL) {
    return analyzeViaBackend(wrappedFiles, extraInfo, onStatus)
  }
  if (!apiKey) {
    throw new Error('Legg inn Anthropic API-nøkkel (🔑-knappen) for å bruke AI-analyse.')
  }
  return analyzeViaBrowser(wrappedFiles, extraInfo, apiKey, onStatus)
}

// ─── Backend path ─────────────────────────────────────────────────────────────
async function analyzeViaBackend(wrappedFiles, extraInfo, onStatus) {
  onStatus('Forbereder filer...')
  const normalized = wrappedFiles.map(f => f.file ? f : { file: f, fileType: 'other' })
  const totalMB = normalized.reduce((s, w) => s + w.file.size, 0) / 1024 / 1024
  onStatus(`Sender ${normalized.length} fil(er) (${totalMB.toFixed(1)} MB) til server...`)

  const form = new FormData()
  for (const { file } of normalized) form.append('files', file, file.name)
  if (extraInfo) form.append('extraInfo', extraInfo)

  let res
  try {
    res = await fetch(`${BASE_URL}/api/analyze`, { method: 'POST', body: form })
  } catch (e) {
    throw new Error(`Kan ikke nå Ferro-serveren (${BASE_URL}). Er backend oppe? ${e.message}`)
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Serverfeil: ${res.status}`)
  }

  onStatus('Analyserer med AI + kalkulerer priser...')
  const result = await res.json()
  if (!result.blocks || !Array.isArray(result.blocks)) {
    throw new Error('Serveren returnerte ugyldig respons. Prøv igjen.')
  }
  if (!result.total_low || !result.total_high) {
    const inc = result.blocks.filter(b => b.included)
    result.total_low  = inc.reduce((s, b) => s + (b.price_low  || 0), 0)
    result.total_high = inc.reduce((s, b) => s + (b.price_high || 0), 0)
  }
  onStatus('Ferdig!')
  return result
}

// ─── Browser-direct path ──────────────────────────────────────────────────────
async function analyzeViaBrowser(wrappedFiles, extraInfo, apiKey, onStatus) {
  const client     = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  const normalized = wrappedFiles.map(f => f.file ? f : { file: f, fileType: 'other' })

  onStatus('Forbereder filer...')
  const content = []
  if (extraInfo?.trim()) {
    content.push({ type: 'text', text: `TILLEGGSINFORMASJON FRA BRUKER:\n${extraInfo}` })
  }
  for (let i = 0; i < normalized.length; i++) {
    const { file } = normalized[i]
    onStatus(`Leser ${i + 1}/${normalized.length}: ${file.name}`)
    const block = await fileToBlock(file)
    if (block) content.push(block)
  }
  content.push({ type: 'text', text: EXTRACTION_PROMPT })

  onStatus('Sender til Claude AI...')
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content }],
  })

  const text  = response.content[0].text.trim()
  const start = text.indexOf('{')
  const end   = text.lastIndexOf('}')
  if (start === -1) throw new Error('Claude klarte ikke å tolke dokumentene. Prøv å legge til tilleggsinformasjon.')
  const facts = JSON.parse(text.slice(start, end + 1))

  onStatus('Kalkulerer priser...')
  const { blocks, totalLow, totalHigh } = calculatePrices(facts)

  if (!blocks.length) {
    throw new Error('Fant ingen arbeidsblokker å estimere. Legg til mer info om hva Ferro skal levere.')
  }

  const typeMap = { lager: 'Lagerbygg', vaskehall: 'Vaskehall', verksted: 'Verksted',
    butikk: 'Butikk/forretning', klubbhus: 'Klubbhus', garasje: 'Garasje' }

  onStatus('Ferdig!')
  return {
    project_summary: `${typeMap[facts.bygg_type] || facts.bygg_type || 'Bygg'}${facts.bra_m2 ? ', ' + facts.bra_m2 + 'm²' : ''}${facts.lokasjon ? ', ' + facts.lokasjon : ''}.`,
    building: {
      type: facts.bygg_type || 'ukjent',
      size_m2: facts.bra_m2,
      dimensions: facts.dimensjoner,
      location: facts.lokasjon,
    },
    blocks,
    total_low:  totalLow,
    total_high: totalHigh,
    exclusions: [],
    warnings: facts.missing?.length ? [`Manglende data: ${facts.missing.join(', ')}`] : [],
    recommended_rigg_pct: 8,
    forutsetninger: {
      u_verdi_tak: 0.18, u_verdi_vegg: 0.18, u_verdi_glass: 1.2,
      tiltaksklasse: '2', bruddgrense_kn_m2: 250, gyldighet_dager: 14,
    },
  }
}

// ─── History extraction (admin feature — calls Claude directly) ───────────────
const HISTORY_EXTRACT_PROMPT = `Du er en erfaren kalkulatør hos Ferro Stålentreprenør AS.
Du mottar dokumenter fra et FULLFØRT Ferro-prosjekt. Trekk ut faktiske data.

Returner KUN gyldig JSON (ingen tekst rundt):
{
  "navn": "Prosjektnavn",
  "bygg": {
    "type": "kort beskrivelse av bygget",
    "dimensjoner": "f.eks. 29×12×5m",
    "bra_m2": 345,
    "fasade_m2": null,
    "tak_m2": null,
    "lokasjon": "by/sted"
  },
  "priser_til_kunde": {
    "stal": null, "yttervegg": null, "innervegg": null, "tak": null,
    "kran_lift": null, "dorer_vinduer": null, "betong": null, "graving": null,
    "rigg_drift_pct": 8, "sum_eks_mva": null
  },
  "innkjop_fra_leverandorer": {
    "stal_leverandor": null, "stal_innkjop_kr": null,
    "sandwich_leverandor": null, "sandwich_innkjop_kr": null, "sandwich_type": null,
    "tak_leverandor": null, "tak_innkjop_kr": null, "andre_ue": null
  },
  "paaslag_beregnet": {
    "stal_paslag": null, "sandwich_paslag": null, "kommentar": null
  },
  "scope": "kommaseparert liste over hva Ferro leverte",
  "tekniske_losninger": "kort teknisk beskrivelse",
  "merknader": "viktige notater"
}`

export async function extractProjectHistory(wrappedFiles, apiKey, onStatus) {
  if (!apiKey) throw new Error('API-nøkkel mangler. Klikk 🔑 og lim inn nøkkelen.')

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  onStatus('Forbereder filer...')
  const content = [{ type: 'text', text: `Jeg laster opp ${wrappedFiles.length} dokument(er) fra et fullført Ferro-prosjekt.` }]

  const normalized = wrappedFiles.map(f => f.file ? f : { file: f, fileType: 'other' })
  for (let i = 0; i < normalized.length; i++) {
    const { file } = normalized[i]
    onStatus(`Leser ${i + 1}/${normalized.length}: ${file.name}`)
    const block = await fileToBlock(file)
    if (block) content.push(block)
  }

  onStatus('Sender til Claude AI...')
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: HISTORY_EXTRACT_PROMPT,
    messages: [{ role: 'user', content }],
  })

  const text  = response.content[0].text.trim()
  const start = text.indexOf('{')
  const end   = text.lastIndexOf('}')
  if (start === -1) throw new Error('AI klarte ikke å tolke dokumentene. Fyll inn feltene manuelt.')
  return JSON.parse(text.slice(start, end + 1))
}

// ─── File helpers ─────────────────────────────────────────────────────────────
async function fileToBlock(file) {
  const mime  = file.type || ''
  const lower = file.name.toLowerCase()

  if (mime === 'application/pdf' || lower.endsWith('.pdf')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const bytes = new Uint8Array(reader.result)
        let binary = ''
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
        resolve({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: btoa(binary) },
        })
      }
      reader.onerror = () => reject(new Error(`Kunne ikke lese ${file.name}`))
      reader.readAsArrayBuffer(file)
    })
  }

  if (mime.startsWith('image/')) {
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve({
        type: 'image',
        source: { type: 'base64', media_type: mime, data: reader.result.split(',')[1] },
      })
      reader.readAsDataURL(file)
    })
  }

  if (mime.includes('spreadsheet') || mime.includes('excel') ||
      lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    return xlsxToBlock(file)
  }

  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = () => resolve({ type: 'text', text: `[${file.name}]\n${reader.result.slice(0, 8000)}` })
    reader.readAsText(file)
  })
}

function xlsxToBlock(file) {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const wb   = XLSX.read(new Uint8Array(reader.result), { type: 'array' })
        const prio = ['Tilbud', 'Resultat', 'Prisoppsett']
        const sorted = [
          ...prio.filter(n => wb.SheetNames.includes(n)),
          ...wb.SheetNames.filter(n => !prio.includes(n)),
        ]
        const lines = [`[Excel: ${file.name}]`]
        for (const name of sorted) {
          const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name], { blankrows: false })
          if (!csv.trim()) continue
          lines.push(`\n--- Ark: ${name} ---\n${csv.slice(0, 4000)}`)
        }
        resolve({ type: 'text', text: lines.join('\n') })
      } catch (e) {
        resolve({ type: 'text', text: `[Excel: ${file.name} — feil: ${e.message}]` })
      }
    }
    reader.readAsArrayBuffer(file)
  })
}
