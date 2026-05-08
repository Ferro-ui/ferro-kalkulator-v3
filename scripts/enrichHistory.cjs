// enrichHistory.cjs — extracts ALL cost blocks from Prisoppsett (Egne + UE)
// Updates historiske_prosjekter.json with full innkjøp and salgspris per block + markup%
// Run: node scripts/enrichHistory.cjs

const fs   = require('fs')
const path = require('path')
const XLSX = require('xlsx')

const JSON_PATH = path.join(__dirname, '../src/historiske_prosjekter.json')
const HIST_ROOT = path.join(__dirname, '../Historik_OLD')

// ─── Prisoppsett column layout ─────────────────────────────────────────────────
// col0: Produkt/beskrivelse
// col1: Innkjøpspris per enhet
// col2: Enhet (RS, kr/m2, kr/lm, kr/stk, kr/dag...)
// col3: Påslag-faktor (1.10 = 10%, 1.15 = 15%, 1.36 = 36%)
// col4: Utpris per enhet (= col1 × col3)
// col5: Enhet
// col6: Kostpris prosjekt (= innkjøp totalt for denne linjen)
// col7: Salgspris (= col6 × col3 = hva Ferro fakturerer kunden)
//
// Section header: col0 non-empty, col1 blank
// Egne arbeider sections → Ferro utfører selv
// UE section → subentreprenører (porter, betong, taktekking, screens...)

// ─── Project → XLSX mapping ───────────────────────────────────────────────────
const PROJECT_MAP = [
  {
    navn: 'Dobbel Vaskehall Glitra',
    xlsx: '2.1.3 Bekreftet oppdrag/Dobbel Vaskehall/2. Tilbud/2.2 Utgående tilbud/OLD/Vaskehall Glitra.xlsx',
    stal_lev: 'Ståleriet / Byggstål',
    tak_lev: null,
  },
  {
    navn: 'Enkel vaskehall Geithus',
    xlsx: '2.1.3 Bekreftet oppdrag/Enkel vaskehall Geithus/2. Tilbud/2.2 Utgående tilbud/Kalkulasjon Enkel vaskehall Geithus.xlsx',
    stal_lev: 'Ståleriet',
    tak_lev: null,
  },
  {
    navn: 'Extra Finstadjordet Trinn 1',
    xlsx: '2.1.3 Bekreftet oppdrag/Extra Finstadjordet/2. Tilbud/2.2 Utgående tilbud/Trinn 1/Extra Finstadjordet Trinn 1.xlsx',
    stal_lev: 'Ståleriet',
    tak_lev: 'Ruukki',
  },
  {
    navn: 'Extra Finstadjordet Trinn 2',
    xlsx: '2.1.3 Bekreftet oppdrag/Extra Finstadjordet/2. Tilbud/2.2 Utgående tilbud/Trinn 2/Extra Finstadjordet trinn 2.xlsx',
    stal_lev: 'Ståleriet',
    tak_lev: 'Ruukki',
  },
  {
    navn: 'Plantørke Sindre Øverås',
    xlsx: '2.1.3 Bekreftet oppdrag/Plantørke - Sindre Øverås/2. Tilbud/2.2 Utgående tilbud/05.05.26 Plantørke - Sindre.xlsx',
    stal_lev: 'Ståleriet / IPOA',
    tak_lev: 'Areco / Ruukki',
  },
  {
    navn: 'Ringsevja 22 - Ulefoss Auto',
    xlsx: '2.1.3 Bekreftet oppdrag/Ringsevja 22 - Ulefoss Auto/2. Tilbud/2.2 Utgående tilbud/03.03.26 Januar 26 - Ringsevja 22 - Ulefoss auto.xlsx',
    stal_lev: 'Ståleriet / Byggstål',
    tak_lev: 'GHV',
  },
  {
    navn: 'Rugtvedt Lagerbygg AS',
    xlsx: '2.1.3 Bekreftet oppdrag/Rugtvedt Lagerbygg AS/2. Tilbud/2.2 Utgående tilbud/24.11.25 Rugtvedt Lagerbygg AS.xlsx',
    stal_lev: 'Ståleriet / Byggstål / Storm',
    tak_lev: 'GHV',
  },
  {
    navn: 'Coop Extra Kløfta',
    xlsx: 'Ferdigstilt kalkulasjon 2026/Coop Extra Kløfta/2. Tilbud/2.2 Utgående tilbud/Coop Extra Kløfta.xlsx',
    stal_lev: 'Ståleriet',
    tak_lev: null,
  },
  {
    navn: 'Kaldtlager Rauland',
    xlsx: 'Ferdigstilt kalkulasjon 2026/Kaldtlager Rauland/2. Tilbud/2.2 Utgående tilbud/Kaldtlager Rauland.xlsx',
    stal_lev: 'Ståleriet',
    tak_lev: 'Tata Steel / Ruukki',
  },
  {
    navn: 'Lagerbygg Steinsholt',
    xlsx: 'Ferdigstilt kalkulasjon 2026/Lagerbygg Steinsholt/2. Tilbud/2.2 Utgående tilbud/Lagerbygg Steinsholt.xlsx',
    stal_lev: 'Ståleriet',
    tak_lev: null,
  },
  {
    navn: 'Sandlager',
    xlsx: 'Ferdigstilt kalkulasjon 2026/Sandlager/2. Tilbud/2.2 Utgående tilbud/Sandlager.xlsx',
    stal_lev: 'Ståleriet',
    tak_lev: 'Areco',
  },
  {
    navn: 'Star Bilskade Notodden',
    xlsx: 'Ferdigstilt kalkulasjon 2026/Star Bilskade Notodden/2. Tilbud/2.2 Utgående tilbud/Star Bilskade Notodden.xlsx',
    stal_lev: 'Ståleriet',
    tak_lev: null,
  },
  {
    navn: 'Stålbygg Traktor Transport AS',
    xlsx: 'Ferdigstilt kalkulasjon 2026/Stålbygg - Traktor Transport AS/2. Tilbud/2.2 Utgående tilbud/Stålbygg - Traktor Transport AS.xlsx',
    stal_lev: 'Ståleriet / Storm',
    tak_lev: 'Tata Steel',
  },
  {
    navn: 'Valle båtopplag AS - ny hall',
    xlsx: 'Ferdigstilt kalkulasjon 2026/Valle båtopplag as - ny hall/2. Tilbud/2.2 Utgående tilbud/13.13.26 Valle båtopplag as - ny hall.xlsx',
    stal_lev: 'Ståleriet',
    tak_lev: 'GHV',
  },
]

// ─── Section → block key ──────────────────────────────────────────────────────
// Maps section header keywords → JSON field name
// Order matters: more specific first
const SECTION_RULES = [
  // Egne arbeider
  { kw: 'stålkonst',          block: 'stål' },
  { kw: 'komplettstål',       block: 'stål' },
  { kw: 'selvbær',            block: 'tak' },
  { kw: 'trp galv plater',    block: 'tak' },
  { kw: 'takplat',            block: 'tak' },
  { kw: 'trapes fasade',      block: 'yttervegg' },
  { kw: 'yttervegg',          block: 'yttervegg' },
  { kw: 'fasadeplat',         block: 'yttervegg' },
  { kw: 'pir elementer.*ytter', block: 'yttervegg', regex: true },
  { kw: 'sandwich innervegg', block: 'innervegg' },
  { kw: 'innervegg',          block: 'innervegg' },
  { kw: 'kran og lift',       block: 'kran_lift' },
  // UE section items (fixed rows, not sub-headers)
  { kw: 'taktekking',         block: 'taktekking', ue: true },
  { kw: 'betongbrystning',    block: 'betong',     ue: true },
  { kw: 'porter',             block: 'porter',     ue: true },
  { kw: 'betongarbeid',       block: 'betong',     ue: true },
  { kw: 'graving',            block: 'graving',    ue: true },
  { kw: 'screens',            block: 'screens',    ue: true },
  { kw: 'oljeutskiller',      block: 'oljeutskiller', ue: true },
  { kw: 'malerarbeid',        block: 'maling',     ue: true },
]

function matchSection(c0l) {
  for (const rule of SECTION_RULES) {
    if (rule.ue) continue
    if (rule.regex ? new RegExp(rule.kw, 'i').test(c0l) : c0l.includes(rule.kw))
      return rule.block
  }
  return null
}

function matchUE(c0l) {
  for (const rule of SECTION_RULES) {
    if (!rule.ue) continue
    if (c0l.includes(rule.kw)) return rule.block
  }
  return null
}

// ─── Extract sandwich type from header ───────────────────────────────────────
function extractType(c0) {
  const pir = c0.match(/PIR[\s-]*(\d+)\s*mm/i) || c0.match(/(\d+)\s*mm\s*PIR/i)
  const rw  = c0.match(/(?:steinull|RW|Rockwool)[\s-]*(\d+)\s*mm/i) || c0.match(/(\d+)\s*mm\s*(?:steinull|RW|Rockwool)/i)
  if (pir) return `PIR ${pir[1]}mm`
  if (rw)  return `Steinull ${rw[1]}mm`
  return null
}

// ─── Parse Prisoppsett ────────────────────────────────────────────────────────
function parsePrisoppsett(wb) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Prisoppsett'], {header:1, defval:''})
  if (!rows.length) return {}

  const blocks = {}  // block → { kost, salg }
  let section = null
  let inUE = false
  let sandwichType = null

  const add = (block, kost, salg) => {
    if (!blocks[block]) blocks[block] = { kost: 0, salg: 0 }
    blocks[block].kost += kost
    blocks[block].salg += salg
  }

  for (const row of rows) {
    const c0  = String(row[0] || '').normalize('NFC').trim()
    const c0l = c0.toLowerCase()
    const c1  = String(row[1] || '').trim()
    const isHeader = c0.length > 0 && !c1

    // Detect UE section start (exactly "UE")
    if (c0 === 'UE' && !c1) { inUE = true; section = null; continue }
    // Sum egne arbeider / Sum UE → reset
    if (isHeader && c0l.match(/^sum/)) { inUE = false; section = null; continue }

    if (isHeader && !inUE) {
      section = matchSection(c0l)
      // Extract sandwich type from yttervegg header
      if (section === 'yttervegg' && !sandwichType) {
        sandwichType = extractType(c0)
      }
      continue
    }

    const kost = parseFloat(String(row[6] || '').replace(/\s/g,'').replace(',','.')) || 0
    const salg = parseFloat(String(row[7] || '').replace(/\s/g,'').replace(',','.')) || 0

    if (inUE && kost > 0) {
      // UE: each row IS a named block item (not nested under sub-headers)
      const ueBlock = matchUE(c0l)
      if (ueBlock) add(ueBlock, kost, salg)
    } else if (!inUE && section && (kost > 0 || salg > 0)) {
      add(section, kost, salg)
    }
  }

  // Round all
  for (const b of Object.values(blocks)) {
    b.kost = Math.round(b.kost)
    b.salg = Math.round(b.salg)
  }

  return { blocks, sandwichType }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const projects = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'))

let updated = 0
for (const mapping of PROJECT_MAP) {
  const entry = projects.find(p => p.navn.normalize('NFC') === mapping.navn.normalize('NFC'))
  if (!entry) { console.log(`⚠ Not found in JSON: ${mapping.navn}`); continue }

  const xlsxPath = path.join(HIST_ROOT, mapping.xlsx)
  if (!fs.existsSync(xlsxPath)) { console.log(`⚠ XLSX missing: ${xlsxPath}`); continue }

  let parsed
  try {
    const wb = XLSX.readFile(xlsxPath)
    parsed = parsePrisoppsett(wb)
  } catch (e) {
    console.log(`✗ ${mapping.navn}: ${e.message}`); continue
  }

  const { blocks, sandwichType } = parsed

  // ── Update innkjop_fra_leverandorer ──────────────────────────────────────
  if (!entry.innkjop_fra_leverandorer) entry.innkjop_fra_leverandorer = {}
  const inn = entry.innkjop_fra_leverandorer
  const isRich = v => v && String(v).length > 30  // don't overwrite long AI-extracted strings

  if (!isRich(inn.stal_leverandor) && mapping.stal_lev) inn.stal_leverandor = mapping.stal_lev
  if (!isRich(inn.sandwich_leverandor) && mapping.tak_lev) inn.sandwich_leverandor = mapping.tak_lev
  if (sandwichType && (!inn.sandwich_type || inn.sandwich_type.length < 25)) inn.sandwich_type = sandwichType

  // Innkjøp (kostpris) per block — always overwrite with XLSX-authoritative data
  if (blocks.stål?.kost)          inn.stal_innkjop_kr       = blocks.stål.kost
  if (blocks.yttervegg?.kost)     inn.sandwich_innkjop_kr   = blocks.yttervegg.kost
  if (blocks.tak?.kost)           inn.tak_innkjop_kr         = blocks.tak.kost
  if (blocks.innervegg?.kost)     inn.innervegg_innkjop_kr  = blocks.innervegg.kost
  if (blocks.kran_lift?.kost)     inn.kran_lift_innkjop_kr  = blocks.kran_lift.kost
  if (blocks.porter?.kost)        inn.porter_innkjop_kr     = blocks.porter.kost
  if (blocks.betong?.kost)        inn.betong_innkjop_kr     = blocks.betong.kost
  if (blocks.taktekking?.kost)    inn.taktekking_innkjop_kr = blocks.taktekking.kost
  if (blocks.screens?.kost)       inn.screens_innkjop_kr    = blocks.screens.kost

  // ── Update priser_til_kunde from salgspris (XLSX col7) ───────────────────
  if (!entry.priser_til_kunde) entry.priser_til_kunde = {}
  const pr = entry.priser_til_kunde
  // Only fill nulls — don't overwrite if already populated from old extraction
  if (!pr.stal      && blocks.stål?.salg)      pr.stal      = blocks.stål.salg
  if (!pr.yttervegg && blocks.yttervegg?.salg) pr.yttervegg = blocks.yttervegg.salg
  if (!pr.tak       && blocks.tak?.salg)       pr.tak       = blocks.tak.salg
  if (!pr.innervegg && blocks.innervegg?.salg) pr.innervegg = blocks.innervegg.salg
  if (!pr.kran_lift && blocks.kran_lift?.salg) pr.kran_lift = blocks.kran_lift.salg
  if (!pr.dorer_vinduer && blocks.porter?.salg) pr.dorer_vinduer = blocks.porter.salg
  if (!pr.betong    && (blocks.betong?.salg || blocks.betongbrystning?.salg))
    pr.betong = (blocks.betong?.salg || 0) + (blocks.betongbrystning?.salg || 0)
  if (!pr.graving   && blocks.graving?.salg)   pr.graving   = blocks.graving.salg

  // ── Update paaslag_beregnet ──────────────────────────────────────────────
  if (!entry.paaslag_beregnet) entry.paaslag_beregnet = {}
  const pa = entry.paaslag_beregnet
  const pctStr = (kost, salg) => kost > 0 ? Math.round(salg/kost*100) + '%' : null
  const perBlock = {}
  for (const [blk, v] of Object.entries(blocks)) {
    if (v.kost > 1000) perBlock[blk] = pctStr(v.kost, v.salg)
  }
  pa.per_blokk_markup = perBlock
  if (blocks.stål?.kost > 0) pa.stal_paslag = pctStr(blocks.stål.kost, blocks.stål.salg)

  // Print summary
  const bsum = Object.entries(blocks).filter(([,v]) => v.kost > 0)
    .map(([k,v]) => `${k}:${Math.round(v.kost/1000)}k→${Math.round(v.salg/1000)}k(${Math.round(v.salg/v.kost*100)}%)`)
    .join(' ')
  console.log(`✓ ${mapping.navn.slice(0,30)}\n  ${bsum}`)
  updated++
}

fs.writeFileSync(JSON_PATH, JSON.stringify(projects, null, 2), 'utf8')
console.log(`\n✅ Updated ${updated} entries in historiske_prosjekter.json`)
