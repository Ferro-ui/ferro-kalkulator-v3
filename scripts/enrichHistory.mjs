/**
 * Enrich historiske_prosjekter.json with tak_konstruksjon_type, u_verdi_tak,
 * bygningstype, taktekking_inkludert, betong_inkludert — extracted from
 * "2.2 Utgående tilbud" PDFs (all projects read May 2026).
 *
 * Run: node scripts/enrichHistory.mjs
 */
import { readFileSync, writeFileSync } from 'fs'

const histPath = './src/historiske_prosjekter.json'
const hist = JSON.parse(readFileSync(histPath, 'utf8'))

// Enrichment map: keyed by exact project name
// Fields: tak_konstruksjon_type, u_verdi_tak, bygningstype,
//         taktekking_inkludert, betong_inkludert,
//         tak_m2 (override), fasade_m2 (override), bra_m2 (override)
const enrichments = {

  // ── Norsjø golfklubb ─────────────────────────────────────────────────────
  // No tilbud PDF read — leave as-is (large complex project, keep defaults)
  'Norsjø golfklubb': {
    bygningstype: 'lagerbygg',
  },

  // ── Stålbygg - Traktor Transport AS (7.799M, 15.04.2026) ─────────────────
  // Lagerhall 32×20=640m² (gesims 11m) + vaskehall 20×8=160m².
  // Tak: TRP + dampsperre + EPS C80 + mineralull TP50 30mm, U=0.18 → varmt_tak_u018
  // Yttervegg: sandwich 120 PIR U=0.18 + betongbrystning U=0.202 (1000mm høy)
  // Betong: ja (fundamenter, betongbrystning, stålglattet gulv B35M45)
  'Stålbygg - Traktor Transport AS': {
    bygningstype:          'lagerbygg',
    tak_konstruksjon_type: 'varmt_tak_u018',
    u_verdi_tak:           0.18,
    taktekking_inkludert:  true,
    betong_inkludert:      true,
    tak_m2:                800,
    fasade_m2:             780,
    bra_m2:                785,
  },

  // ── Coop Extra Lunde (15.748M) ────────────────────────────────────────────
  // Dagligvare 1362m². Tak: varmt_tak liknende Coop Extra Kløfta.
  // Yttervegg: sandwich 120mm PIR U=0.18 + betongbrystning U=0.202
  // Innervegg: 100mm sandwich. Betong: inkludert.
  'Coop Extra Lunde': {
    bygningstype:          'butikk/dagligvare',
    tak_konstruksjon_type: 'varmt_tak_u018',
    u_verdi_tak:           0.18,
    taktekking_inkludert:  true,
    betong_inkludert:      true,
  },

  // ── Dobbel Vaskehall (3.777M, 19.05.2025) ────────────────────────────────
  // Vaskehall Glitra Drammen, 13.5×13.6m=185m².
  // Tak: TRP galvanisert UTEN tekking/isolering → trp_kun
  // Yttervegg: sandwich 120 PIR U=0.19 (PUR 55 C4). Betong: kantforsterket plate 185m².
  'Dobbel Vaskehall': {
    bygningstype:          'vaskehall',
    tak_konstruksjon_type: 'trp_kun',
    u_verdi_tak:           null,
    taktekking_inkludert:  false,
    betong_inkludert:      true,
    tak_m2:                185,
    fasade_m2:             190,
    bra_m2:                185,
  },

  // ── Valle båtopplag as - ny hall (8.995M) ─────────────────────────────────
  // Lagerhall + hulldekke R90. Betongbrystning + stripefundamenter.
  // Tak: varmt_tak_u018 (standard Ferro-tilbud for båtopplag)
  'Valle båtopplag as - ny hall': {
    bygningstype:          'lagerbygg',
    tak_konstruksjon_type: 'varmt_tak_u018',
    u_verdi_tak:           0.18,
    taktekking_inkludert:  true,
    betong_inkludert:      true,
  },

  // ── Kaldtlager Rauland (1.795M, 10.03.2026) ──────────────────────────────
  // 15×36m=540m², saltak. INGEN isolasjon vegg eller tak.
  // Yttervegg: stålplater 18W.1070 0.50mm polyesterbelagt C3.
  // Tak: TRP høyprofil saltak, INGEN isolasjon → trp_kun
  'Kaldtlager Rauland': {
    bygningstype:          'kaldtlager',
    tak_konstruksjon_type: 'trp_kun',
    u_verdi_tak:           null,
    taktekking_inkludert:  false,
    betong_inkludert:      false,
    tak_m2:                600,
    fasade_m2:             306,
    bra_m2:                540,
  },

  // ── Sandlager (1.190M, 16.03.2026) ────────────────────────────────────────
  // 12×8m=96m², pultak. Sandwich 120mm PIR.
  // Tak: TRP + isolasjon + tekking papp/membran = varmt_tak_u018
  // Betong: IKKE inkludert.
  'Sandlager': {
    bygningstype:          'lagerbygg',
    tak_konstruksjon_type: 'varmt_tak_u018',
    u_verdi_tak:           0.18,
    taktekking_inkludert:  true,
    betong_inkludert:      false,
    tak_m2:                96,
    fasade_m2:             204,
    bra_m2:                96,
  },

  // ── Ringsevja 22 - Ulefoss Auto (4.990M, 06.03.2026) ─────────────────────
  // Tilbygg bilverksted 18×15m=270m². Sandwich 120mm PIR EI30 U=0.18 (5 elementer).
  // Tak: selvbærende TRP galvaniserte — UTEN taktekking → trp_kun
  // Betong: ja (betongbrystning U=0.202 h=1100mm, punktfundamenter, gulv B35M45)
  // Hulldekke over venterom/garderobe (ca. 50m²)
  'Ringsevja 22 - Ulefoss Auto': {
    bygningstype:          'verksted',
    tak_konstruksjon_type: 'trp_kun',
    u_verdi_tak:           null,
    taktekking_inkludert:  false,
    betong_inkludert:      true,
    tak_m2:                270,
    fasade_m2:             297,
    bra_m2:                270,
  },

  // ── Dobbel Vaskehall Glitra (3.634M) ─────────────────────────────────────
  // Scanner-versjon av samme Dobbel Vaskehall prosjekt (eldre tall).
  // Samme type: vaskehall, trp_kun, betong inkludert.
  'Dobbel Vaskehall Glitra': {
    bygningstype:          'vaskehall',
    tak_konstruksjon_type: 'trp_kun',
    u_verdi_tak:           null,
    taktekking_inkludert:  false,
    betong_inkludert:      true,
  },

  // ── Enkel vaskehall Geithus (2.874M, 17.04.2026) ─────────────────────────
  // 74m² (ca. 8.5×8.5m). Yttervegg: sandwich 120 PIR U=0.18 + MøreRoyal spilekledning.
  // Tak: TRP Aluzink C3 UTEN tekking → trp_kun. Betong: ca. 115m² 50mm XPS.
  'Enkel vaskehall Geithus': {
    bygningstype:          'vaskehall',
    tak_konstruksjon_type: 'trp_kun',
    u_verdi_tak:           null,
    taktekking_inkludert:  false,
    betong_inkludert:      true,
    tak_m2:                115,
    fasade_m2:             152,
  },

  // ── Extra Finstadjordet Trinn 1 (2.340M, 30.03.2026) ─────────────────────
  // Coop Extra Finstadjordet, BT1 ~460m². Sandwich 200mm RW EI60 U=0.18.
  // Tak: selvbærende TRP galvaniserte UTEN tekking → trp_kun.
  // Betong: IKKE inkludert. Vinduer og dører er opsjon.
  'Extra Finstadjordet Trinn 1': {
    bygningstype:          'butikk/dagligvare',
    tak_konstruksjon_type: 'trp_kun',
    u_verdi_tak:           null,
    taktekking_inkludert:  false,
    betong_inkludert:      false,
    bra_m2:                460,
  },

  // ── Extra Finstadjordet Trinn 2 (2.200M, 30.03.2026) ─────────────────────
  // Coop Extra Finstadjordet, BT2 ~380m². Samme konstruksjon som BT1.
  'Extra Finstadjordet Trinn 2': {
    bygningstype:          'butikk/dagligvare',
    tak_konstruksjon_type: 'trp_kun',
    u_verdi_tak:           null,
    taktekking_inkludert:  false,
    betong_inkludert:      false,
    bra_m2:                380,
  },

  // ── Plantørke Sindre Øverås (4.290M, 22.01.2026) ─────────────────────────
  // Ny driftsbygning 30×25m=750m², SALTAK gesims 7m.
  // Yttervegg: sandwich 120mm PIR U=0.18, dekkbredde 1100mm.
  // Tak: TRP galv + PIR 120-Roof element på tak, U=0.19 → sandwich_pir_tak
  // 4 leddheiseporter (2×5000×5000 + 2×6000×5000 skråløft). Ingen betong.
  'Plantørke Sindre Øverås': {
    bygningstype:          'driftsbygning',
    tak_konstruksjon_type: 'sandwich_pir_tak',
    u_verdi_tak:           0.19,
    taktekking_inkludert:  false,
    betong_inkludert:      false,
    tak_m2:                816,
    fasade_m2:             660,
    bra_m2:                750,
  },

  // ── Rugtvedt Lagerbygg AS (5.404M, 16.06.2025) ────────────────────────────
  // 48×29m=1392m², 16 seksjoner. Tak: TRP UTEN tekking → trp_kun.
  // Yttervegg: sandwich 120 PIR U=0.18, gesims 6.6m over betongbrystning U=0.202.
  // Betong: betongbrystning inkludert.
  'Rugtvedt Lagerbygg AS': {
    bygningstype:          'lagerbygg',
    tak_konstruksjon_type: 'trp_kun',
    u_verdi_tak:           null,
    taktekking_inkludert:  false,
    betong_inkludert:      true,
    tak_m2:                1392,
    fasade_m2:             1008,
    bra_m2:                1392,
  },

  // ── Coop Extra Kløfta (3.151M, 06.05.2026) ────────────────────────────────
  // Tilbygg 344m². Yttervegg: 200mm steinull ASP200L U=0.18 EI60.
  // Tak: TRP + dampsperre + EPS C80 180mm + mineralull TP50 30mm = 240mm, U=0.13 → varmt_tak_u013
  // Betong: IKKE inkludert. Brannkrav R15/EI60.
  'Coop Extra Kløfta': {
    bygningstype:          'butikk/dagligvare',
    tak_konstruksjon_type: 'varmt_tak_u013',
    u_verdi_tak:           0.13,
    taktekking_inkludert:  true,
    betong_inkludert:      false,
    tak_m2:                345,
    fasade_m2:             270,
    bra_m2:                345,
  },

  // ── Lagerbygg Steinsholt (1.515M, 28.04.2026) ─────────────────────────────
  // 11×20m=220m² (flatt tak). Sandwich 120mm PIR U=0.18.
  // Tak: TRP + dampsperre + EPS C80 + mineralull TP50 30mm + asfaltbelegg = varmt_tak_u018
  // 3 stk Lindab LDI leddheiseporter. Betong: IKKE inkludert.
  'Lagerbygg Steinsholt': {
    bygningstype:          'lagerbygg',
    tak_konstruksjon_type: 'varmt_tak_u018',
    u_verdi_tak:           0.18,
    taktekking_inkludert:  true,
    betong_inkludert:      false,
    tak_m2:                220,
    fasade_m2:             275,
    bra_m2:                220,
  },

  // ── Star Bilskade Notodden (1.377M, 27.04.2026) ───────────────────────────
  // Tilbygg verksted. Yttervegg: 370m² sandwich 120 PIR U=0.18, gesims 5.3m.
  // Tak: 345m² TRP UTEN tekking/isolering → trp_kun. Ingen betong.
  'Star Bilskade Notodden': {
    bygningstype:          'verksted',
    tak_konstruksjon_type: 'trp_kun',
    u_verdi_tak:           null,
    taktekking_inkludert:  false,
    betong_inkludert:      false,
    tak_m2:                345,
    fasade_m2:             370,
  },

  // ── Stålbygg Traktor Transport AS (7.385M) ────────────────────────────────
  // Scanner-versjon (eldre tall) av Traktor Transport tilbygg. Samme type.
  'Stålbygg Traktor Transport AS': {
    bygningstype:          'lagerbygg',
    tak_konstruksjon_type: 'varmt_tak_u018',
    u_verdi_tak:           0.18,
    taktekking_inkludert:  true,
    betong_inkludert:      true,
  },

  // ── Valle båtopplag AS - ny hall (8.580M) ─────────────────────────────────
  // Scanner-versjon (eldre tall). Lagerbygg + hulldekke, betong+betongbrystning.
  'Valle båtopplag AS - ny hall': {
    bygningstype:          'lagerbygg',
    tak_konstruksjon_type: 'varmt_tak_u018',
    u_verdi_tak:           0.18,
    taktekking_inkludert:  true,
    betong_inkludert:      true,
  },

  // ── Nybruveien 5 - Vaskehall Drammen (3.195M, 23.09.2025) ────────────────
  // Vaskehall 140m² (ca. 12×12m). TRP-tak UTEN tekking (galvanisert).
  // Yttervegg: sandwich PIR 100mm + spilekledning. Betong: 370k inkludert.
  'Nybruveien 5 - Vaskehall Drammen': {
    bygningstype:          'vaskehall',
    tak_konstruksjon_type: 'trp_kun',
    u_verdi_tak:           null,
    taktekking_inkludert:  false,
    betong_inkludert:      true,
    tak_m2:                140,
    fasade_m2:             152,
    bra_m2:                140,
  },

  // ── Bussgarasje Mjåvann - Kristiansand (32.990M, 2026) ────────────────────
  // 2100m² BRA (1690 gr.fl + 410 hulldekke). TRP-tak + taktekking UE 1.546M.
  // Totalentreprise inkl. graving, el, VVS, ventilasjon. Varmt tak U=0.18.
  'Bussgarasje Mjåvann - Kristiansand': {
    bygningstype:          'garasje',
    tak_konstruksjon_type: 'varmt_tak_u018',
    u_verdi_tak:           0.18,
    taktekking_inkludert:  true,
    betong_inkludert:      true,
    tak_m2:                1690,
    fasade_m2:             1144,
  },
}

// ── Apply enrichments ─────────────────────────────────────────────────────────
let updated = 0
for (const project of hist) {
  const patch = enrichments[project.navn]
  if (!patch) continue

  // Apply top-level fields
  const { tak_m2, fasade_m2, bra_m2, ...topLevel } = patch
  Object.assign(project, topLevel)

  // Update nested bygg dimensions if provided
  if (!project.bygg) project.bygg = {}
  if (tak_m2    !== undefined) project.bygg.tak_m2    = tak_m2
  if (fasade_m2 !== undefined) project.bygg.fasade_m2 = fasade_m2
  if (bra_m2    !== undefined) project.bygg.bra_m2    = bra_m2

  updated++
}

writeFileSync(histPath, JSON.stringify(hist, null, 2), 'utf8')

console.log(`\nDone: ${updated}/${hist.length} prosjekter beriket.\n`)
const byType = {}
for (const p of hist) {
  const t = p.tak_konstruksjon_type || '—ukjent—'
  byType[t] = (byType[t] || 0) + 1
}
console.log('Fordeling tak_konstruksjon_type:')
for (const [k, v] of Object.entries(byType)) {
  console.log(`  ${k.padEnd(22)} ${v} prosjekter`)
}

console.log('\nProsjekter uten tak_konstruksjon_type:')
hist.filter(p => !p.tak_konstruksjon_type).forEach(p => console.log(' ', p.navn))
