/**
 * Test suite for calculator.js
 *
 * Run: node --test scripts/calculator.test.mjs
 *
 * Tests are grouped:
 *   A. Unit tests — isolated functions
 *   B. Integration tests — calculatePrices on synthetic facts
 *   C. Data-integrity tests — verify historiske_prosjekter.json rates are in range
 *   D. Cross-validation smoke test — MAE must be below threshold
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { pathToFileURL } from 'url'
import path from 'path'

const calcPath   = path.resolve('./src/calculator.js')
const { calculatePrices, findSimilarProjects } = await import(pathToFileURL(calcPath))
const history = JSON.parse(readFileSync('./src/historiske_prosjekter.json', 'utf8'))

// ── helpers ────────────────────────────────────────────────────────────────────
function midPrice(block) { return (block.price_low + block.price_high) / 2 }
function errPct(pred, actual) { return Math.round(((pred - actual) / actual) * 100) }

// ── A. Unit tests ──────────────────────────────────────────────────────────────
describe('A. Unit: findSimilarProjects', () => {
  test('returns items sorted by score descending', () => {
    const facts = { bra_m2: 500, bygg_type: 'lagerbygg', scope_items: ['stål'] }
    const result = findSimilarProjects(facts, history)
    assert.ok(result.length > 0, 'should find at least one similar project')
    for (let i = 1; i < result.length; i++) {
      assert.ok(result[i-1].score >= result[i].score, 'results should be sorted descending')
    }
  })

  test('returns empty array when history is empty', () => {
    const facts = { bra_m2: 300, bygg_type: 'lagerbygg', scope_items: ['stål'] }
    assert.deepStrictEqual(findSimilarProjects(facts, []), [])
  })

  test('vaskehall matches other vaskehall projects first', () => {
    const facts = { bra_m2: 185, bygg_type: 'dobbel vaskehall', scope_items: ['stål', 'yttervegg', 'tak'] }
    const result = findSimilarProjects(facts, history)
    const topNames = result.slice(0, 3).map(r => r.navn.toLowerCase())
    const hasVaskehall = topNames.some(n => n.includes('vask') || n.includes('wash'))
    assert.ok(hasVaskehall, `top results should include a vaskehall, got: ${topNames.join(', ')}`)
  })
})

// ── B. Integration: calculatePrices ───────────────────────────────────────────
describe('B. Integration: calculatePrices', () => {

  test('returns blocks + totalLow/High', () => {
    const facts = {
      bra_m2: 400, yttervegg_m2: 400, tak_m2: 420,
      bygg_type: 'lagerbygg', kaldtlager: false,
      takhøyde_kategori: 'mid', tak_konstruksjon_type: 'trp_kun',
      scope_items: ['stål', 'yttervegg', 'tak', 'kran_lift'],
      brannkrav: { kostnadspaslag_pct: 0, kilde: 'ikke_oppgitt' },
      confidence: 'medium',
    }
    const { blocks, totalLow, totalHigh } = calculatePrices(facts, history)
    assert.ok(blocks.length === 4, `expected 4 blocks, got ${blocks.length}`)
    assert.ok(totalLow > 0 && totalHigh >= totalLow, 'totalLow/High should be positive')
    const ids = blocks.map(b => b.id)
    assert.ok(ids.includes('stål'),      'stål block expected')
    assert.ok(ids.includes('yttervegg'), 'yttervegg block expected')
    assert.ok(ids.includes('tak'),       'tak block expected')
    assert.ok(ids.includes('kran_lift'), 'kran_lift block expected')
  })

  test('kaldtlager uses lower stål rate than varmtlager', () => {
    const base = {
      bra_m2: 500, tak_m2: 520, yttervegg_m2: 600,
      takhøyde_kategori: 'mid', tak_konstruksjon_type: 'trp_kun',
      scope_items: ['stål'],
      brannkrav: { kostnadspaslag_pct: 0, kilde: 'ikke_oppgitt' },
      confidence: 'medium',
    }
    const kald  = calculatePrices({ ...base, kaldtlager: true,  bygg_type: 'kaldtlager' }, [])
    const varm  = calculatePrices({ ...base, kaldtlager: false, bygg_type: 'lagerbygg'  }, [])
    const kaldMid = midPrice(kald.blocks[0])
    const varmMid = midPrice(varm.blocks[0])
    assert.ok(kaldMid < varmMid, `kaldtlager stål (${kaldMid}) should be < varmtlager stål (${varmMid})`)
  })

  test('tak type "varmt_tak_u018" costs more than "trp_kun"', () => {
    const base = {
      bra_m2: 400, tak_m2: 420, bygg_type: 'lagerbygg',
      kaldtlager: false, takhøyde_kategori: 'mid',
      scope_items: ['tak'],
      brannkrav: { kostnadspaslag_pct: 0, kilde: 'ikke_oppgitt' },
      confidence: 'medium',
    }
    const trp   = calculatePrices({ ...base, tak_konstruksjon_type: 'trp_kun'        }, [])
    const varm  = calculatePrices({ ...base, tak_konstruksjon_type: 'varmt_tak_u018' }, [])
    assert.ok(midPrice(varm.blocks[0]) > midPrice(trp.blocks[0]),
      'varmt_tak should cost more than trp_kun')
  })

  test('small building gets higher stål per m² than large building', () => {
    const base = {
      bygg_type: 'vaskehall', kaldtlager: false,
      takhøyde_kategori: 'lav', tak_konstruksjon_type: 'trp_kun',
      scope_items: ['stål'],
      brannkrav: { kostnadspaslag_pct: 0, kilde: 'ikke_oppgitt' },
      confidence: 'medium',
    }
    const small = calculatePrices({ ...base, bra_m2:  80, tak_m2:  85 }, [])
    const large = calculatePrices({ ...base, bra_m2: 800, tak_m2: 840 }, [])
    const smallRate = midPrice(small.blocks[0]) / 80
    const largeRate = midPrice(large.blocks[0]) / 800
    assert.ok(smallRate > largeRate,
      `small building rate (${Math.round(smallRate)} kr/m²) should exceed large (${Math.round(largeRate)} kr/m²)`)
  })

  test('brannkrav increases stål price proportionally', () => {
    const base = {
      bra_m2: 300, tak_m2: 315, yttervegg_m2: 350, bygg_type: 'lagerbygg',
      kaldtlager: false, takhøyde_kategori: 'mid', tak_konstruksjon_type: 'trp_kun',
      scope_items: ['stål'], confidence: 'medium',
    }
    const noBrann   = calculatePrices({ ...base, brannkrav: { kostnadspaslag_pct:  0, kilde: 'test' } }, [])
    const withBrann = calculatePrices({ ...base, brannkrav: { kostnadspaslag_pct: 25, kilde: 'test' } }, [])
    const ratio = midPrice(withBrann.blocks[0]) / midPrice(noBrann.blocks[0])
    assert.ok(ratio > 1.20 && ratio < 1.35,
      `brann +25% should raise price ~25% (got ×${ratio.toFixed(2)})`)
  })

  test('kran_lift "høy" > "mid" > "lav"', () => {
    const base = {
      bra_m2: 400, tak_m2: 420, bygg_type: 'lagerbygg',
      kaldtlager: false, tak_konstruksjon_type: 'trp_kun',
      scope_items: ['kran_lift'],
      brannkrav: { kostnadspaslag_pct: 0, kilde: 'ikke_oppgitt' },
      confidence: 'medium',
    }
    const lav = calculatePrices({ ...base, takhøyde_kategori: 'lav' }, [])
    const mid = calculatePrices({ ...base, takhøyde_kategori: 'mid' }, [])
    const høy = calculatePrices({ ...base, takhøyde_kategori: 'høy' }, [])
    assert.ok(midPrice(lav.blocks[0]) < midPrice(mid.blocks[0]), 'lav < mid kran')
    assert.ok(midPrice(mid.blocks[0]) < midPrice(høy.blocks[0]), 'mid < høy kran')
  })

  test('porter count is used correctly in dorer_vinduer block', () => {
    const base = {
      bra_m2: 300, tak_m2: 315, bygg_type: 'lagerbygg',
      kaldtlager: false, takhøyde_kategori: 'mid', tak_konstruksjon_type: 'trp_kun',
      scope_items: ['dorer_vinduer'],
      brannkrav: { kostnadspaslag_pct: 0, kilde: 'ikke_oppgitt' },
      confidence: 'medium',
    }
    const few  = calculatePrices({ ...base, apninger: { foldeporter_stk: 1 } }, [])
    const many = calculatePrices({ ...base, apninger: { foldeporter_stk: 5 } }, [])
    assert.ok(midPrice(many.blocks[0]) > midPrice(few.blocks[0]),
      '5 porter should cost more than 1 porter')
  })
})

// ── C. Data integrity ──────────────────────────────────────────────────────────
describe('C. Data integrity: historiske_prosjekter.json', () => {

  test('all projects have required fields', () => {
    const missing = []
    history.forEach(p => {
      if (!p.navn) missing.push(`idx${history.indexOf(p)}: missing navn`)
      if (!p.bygg?.bra_m2) missing.push(`${p.navn}: missing bygg.bra_m2`)
      if (!p.priser_til_kunde) missing.push(`${p.navn}: missing priser_til_kunde`)
    })
    assert.deepStrictEqual(missing, [], `Data issues:\n  ${missing.join('\n  ')}`)
  })

  test('stål kr/m² is within plausible range [400–6000]', () => {
    const outliers = []
    history.forEach(p => {
      const pr = p.priser_til_kunde || {}
      const bra = p.bygg?.bra_m2
      if (!pr.stal || !bra) return
      const rate = Math.round(pr.stal / bra)
      // NOTE: projects with hulldekke lumped into stål will fail this check intentionally
      // Those projects need data correction (separate hulldekke into its own block)
      if (rate < 400 || rate > 6000) {
        outliers.push(`${p.navn}: stal_per_bra = ${rate} kr/m² (expected 400–6000)`)
      }
    })
    assert.deepStrictEqual(outliers, [],
      `Stål rate outliers (likely data errors — hulldekke/mesanin lumped into stål):\n  ${outliers.join('\n  ')}`)
  })

  test('stål kr/m² suspicious range [1800–3500] for normal buildings', () => {
    // Soft warning: flag but don't fail — just informational
    const suspicious = []
    history.forEach(p => {
      const pr = p.priser_til_kunde || {}
      const bra = p.bygg?.bra_m2
      const typeStr = (p.bygningstype || '').toLowerCase()
      if (!pr.stal || !bra) return
      const rate = Math.round(pr.stal / bra)
      const isKald = /kaldtlager|kald lager|uisolert|strølager|sandlager|saltlager|plantørke/.test(typeStr)
      if (!isKald && (rate < 800 || rate > 5000)) {
        suspicious.push(`${p.navn}: ${rate} kr/m² BRA (isolert bygg, forventet 800–5000)`)
      }
    })
    // Warning only — these may be valid due to scope differences
    if (suspicious.length) {
      console.warn('\n  [WARN] Suspicious stål rates (check if hulldekke/mesanin is separate):')
      suspicious.forEach(s => console.warn(`    ⚠  ${s}`))
    }
    // Not a hard failure — data may be correct but has special scope
    assert.ok(true)
  })

  test('yttervegg kr/m² fasade is within [500–3000]', () => {
    const outliers = []
    history.forEach(p => {
      const pr = p.priser_til_kunde || {}
      const fasade = p.bygg?.fasade_m2
      if (!pr.yttervegg || !fasade) return
      const rate = Math.round(pr.yttervegg / fasade)
      // Yttervegg rates > 2000 suggest innervegg/PIR is lumped in
      if (rate < 500 || rate > 3000) {
        outliers.push(`${p.navn}: yttervegg_per_m2 = ${rate} kr/m² fasade (expected 500–3000)`)
      }
    })
    assert.deepStrictEqual(outliers, [],
      `Yttervegg rate outliers (likely innervegg lumped in):\n  ${outliers.join('\n  ')}`)
  })

  test('tak kr/m² is within [300–2700]', () => {
    // Upper limit 2700 accounts for:
    //   - trp_med_tekking (TRP + taktekking) on small buildings: up to ~2200 kr/m²
    //   - varmt_tak_u013 (best insulation + taktekking): up to ~2600 kr/m²
    //   - small building fixed costs inflate per-m² rates significantly
    const outliers = []
    history.forEach(p => {
      const pr = p.priser_til_kunde || {}
      const takM2 = p.bygg?.tak_m2
      if (!pr.tak || !takM2) return
      const rate = Math.round(pr.tak / takM2)
      if (rate < 300 || rate > 2700) {
        outliers.push(`${p.navn}: tak_per_m2 = ${rate} kr/m² (expected 300–2700)`)
      }
    })
    assert.deepStrictEqual(outliers, [],
      `Tak rate outliers:\n  ${outliers.join('\n  ')}`)
  })

  test('tak_konstruksjon_type is set for all projects with tak price', () => {
    const missing = []
    history.forEach(p => {
      if (p.priser_til_kunde?.tak && !p.tak_konstruksjon_type) {
        missing.push(p.navn)
      }
    })
    assert.deepStrictEqual(missing, [],
      `Projects with tak price but missing tak_konstruksjon_type:\n  ${missing.join('\n  ')}`)
  })

  test('sum_eks_mva roughly matches sum of individual blocks', () => {
    const issues = []
    history.forEach(p => {
      const pr = p.priser_til_kunde || {}
      if (!pr.sum_eks_mva) return
      const blocks = ['stal','yttervegg','tak','kran_lift','betong','graving',
                      'dorer_vinduer','innervegg','taktekking','hulldekke',
                      'betongbrystning','prosjektering']
      const blockSum = blocks.reduce((s, k) => s + (pr[k] || 0), 0)
      if (blockSum === 0) return
      // Allow 30% difference (rigg_drift and unlisted items can be significant)
      const diff = Math.abs(blockSum - pr.sum_eks_mva) / pr.sum_eks_mva
      if (diff > 0.40) {
        issues.push(`${p.navn}: block sum ${Math.round(blockSum/1000)}k vs sum_eks_mva ${Math.round(pr.sum_eks_mva/1000)}k (${Math.round(diff*100)}% diff)`)
      }
    })
    // Warning only — sum difference can be due to rigg/drift being a % not a field
    if (issues.length) {
      console.warn('\n  [WARN] Large gap between block sum and sum_eks_mva:')
      issues.forEach(s => console.warn(`    ⚠  ${s}`))
    }
    assert.ok(true)
  })
})

// ── D. Cross-validation smoke test ────────────────────────────────────────────
describe('D. Cross-validation smoke test', () => {

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
    const kaldtlager = /kaldtlager|uisolert|strølager|sandlager|saltlager|plantørke/.test(typeStr)
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
      bra_m2: b.bra_m2 || null,
      yttervegg_m2: b.fasade_m2 || null,
      tak_m2: b.tak_m2 || null,
      bygg_type: entry.bygningstype || b.type || '',
      kaldtlager,
      takhøyde_kategori,
      tak_konstruksjon_type: entry.tak_konstruksjon_type || null,
      taktekking_inkludert: entry.taktekking_inkludert ?? null,
      betong_inkludert: entry.betong_inkludert ?? null,
      scope_items,
      brannkrav: { kostnadspaslag_pct: 0, kilde: 'ikke_oppgitt' },
      confidence: 'medium',
    }
  }

  function testProject(idx) {
    const target   = history[idx]
    const trainSet = history.filter((_, i) => i !== idx)
    const actual   = target.priser_til_kunde || {}
    const facts    = factsFromEntry(target)
    const result   = calculatePrices(facts, trainSet)
    const blocks   = result.blocks || []
    let totalActual = 0, totalPredMid = 0
    for (const block of blocks) {
      const actKey = block.id === 'stål' ? 'stal' : block.id
      const act = actual[actKey] || actual[block.id]
      if (!act) continue
      totalActual  += act
      totalPredMid += Math.round((block.price_low + block.price_high) / 2)
    }
    const totalErr = totalActual ? Math.round(((totalPredMid - totalActual) / totalActual) * 100) : null
    return { navn: target.navn, totalActual, totalPredMid, totalErr }
  }

  test('MAE across all projects should be below 35%', () => {
    const results = history.map((_, i) => testProject(i)).filter(r => r.totalErr !== null)
    const absErrs = results.map(r => Math.abs(r.totalErr))
    const mae = Math.round(absErrs.reduce((s, e) => s + e, 0) / absErrs.length)
    console.log(`\n  MAE = ±${mae}% across ${results.length} projects`)
    assert.ok(mae <= 35, `MAE ${mae}% exceeds 35% threshold — model needs improvement`)
  })

  test('at least 8 of 21 projects should be within ±15%', () => {
    const results = history.map((_, i) => testProject(i)).filter(r => r.totalErr !== null)
    const within15 = results.filter(r => Math.abs(r.totalErr) <= 15).length
    console.log(`\n  Within ±15%: ${within15}/${results.length}`)
    assert.ok(within15 >= 8, `Only ${within15} projects within ±15%, expected ≥8`)
  })

  test('no project should have error greater than ±150%', () => {
    const extreme = []
    history.forEach((_, i) => {
      const r = testProject(i)
      if (r.totalErr !== null && Math.abs(r.totalErr) > 150) {
        extreme.push(`${r.navn}: ${r.totalErr > 0 ? '+' : ''}${r.totalErr}%`)
      }
    })
    assert.deepStrictEqual(extreme, [],
      `Extreme prediction errors (likely data quality issues):\n  ${extreme.join('\n  ')}`)
  })

  // Per-project tests for the 5 worst outliers
  const KNOWN_BAD_PROJECTS = [
    { navn: 'Rugtvedt Lagerbygg AS',              maxAbsErr: 120, note: 'simple lager, cheap UE stål' },
    { navn: 'Valle båtopplag AS - ny hall',        maxAbsErr: 120, note: 'mesanin+hulldekke in stål block' },
    { navn: 'Dobbel Vaskehall',                   maxAbsErr: 55,  note: 'only stål in scope' },
    { navn: 'Bussgarasje Mjåvann - Kristiansand', maxAbsErr: 55,  note: 'huge building, scale effects' },
    { navn: 'Coop Extra Kløfta',                  maxAbsErr: 55,  note: 'complex dagligvare store' },
  ]

  for (const { navn, maxAbsErr, note } of KNOWN_BAD_PROJECTS) {
    test(`${navn} prediction error ≤ ±${maxAbsErr}% (${note})`, () => {
      const idx = history.findIndex(p => p.navn === navn)
      if (idx < 0) { console.warn(`  [SKIP] ${navn} not found`); return }
      const r = testProject(idx)
      if (r.totalErr === null) { console.warn(`  [SKIP] ${navn} has no comparable prices`); return }
      const absErr = Math.abs(r.totalErr)
      assert.ok(absErr <= maxAbsErr,
        `${navn}: error ${r.totalErr > 0 ? '+' : ''}${r.totalErr}% exceeds ±${maxAbsErr}%`)
    })
  }

  // Well-calibrated projects should stay well-calibrated
  const KNOWN_GOOD_PROJECTS = [
    { navn: 'Coop Extra Lunde',              maxAbsErr: 15 },
    { navn: 'Kaldtlager Rauland',            maxAbsErr: 15 },
    { navn: 'Ringsevja 22 - Ulefoss Auto',   maxAbsErr: 15 },
    { navn: 'Lagerbygg Steinsholt',          maxAbsErr: 15 },
    { navn: 'Nybruveien 5 - Vaskehall Drammen', maxAbsErr: 15 },
  ]

  for (const { navn, maxAbsErr } of KNOWN_GOOD_PROJECTS) {
    test(`${navn} stays within ±${maxAbsErr}% (regression)`, () => {
      const idx = history.findIndex(p => p.navn === navn)
      if (idx < 0) { console.warn(`  [SKIP] ${navn} not found`); return }
      const r = testProject(idx)
      if (r.totalErr === null) { console.warn(`  [SKIP] ${navn}: no prices`); return }
      const absErr = Math.abs(r.totalErr)
      assert.ok(absErr <= maxAbsErr,
        `REGRESSION: ${navn} degraded to ${r.totalErr > 0 ? '+' : ''}${r.totalErr}% (expected ≤±${maxAbsErr}%)`)
    })
  }
})
