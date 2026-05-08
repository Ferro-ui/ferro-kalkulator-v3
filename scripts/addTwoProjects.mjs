/**
 * Adds Nybruveien 5 (Vaskehall Drammen) and Bussgarasje Mjåvann
 * to historiske_prosjekter.json using data extracted from xlsx files.
 * Run: node scripts/addTwoProjects.mjs
 */

import { readFileSync, writeFileSync } from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const xlsx = require('xlsx')

// ── Helper: sum rows by matching name fragments ───────────────────────────────
function readPrisoppsett(path) {
  const wb = xlsx.readFile(path)
  const ws = wb.Sheets['Tilbud']
  return xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' })
}

function sumRows(rows, fromIdx, toIdx) {
  let sum = 0
  for (let i = fromIdx; i <= toIdx; i++) {
    const v = parseFloat(rows[i]?.[3])
    if (!isNaN(v)) sum += v
  }
  return Math.round(sum)
}

// ── NYBRUVEIEN 5 (Vaskehall, Drammen) ─────────────────────────────────────────
// Data from: 23.09.2025 Nybruveien 5 - Vaskehall.xlsx → Tilbud sheet
const nyb = {
  navn: 'Nybruveien 5 - Vaskehall Drammen',
  driveId: 'local-nybruveien-5-drammen',
  sist_oppdatert: new Date('2025-09-23').toISOString(),
  bygningstype: 'vaskehall',
  bygg: {
    type: 'Enkel vaskehall (bilvask), stålkonstruksjon med sandwich PIR 100mm vegger, TRP-tak + taktekking, spilekledning yttervegg. 1-etasje.',
    dimensjoner: 'Takareal 140 m², yttervegg 152 m², innervegg 96 m². Estimert ca. 12×12m grunnflate.',
    bra_m2: 140,
    fasade_m2: 152,
    tak_m2: 140,
    lokasjon: 'Drammen (Nybruveien 5, Krokstadelva)',
  },
  priser_til_kunde: {
    // All salgspris from Tilbud sheet
    stal:         350_000,                           // row 20
    tak:          93_035 + 154_000,                  // TRP (row 33 subtot) + taktekking UE
    yttervegg:    247_756 + 154_247,                 // sandwich (row 50 subtot) + spilekledning UE row 90
    innervegg:    132_963,                           // rows 44-48 sum
    kran_lift:    103_125,                           // rows 52-57 subtot (transport liten=0)
    dorer_vinduer: 86_250 + 120_000 + 460_000,       // dører + vinduer + porter UE
    betong:       425_500,                           // betong UE row 69
    oljeutskiller_rorlegger: 253_000 + 423_500,      // spesielt for vaskehall
    rigg_drift_pct: 5.3,
    sum_eks_mva:  3_195_000,
  },
  innkjop_fra_leverandorer: {
    stal_leverandor:       'Ståleriet (T202599)',
    stal_innkjop_kr:       250_000,
    sandwich_leverandor:   'Krokstadelva (tilbud 25.460)',
    sandwich_innkjop_kr:   215_440,   // yttervegg sandwich innkjøp
    sandwich_type:         'PIR 100mm (SP2B)',
    tak_leverandor:        'TRP galvanisert (egen)',
    tak_innkjop_kr:        80_900,    // TRP plater + montering innkjøp
    andre_ue:              'Taktekking 140k, Porter 400k, Betong 370k, Oljeutskiller 230k, Rørlegger 385k',
    innervegg_innkjop_kr:  115_620,
    kran_lift_innkjop_kr:  93_750,
    porter_innkjop_kr:     400_000,
    betong_innkjop_kr:     370_000,
  },
  paaslag_beregnet: {
    stal_markup:    1.40,   // 250k → 350k
    sandwich_markup: 1.15,
    per_blokk_markup: {
      stal:       1.40,
      yttervegg:  1.15,
      tak:        1.15,
      innervegg:  1.15,
      kran_lift:  1.10,
    },
  },
  scope: 'stål, yttervegg, tak, innervegg, kran/lift, dører/vinduer, porter, betong, oljeutskiller, rørlegger',
  tekniske_losninger: 'PIR 100mm sandwich vegger, TRP-tak med taktekking, spilekledning yttervegg, 4 stk foldeporter, oljeutskiller. Ingen brannkrav (R0). Vaskehall totalentreprise uten elektro.',
  merknader: 'Glitra Drift AS, Krokstadelva. Vaskehall 140m² BRA. Priset 23.09.2025.',
}

// ── BUSSGARASJE MJÅVANN (Kristiansand) ────────────────────────────────────────
// Data from: Bussgarasje Mjåvann.xlsx → Tilbud sheet
// Hulldekke 410 m² (2.etg mesanin for kontorer/garderobe)
// BRA: 1690 m² (grunnflate) + 410 m² hulldekke = 2100 m² total
// Tilbudssum ex mva: 32,990,000
const buss = {
  navn: 'Bussgarasje Mjåvann - Kristiansand',
  driveId: 'local-bussgarasje-mjavaann-kristiansand',
  sist_oppdatert: new Date('2026-02-28').toISOString(),
  bygningstype: 'garasje',
  bygg: {
    type: 'Bussgarasje 2-etasjer: stålkonstruksjon med hulldekke 410m² (mesanin 2.etg garderobe/kontor), sandwich PIR 140mm vegger, TRP-tak + taktekking, betongbrystning. Totalentreprise inkl. graving, VVS, elektro, ventilasjon.',
    dimensjoner: 'Takareal 1690 m², yttervegg 1144 m², innervegg 280 m², hulldekke 410 m². Estimert ca. 50×34m grunnflate, gesimshøyde ca. 6–7m.',
    bra_m2:    2100,   // 1690 grunnflate + 410 hulldekke
    fasade_m2: 1144,
    tak_m2:    1690,
    lokasjon:  'Kristiansand (Mjåvannsåsen 5)',
  },
  priser_til_kunde: {
    stal:          2_397_880 + 660_100,   // stålkonstruksjon + hulldekke
    tak:           937_805 + 1_546_688,   // TRP plater + taktekking UE
    yttervegg:     1_565_467,             // sandwich 140mm PIR full
    innervegg:     317_055,               // innervegg 100mm RW
    kran_lift:     247_350,               // manitou + lifter
    dorer_vinduer: 181_988 + 517_500 + 462_000,  // dører + vinduer + porter UE
    betong:        1_837_500,             // betong gulv UE
    betongbrystning: 718_364,             // betongbrystning UE
    graving:       5_032_800,             // graving totalentreprise
    elektro:       2_205_000,
    rorlegger:     3_220_000,
    ventilasjon:   3_310_850,
    firesafe_brannsikring: 55_000 + 60_500,  // firesafe UE + brannisolasjon søyler
    rigg_drift_pct: 6.0,
    sum_eks_mva:   32_990_000,
  },
  innkjop_fra_leverandorer: {
    stal_leverandor:       'Ståleriet (T202623)',
    stal_innkjop_kr:       1_588_000,    // fra prisoppsett row 3
    sandwich_leverandor:   'GHV (Pristilbud 260218)',
    sandwich_innkjop_kr:   537_680 + 114_800,  // yttervegg + innervegg innkjøp
    sandwich_type:         'PIR 140mm (SP2B)',
    tak_leverandor:        'TRP galvanisert (egen)',
    tak_innkjop_kr:        388_700 + 202_800 + 185_900,  // plater + montering + festemateriell
    andre_ue:              'Taktekking 1406k, Betong 1750k, Graving 4660k, Elektro 2100k, Rørlegger 2800k, Ventilasjon 2879k, Betongbrystning 653k',
    innervegg_innkjop_kr:  114_800,
    kran_lift_innkjop_kr:  110_000 + 45_500 + 21_000 + 20_000 + 20_000 + 8_000,
    porter_innkjop_kr:     440_000,
    betong_innkjop_kr:     1_750_000,
  },
  paaslag_beregnet: {
    stal_markup:    1.51,   // 1588k → 2398k
    sandwich_markup: 1.10,
    per_blokk_markup: {
      stal:       1.51,
      yttervegg:  1.10,
      tak:        1.20,
      innervegg:  1.15,
      kran_lift:  1.10,
    },
  },
  scope: 'stål, hulldekke, yttervegg, tak, innervegg, kran/lift, dører/vinduer, porter, betong, betongbrystning, graving, elektro, rørlegger, ventilasjon, brannisolasjon',
  tekniske_losninger: 'PIR 140mm sandwich vegger (SP2B), TRP-tak med taktekking, hulldekke 410m² (2.etg), betongbrystning, R15 brannisolasjon på søyler 50lm. Stor totalentreprise inkl. alle tekniske fag. Porter 1stk (stor busspaker). Vinduer fasade (Umbra glazing). Firesafe.',
  merknader: 'Risdal Touring AS, Mjåvannsåsen 5 Kristiansand. Bussgarasje 2100m² BRA totalt (1690 gr.fl + 410 hulldekke). Priset 2026. Totalentreprise inkl. graving 4.66M, el 2.1M, VVS 3.22M, ventilasjon 2.88M.',
}

// ── Write to historiske_prosjekter.json ───────────────────────────────────────
const histPath = './src/historiske_prosjekter.json'
const hist = JSON.parse(readFileSync(histPath, 'utf8'))

// Check if already added
const alreadyHas = (navn) => hist.some(p => p.navn === navn)

let added = 0
if (!alreadyHas(nyb.navn)) { hist.push(nyb); added++ }
if (!alreadyHas(buss.navn)) { hist.push(buss); added++ }

writeFileSync(histPath, JSON.stringify(hist, null, 2), 'utf8')

console.log(`\nDone: ${added} prosjekter lagt til. Total: ${hist.length} prosjekter.\n`)
hist.slice(-2).forEach(p => {
  const s = p.priser_til_kunde
  const bra = p.bygg.bra_m2
  const stalPerM2 = s.stal ? Math.round(s.stal / bra) : '—'
  console.log(`  ✓ ${p.navn}`)
  console.log(`    BRA: ${bra} m² | stål: ${s.stal?.toLocaleString('nb-NO')} kr (${stalPerM2} kr/m²) | sum: ${s.sum_eks_mva?.toLocaleString('nb-NO')} kr`)
})
