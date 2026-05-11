/**
 * Leave-one-out cross-validation for calculator.js
 * For each project: remove it from history, predict stål+yttervegg+tak,
 * compare vs actual, report error %.
 *
 * Usage: node scripts/crossValidate.mjs [projectIndex]
 *   e.g. node scripts/crossValidate.mjs 8   (Dobbel Vaskehall Glitra)
 *        node scripts/crossValidate.mjs      (runs all projects)
 */

import { readFileSync } from 'fs'
import { pathToFileURL } from 'url'
import path from 'path'

const calcPath = path.resolve('./src/calculator.js')
const { calculatePrices, findSimilarProjects } = await import(pathToFileURL(calcPath))

const hist = JSON.parse(readFileSync('./src/historiske_prosjekter.json', 'utf8'))

// Build facts object from a history entry (simulates what AI would provide)
function factsFromEntry(entry) {
  const b = entry.bygg || {}
  const p = entry.priser_til_kunde || {}
  const typeStr = (entry.bygningstype || b.type || '').toLowerCase()

  const scope_items = []
  if (p.stal)      scope_items.push('stål')
  if (p.yttervegg) scope_items.push('yttervegg')
  if (p.tak)       scope_items.push('tak')
  if (p.kran_lift) scope_items.push('kran_lift')
  if (p.betong)    scope_items.push('betong')

  // Detect kaldtlager only from explicit type string — missing yttervegg price ≠ kaldtlager
  const kaldtlager = /kaldtlager|uisolert|strølager|sandlager|saltlager|plantørke/.test(typeStr)

  // Estimate takhøyde_kategori from gesimshøyde in dimensjoner string or bygg type
  const dimStr = (b.dimensjoner || '').toLowerCase()
  const hMatch = dimStr.match(/×\s*([\d.]+)\s*m\s*(?:gesims|høyde|h\b)/)
  const gesims = hMatch ? parseFloat(hMatch[1]) : null
  let takhøyde_kategori = 'mid'
  if (gesims) {
    if (gesims <= 5.0) takhøyde_kategori = 'lav'
    else if (gesims > 9.0) takhøyde_kategori = 'høy'
  } else if (typeStr.includes('vaskehall')) {
    takhøyde_kategori = 'lav'
  } else if (b.bra_m2 > 1200 || typeStr.includes('båtopplag') || typeStr.includes('båthall')) {
    takhøyde_kategori = 'høy'
  }

  return {
    bra_m2:                b.bra_m2     || null,
    yttervegg_m2:          b.fasade_m2  || null,
    tak_m2:                b.tak_m2     || null,
    bygg_type:             entry.bygningstype || b.type || '',
    kaldtlager,
    takhøyde_kategori,
    tak_konstruksjon_type: entry.tak_konstruksjon_type || null,
    taktekking_inkludert:  entry.taktekking_inkludert  ?? null,
    betong_inkludert:      entry.betong_inkludert       ?? null,
    scope_items,
    brannkrav:          { kostnadspaslag_pct: 0, kilde: 'ikke_oppgitt' },
    confidence:         'medium',
  }
}

// Run one leave-one-out test
function testProject(idx) {
  const target   = hist[idx]
  const trainSet = hist.filter((_, i) => i !== idx)
  const actual   = target.priser_til_kunde || {}
  const facts    = factsFromEntry(target)

  const result = calculatePrices(facts, trainSet)
  const blocks = result.blocks || []

  const rows = []
  let totalActual = 0, totalPredMid = 0

  for (const block of blocks) {
    // history uses 'stal' key, block id is 'stål'
    const actKey = block.id === 'stål' ? 'stal' : block.id
    const act = actual[actKey] || actual[block.id]
    if (!act) continue
    const predMid = Math.round((block.price_low + block.price_high) / 2)
    const err = Math.round(((predMid - act) / act) * 100)
    totalActual  += act
    totalPredMid += predMid
    rows.push({ block: block.id, actual: act, predLow: block.price_low, predHigh: block.price_high, predMid, err })
  }

  const similar = findSimilarProjects(facts, trainSet).slice(0, 3)

  return {
    navn: target.navn,
    bra: facts.bra_m2,
    type: (facts.bygg_type || '').slice(0, 50),
    rows,
    totalActual,
    totalPredMid,
    totalErr: totalActual ? Math.round(((totalPredMid - totalActual) / totalActual) * 100) : null,
    usedRefs: similar.map(s => s.navn),
  }
}

function fmt(n) { return n?.toLocaleString('nb-NO') ?? '—' }

function printResult(r) {
  console.log(`\n${'═'.repeat(72)}`)
  console.log(`PROSJEKT: ${r.navn}`)
  console.log(`BRA: ${r.bra} m² | Type: ${r.type}`)
  console.log(`Referanser brukt: ${r.usedRefs.join(', ') || '(ingen)'}`)
  console.log(`${'─'.repeat(72)}`)
  console.log(`${'Blokk'.padEnd(14)} ${'Faktisk'.padStart(12)} ${'Pred lav'.padStart(12)} ${'Pred høy'.padStart(12)} ${'Pred mid'.padStart(12)} ${'Feil%'.padStart(7)}`)
  for (const row of r.rows) {
    const errStr = (row.err >= 0 ? '+' : '') + row.err + '%'
    const flag = Math.abs(row.err) > 25 ? ' ⚠' : Math.abs(row.err) > 15 ? ' ~' : ' ✓'
    console.log(
      `${row.block.padEnd(14)} ${fmt(row.actual).padStart(12)} ${fmt(row.predLow).padStart(12)} ${fmt(row.predHigh).padStart(12)} ${fmt(row.predMid).padStart(12)} ${errStr.padStart(7)}${flag}`
    )
  }
  if (r.rows.length > 1) {
    console.log(`${'─'.repeat(72)}`)
    const totErrStr = (r.totalErr >= 0 ? '+' : '') + r.totalErr + '%'
    const totFlag = Math.abs(r.totalErr) > 25 ? ' ⚠' : Math.abs(r.totalErr) > 15 ? ' ~' : ' ✓'
    console.log(`${'TOTAL'.padEnd(14)} ${fmt(r.totalActual).padStart(12)} ${''.padStart(12)} ${''.padStart(12)} ${fmt(r.totalPredMid).padStart(12)} ${totErrStr.padStart(7)}${totFlag}`)
  }
}

const targetIdx = process.argv[2] !== undefined ? parseInt(process.argv[2]) : null

if (targetIdx !== null) {
  const r = testProject(targetIdx)
  printResult(r)
} else {
  const all = []
  for (let i = 0; i < hist.length; i++) {
    const r = testProject(i)
    all.push(r)
    printResult(r)
  }

  const withErr = all.filter(r => r.totalErr !== null)
  const absErrs = withErr.map(r => Math.abs(r.totalErr))
  const mae = Math.round(absErrs.reduce((s, e) => s + e, 0) / absErrs.length)
  const within15 = absErrs.filter(e => e <= 15).length
  const within25 = absErrs.filter(e => e <= 25).length

  console.log(`\n${'═'.repeat(72)}`)
  console.log(`SAMMENDRAG — Leave-one-out cross-validation (${withErr.length} prosjekter)`)
  console.log(`${'─'.repeat(72)}`)
  console.log(`MAE (gjennomsnittlig absolutt feil):  ±${mae}%`)
  console.log(`Innenfor ±15%:  ${within15}/${withErr.length} prosjekter`)
  console.log(`Innenfor ±25%:  ${within25}/${withErr.length} prosjekter`)
  console.log(`${'─'.repeat(72)}`)
  withErr
    .sort((a, b) => Math.abs(b.totalErr) - Math.abs(a.totalErr))
    .forEach(r => {
      const err = (r.totalErr >= 0 ? '+' : '') + r.totalErr + '%'
      const flag = Math.abs(r.totalErr) > 25 ? '⚠' : '✓'
      console.log(`  ${flag} ${r.navn.slice(0, 40).padEnd(40)} ${err.padStart(6)}`)
    })
}
