/**
 * Adds Grenland havn - Bygg for industriell varmtvannsvasker
 * Data from: Kalkulasjon mal.xlsx (Tilbud sheet) + Budsjettoverslag PDF
 * Run: node scripts/addGrenlandHavn.mjs
 */
import { readFileSync, writeFileSync } from 'fs'

// 3×3m isolert teknisk bygg (varmtvannsvasker), Stathelle / Bamble kommune
// Gesims 3.3m, PIR 120 sandwich vegger, TRP tak + taktekking, tofløyet ståldør
// Areco Profiles AS leverandør (tilbud 26.122, 06.03.2026)
const entry = {
  navn: 'Grenland havn - Varmtvannsvasker Stathelle',
  driveId: 'local-grenland-havn-varmtvannsvasker',
  sist_oppdatert: new Date('2026-03-04').toISOString(),
  bygningstype: 'teknisk bygg',
  bygg: {
    type: 'Isolert teknisk bygg (varmtvannsvasker) 3×3m, stålkonstruksjon med sandwich PIR 120mm vegger, selvbærende TRP takplater + taktekking, tofløyet ståldør. 1-etasje.',
    dimensjoner: 'Grunnflate 3×3m = 9 m². Gesimshøyde 3,3m. Yttervegg 35 m², takareal 9 m². Bamble/terrengkategori 3.',
    bra_m2:    9,
    fasade_m2: 35,
    tak_m2:    9,
    lokasjon:  'Stathelle, Bamble kommune (Grenland havn / Frier Vest)',
  },
  priser_til_kunde: {
    // Fra Tilbud-sheet i Kalkulasjon mal.xlsx
    stal:          52_000,   // row 20: stålkonstruksjon prosjektert, levert, montert
    tak:           14_010 + 27_720,  // TRP plater+montering+beslag 14010 + taktekking UE 27720
    yttervegg:     26_950 + 4_830 + 10_063 + 1_438 + 2_012 + 14_893,  // sandwich+mat+mont+kutt+u-besl+beslag = 60186
    kran_lift:     11_000 + 11_000,  // transport Manitou + transport stor lift = 22000
    dorer_vinduer: 34_500,   // tofløyet isolert ståldør
    rigg_drift_pct: 4.0,
    sum_eks_mva:   235_000,
  },
  innkjop_fra_leverandorer: {
    stal_leverandor:     'Ståleriet (lokal leverandør)',
    stal_innkjop_kr:     40_000,   // Prisoppsett row 3: innkjøp 40k → salg 52k
    sandwich_leverandor: 'Areco Profiles AS (tilbud 26.122)',
    sandwich_innkjop_kr: 24_500,   // 35m² × 700 kr/m²
    sandwich_type:       'PIR 120mm SP120 (Korrosjonsklasse C4)',
    tak_leverandor:      'Areco Profiles AS - TP131 Aluzink (C3)',
    tak_innkjop_kr:      3_600 + 6_300,  // 9m² × 400 + montering 9m² × 700 = 9900
    andre_ue:            'Taktekking (Areco) 27720 kr for 9m²',
  },
  paaslag_beregnet: {
    stal_markup:      1.30,   // 40k → 52k
    sandwich_markup:  1.10,   // 24500 → 26950
    tak_markup:       1.20,   // TRP plater ×1.20
    per_blokk_markup: {
      stal:      1.30,
      yttervegg: 1.10,
      tak:       1.20,
    },
  },
  scope: 'stål, yttervegg, tak, taktekking, transport/kran, dør',
  tekniske_losninger: 'PIR 120mm sandwich vegger (SP120 C4), selvbærende TRP takplater Aluzink (C3), taktekking. R0 brannkrav. Tofløyet isolert ståldør 2.0–2.4m bred. Bygget plasseres på ferdigstøpt betongplate. Ingen elektro, VVS, betong.',
  merknader: 'Sør Entreprenør AS / Grenland havn, Frier Vest. Svært lite bygg 9m² BRA (3×3m). Budsjettoverslag 04.03.2026 kr 235 000 eks mva. Høy kr/m² grunnet minimumskostnader for prosjektering, frakt, stålarbeid.',
}

const histPath = './src/historiske_prosjekter.json'
const hist = JSON.parse(readFileSync(histPath, 'utf8'))
if (hist.some(p => p.navn === entry.navn)) {
  console.log('Allerede lagt til:', entry.navn)
} else {
  hist.push(entry)
  writeFileSync(histPath, JSON.stringify(hist, null, 2), 'utf8')
  const s = entry.priser_til_kunde
  console.log(`\nDone: lagt til. Total: ${hist.length} prosjekter.`)
  console.log(`  ✓ ${entry.navn}`)
  console.log(`    BRA: ${entry.bygg.bra_m2} m² | stål: ${s.stal.toLocaleString('nb-NO')} kr | sum: ${s.sum_eks_mva.toLocaleString('nb-NO')} kr`)
  console.log(`    kr/m² total: ${Math.round(s.sum_eks_mva/entry.bygg.bra_m2).toLocaleString('nb-NO')} (veldig høyt — minimumskostnader for 9m²)`)
}
