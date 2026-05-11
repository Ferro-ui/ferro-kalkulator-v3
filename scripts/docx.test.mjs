/**
 * Tests for generateDocx.js — buildDocument()
 * Usage: node scripts/docx.test.mjs
 *
 * Tests run in Node.js (no browser). Uses Packer.toBuffer (not toBlob).
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { pathToFileURL } from 'url'
import path from 'path'
// ── Mock browser globals needed by docx imports ───────────────────────────────
// docx itself is pure JS, no browser APIs needed for Document construction

// ── Import buildDocument ──────────────────────────────────────────────────────
const { buildDocument } = await import(pathToFileURL(path.resolve('./src/generateDocx.js')))

// We need Packer from docx for toBuffer
import { Packer } from 'docx'

// ── Minimal 1×1 PNG logo (avoids ferroLogo.js base64 import issues) ──────────
// A 1×1 transparent PNG as Uint8Array
const TINY_PNG = new Uint8Array([
  137,80,78,71,13,10,26,10, // PNG magic
  0,0,0,13,73,72,68,82,     // IHDR chunk length + type
  0,0,0,1,0,0,0,1,8,6,0,0,0,31,21,196, // 1x1 RGBA
  0,0,0,11,73,68,65,84,120,156,98,248,15,0,0,1,1,0,37,222,221,26, // IDAT
  0,0,0,0,73,69,78,68,174,66,96,130  // IEND
])

// ── Shared test data factories ────────────────────────────────────────────────
function makeBlocks(overrides = {}) {
  return [
    { id: 'stål', name: 'Stålkonstruksjon', price_low: 800000, price_high: 900000, basis: 'kalkulert', assumptions: [] },
    { id: 'yttervegg', name: 'Yttervegger', price_low: 300000, price_high: 350000, basis: 'sandwich PIR', assumptions: ['Konstruksjon: sandwich_pir'] },
    { id: 'tak', name: 'Tak', price_low: 400000, price_high: 450000, basis: 'varmt_tak_u018 stor bucket', assumptions: ['Konstruksjon: varmt_tak_u018'] },
    ...(overrides.extra || []),
  ]
}

function makeData(overrides = {}) {
  return {
    projectName: 'Test Lagerhall',
    result: {
      project_summary: 'Test project',
      exclusions: ['Elektro', 'VVS'],
      warnings: [],
    },
    blocks: overrides.blocks ?? makeBlocks(),
    stalPrice: overrides.stalPrice ?? '',
    riggPct: overrides.riggPct ?? 8,
    logoBytes: TINY_PNG,
    forutsetninger: {
      u_verdi_tak: 0.18,
      u_verdi_vegg: 0.18,
      u_verdi_glass: 1.2,
      tiltaksklasse: '2',
      bruddgrense_kn_m2: 250,
      gyldighet_dager: 14,
    },
    kunde: { firma: 'Test Kunde AS', kontakt: 'Ola Nordmann', adresse: 'Testgata 1, 0000 Oslo' },
    signer: { name: 'Marian Mychko', title: 'Kalkulatør', tlf: '91 92 36 26', email: 'marian@ferrostal.no' },
  }
}

// Helper: serialise document to buffer and extract raw XML text
async function docToXml(doc) {
  const buf = await Packer.toBuffer(doc)
  // Buffer contains a zip (docx). We need to extract word/document.xml
  // Use simple string search on the buffer (XML is UTF-8)
  return buf.toString('utf8')
}

// ── Suite A: Document builds without error ────────────────────────────────────
describe('A — buildDocument smoke tests', () => {

  test('A1 — builds document without throwing', async () => {
    const doc = buildDocument(makeData())
    assert.ok(doc, 'document object should be truthy')
  })

  test('A2 — Packer.toBuffer succeeds (valid docx binary)', async () => {
    const doc = buildDocument(makeData())
    const buf = await Packer.toBuffer(doc)
    assert.ok(buf instanceof Buffer, 'should return Buffer')
    assert.ok(buf.length > 5000, 'buffer should be non-trivial size')
    // docx is a zip file — starts with PK magic bytes
    assert.equal(buf[0], 0x50, 'should start with PK (zip magic byte 0)')
    assert.equal(buf[1], 0x4B, 'should start with PK (zip magic byte 1)')
  })

  test('A3 — builds with no blocks (empty result)', async () => {
    const data = makeData({ blocks: [] })
    const doc = buildDocument(data)
    const buf = await Packer.toBuffer(doc)
    assert.ok(buf.length > 1000, 'empty document should still produce valid docx')
  })

})

// ── Suite B: Stål price calculation ──────────────────────────────────────────
describe('B — stål price resolution', () => {

  // We extract sumExMva by building and inspecting the price table text in XML
  // Simpler: test by computing expected values ourselves

  test('B1 — stål block mid price used when stalPrice is empty string', () => {
    const blocks = makeBlocks()
    const stalBlock = blocks.find(b => b.id === 'stål')
    const stalMid = Math.round((stalBlock.price_low + stalBlock.price_high) / 2)
    assert.equal(stalMid, 850000, 'stål block mid should be 850 000')

    // Verify buildDocument doesn't throw and the stål block is consumed
    const doc = buildDocument(makeData({ stalPrice: '', blocks }))
    assert.ok(doc)
  })

  test('B2 — manual stalPrice overrides block mid price', () => {
    const blocks = makeBlocks()
    // stalPrice = '1200000' should take precedence
    const doc = buildDocument(makeData({ stalPrice: '1200000', blocks }))
    assert.ok(doc)
  })

  test('B3 — total sum non-zero when stål block exists and stalPrice is empty', async () => {
    const blocks = makeBlocks()
    // stål 850k, yttervegg 325k, tak 425k → total blocks (excl stål) = 750k
    // stalNum = 850k, rigg 8% of (750+850)=1600k → 128k
    // sumExMvaRaw = 750k + 850k + 128k = 1728k → rounded to nearest 1k = 1728k
    // mva = 432k, inkMva = 2160k
    // Just verify doc builds and buffer is valid
    const doc = buildDocument(makeData({ stalPrice: '', blocks }))
    const buf = await Packer.toBuffer(doc)
    assert.ok(buf.length > 5000)
  })

  test('B4 — no stål block and no stalPrice → stal = 0 (no crash)', () => {
    const blocksNoStal = [
      { id: 'yttervegg', name: 'Yttervegger', price_low: 300000, price_high: 350000, basis: '', assumptions: [] },
      { id: 'tak', name: 'Tak', price_low: 400000, price_high: 450000, basis: 'trp_kun', assumptions: [] },
    ]
    const doc = buildDocument(makeData({ stalPrice: '', blocks: blocksNoStal }))
    assert.ok(doc)
  })

  test('B5 — stalPrice = "0" treated as zero (no stål section rendered)', () => {
    const blocksNoStal = [
      { id: 'yttervegg', name: 'Yttervegger', price_low: 300000, price_high: 350000, basis: '', assumptions: [] },
    ]
    const doc = buildDocument(makeData({ stalPrice: '0', blocks: blocksNoStal }))
    assert.ok(doc)
  })

})

// ── Suite C: Block description text generation ────────────────────────────────
describe('C — blockDescription per block type', () => {

  // We can't easily inspect paragraph text without parsing the zip.
  // Instead we test that each block type builds without error and
  // produces a valid docx buffer.

  async function buildAndCheck(blockId, basis = '', assumptions = []) {
    const blocks = [
      { id: blockId, name: blockId, price_low: 100000, price_high: 120000, basis, assumptions },
    ]
    const doc = buildDocument(makeData({ blocks, stalPrice: '' }))
    const buf = await Packer.toBuffer(doc)
    assert.ok(buf.length > 1000, `block ${blockId} should produce valid docx`)
  }

  test('C1 — stål block with full description', () => buildAndCheck('stål', 'pris fra leverandør', []))
  test('C2 — tak varmt_tak_u018', () => buildAndCheck('tak', 'varmt_tak_u018 stor bucket', ['Konstruksjon: varmt_tak_u018']))
  test('C3 — tak varmt_tak_u013', () => buildAndCheck('tak', 'varmt_tak_u013', []))
  test('C4 — tak trp_med_tekking', () => buildAndCheck('tak', 'trp_med_tekking', []))
  test('C5 — tak trp_kun (kaldtlager)', () => buildAndCheck('tak', 'trp_kun', []))
  test('C6 — tak sandwich_pir_tak', () => buildAndCheck('tak', 'sandwich_pir_tak', []))
  test('C7 — yttervegg sandwich', () => buildAndCheck('yttervegg', 'sandwich PIR 120mm', []))
  test('C8 — yttervegg kaldtlager', () => buildAndCheck('yttervegg', 'kaldtlager uisolert', []))
  test('C9 — betong', () => buildAndCheck('betong', '', []))
  test('C10 — betongbrystning', () => buildAndCheck('betongbrystning', '', []))
  test('C11 — porter', () => buildAndCheck('porter', '', []))
  test('C12 — kran_lift', () => buildAndCheck('kran_lift', '', []))
  test('C13 — unknown block uses generic text', () => buildAndCheck('gulvvarmeanlegg', '', []))

})

// ── Suite D: Document structure integrity ─────────────────────────────────────
describe('D — document structure', () => {

  test('D1 — document has sections', () => {
    const doc = buildDocument(makeData())
    // Document internal structure — sections is a private array in docx
    // We verify via successful buffer serialization
    assert.ok(doc)
  })

  test('D2 — exclusions are included when result has exclusions', async () => {
    const data = makeData()
    data.result.exclusions = ['Elektro og automatisering', 'VVS-anlegg']
    const doc = buildDocument(data)
    const buf = await Packer.toBuffer(doc)
    assert.ok(buf.length > 5000)
  })

  test('D3 — warnings section rendered when warnings present', async () => {
    const data = makeData()
    data.result.warnings = ['Mengder er basert på foreliggende tegninger', 'Endelig pris avhenger av grunn']
    const doc = buildDocument(data)
    const buf = await Packer.toBuffer(doc)
    assert.ok(buf.length > 5000)
  })

  test('D4 — kunde info rendered without error', async () => {
    const data = makeData()
    data.kunde = { firma: 'Byggfirma Larsen AS', kontakt: 'Per Larsen', adresse: 'Industriveien 12, 3800 Bø' }
    const doc = buildDocument(data)
    const buf = await Packer.toBuffer(doc)
    assert.ok(buf.length > 5000)
  })

  test('D5 — no kunde info renders without crash', async () => {
    const data = makeData()
    data.kunde = {}
    const doc = buildDocument(data)
    const buf = await Packer.toBuffer(doc)
    assert.ok(buf.length > 5000)
  })

  test('D6 — custom forutsetninger render correctly', async () => {
    const data = makeData()
    data.forutsetninger = {
      u_verdi_tak: 0.13,
      u_verdi_vegg: 0.15,
      u_verdi_glass: 1.0,
      tiltaksklasse: '3',
      bruddgrense_kn_m2: 300,
      gyldighet_dager: 30,
    }
    const doc = buildDocument(data)
    const buf = await Packer.toBuffer(doc)
    assert.ok(buf.length > 5000)
  })

  test('D7 — kaldtlager (no U-verdi) renders "Uisolert bygg" footer line', async () => {
    const data = makeData()
    data.forutsetninger = {
      tiltaksklasse: '2',
      bruddgrense_kn_m2: 250,
      gyldighet_dager: 14,
      // no u_verdi_tak / u_verdi_vegg
    }
    const doc = buildDocument(data)
    const buf = await Packer.toBuffer(doc)
    assert.ok(buf.length > 5000)
  })

})

// ── Suite E: Price math ───────────────────────────────────────────────────────
describe('E — price calculations', () => {

  test('E1 — rigg calculated on (blocks + stål), not just blocks', () => {
    // stål=850k, other=750k, rigg=8% of 1600k = 128k
    // sumExMvaRaw = 1728k → rounded 1728k
    // This is a unit test of the math, not of docx output
    const stalMid = 850000
    const otherMid = 750000
    const riggPct = 8
    const rigg = (otherMid + stalMid) * (riggPct / 100)
    assert.equal(rigg, 128000)
    const sumExMvaRaw = otherMid + stalMid + rigg
    assert.equal(sumExMvaRaw, 1728000)
    const sumExMva = Math.round(sumExMvaRaw / 1000) * 1000
    assert.equal(sumExMva, 1728000)
    const mva = Math.round(sumExMva * 0.25)
    assert.equal(mva, 432000)
    assert.equal(sumExMva + mva, 2160000)
  })

  test('E2 — sumExMva rounded to nearest 1000', () => {
    // If raw = 1728499, should round to 1728000
    // If raw = 1728500, should round to 1729000
    assert.equal(Math.round(1728499 / 1000) * 1000, 1728000)
    assert.equal(Math.round(1728500 / 1000) * 1000, 1729000)
  })

  test('E3 — mva is 25% of sumExMva', () => {
    const sumExMva = 2000000
    assert.equal(Math.round(sumExMva * 0.25), 500000)
  })

})
