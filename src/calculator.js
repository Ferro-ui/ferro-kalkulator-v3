// History-calibrated price calculator for Ferro Stålentreprenør AS.
// Uses real unit rates from historiske_prosjekter.json instead of hardcoded prices.
//
// Architecture:
//   1. extractUnitRates(history)  — compute kr/m² per block from real projects
//   2. findSimilarProjects(facts, history) — find 2–4 closest references
//   3. calibrateRate(block, similar, fallback) — weighted median from similar projects
//   4. calculatePrices(facts, history) — main export

// ── Fallback rates (updated to match real 2024–2026 Ferro project medians) ────
// These are used only when no historical projects match (no history passed).
const FALLBACK_RATES = {
  // kr per m² BRA — from 19 real Ferro projects, median
  stal_per_bra:        2050,
  // kr per m² fasade (yttervegg)
  yttervegg_per_m2:    1470,
  // kr per m² tak
  tak_per_m2:          1510,
  // kr per m² BRA (innervegg extrapolated from projects with innervegg)
  innervegg_per_m2:     680,
  // kr per m² BRA
  kran_lift_per_bra:    440,
  // kr per m² gulv
  betong_per_m2:        650,
  // kr per m² — graving varies enormously; set high default + wide uncertainty
  graving_per_m2:       520,
  // door/gate rates per unit
  foldeport_per_stk:  95000,
  seksjonalport_per_stk: 62000,
  ruteport_per_stk:   52000,
  persondor_per_stk:  14000,
}

// ── Extract unit rates from a history entry ───────────────────────────────────
function unitRatesFromEntry(entry) {
  const p = entry.priser_til_kunde || {}
  const b = entry.bygg || {}
  const bra     = b.bra_m2 || null
  const fasade  = b.fasade_m2 || null
  const tak_m2  = b.tak_m2 || null

  return {
    navn:               entry.navn,
    bygg_type:          b.type || '',
    bra_m2:             bra,
    fasade_m2:          fasade,
    tak_m2:             tak_m2,
    lokasjon:           b.lokasjon || '',
    stal_per_bra:       bra && p.stal   ? Math.round(p.stal   / bra)   : null,
    yttervegg_per_m2:   fasade && p.yttervegg ? Math.round(p.yttervegg / fasade) : null,
    tak_per_m2:         tak_m2 && p.tak ? Math.round(p.tak  / tak_m2)  : null,
    kran_lift_per_bra:  bra && p.kran_lift ? Math.round(p.kran_lift / bra) : null,
    innervegg_per_m2:   (b.innervegg_m2 || fasade) && p.innervegg
                          ? Math.round(p.innervegg / (b.innervegg_m2 || fasade * 0.3))
                          : null,
    betong_per_m2:      bra && p.betong ? Math.round(p.betong / bra)   : null,
    graving_per_m2:     bra && p.graving ? Math.round(p.graving / bra) : null,
  }
}

// ── Find 2–5 most similar projects by building type and size ─────────────────
export function findSimilarProjects(facts, history) {
  if (!history?.length) return []
  const bra        = facts.bra_m2 || 300
  const typeTarget = (facts.bygg_type || '').toLowerCase()

  const TYPE_FAMILY = {
    lager: ['lager', 'lagerbygg', 'logistikk', 'hall'],
    vaskehall: ['vaskehall', 'vask', 'buss', 'garasje'],
    verksted: ['verksted', 'service', 'mekanisk'],
    butikk: ['butikk', 'handel', 'forretning'],
    klubbhus: ['klubbhus', 'garderobe', 'sports'],
  }
  const family = Object.entries(TYPE_FAMILY).find(([, words]) =>
    words.some(w => typeTarget.includes(w))
  )?.[0] || 'other'

  const scored = history.map(entry => {
    const b    = entry.bygg || {}
    const eBra = b.bra_m2 || 300
    const eType = (b.type || '').toLowerCase()

    // Type match score 0–30
    const typeWords = TYPE_FAMILY[family] || []
    const typeScore = typeWords.some(w => eType.includes(w)) ? 30 : 0

    // Size proximity score 0–40 (smaller delta = higher score)
    const sizeRatio = bra > eBra ? eBra / bra : bra / eBra
    const sizeScore = Math.round(sizeRatio * 40)

    // Has useful pricing data 0–30
    const p = entry.priser_til_kunde || {}
    const dataScore = [p.stal, p.yttervegg, p.tak].filter(Boolean).length * 10

    return { entry, score: typeScore + sizeScore + dataScore }
  })

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .filter(x => x.score > 0)
    .map(x => ({ ...unitRatesFromEntry(x.entry), score: x.score }))
}

// ── Weighted median of valid rates from similar projects ──────────────────────
function calibrateRate(rateKey, similar, fallback) {
  const vals = similar
    .map(s => ({ v: s[rateKey], w: s.score }))
    .filter(x => x.v != null && x.v > 0)

  if (!vals.length) return { rate: fallback, refs: [], source: 'fallback' }

  // Weighted average
  const sumW   = vals.reduce((s, x) => s + x.w, 0)
  const wavg   = vals.reduce((s, x) => s + x.v * x.w, 0) / sumW
  const refs   = similar.filter(s => s[rateKey] != null && s[rateKey] > 0).map(s => s.navn)

  return { rate: Math.round(wavg), refs, source: 'history' }
}

// ── Uncertainty factor based on data confidence ───────────────────────────────
// Returns [low_factor, high_factor] around the estimated price
function uncertainty(confidence) {
  // confidence: 'high' = known m² from drawings, 'medium' = estimated, 'low' = pure guess
  if (confidence === 'high')   return [0.90, 1.10]   // ±10%
  if (confidence === 'medium') return [0.82, 1.18]   // ±18%
  return                               [0.70, 1.30]  // ±30%
}

// ── Build a price block ───────────────────────────────────────────────────────
function makeBlock(id, name, baseCost, confidence, paslag_pct, basisText, assumptions, missing) {
  const [lo, hi] = uncertainty(confidence)
  const factor   = 1 + paslag_pct / 100
  const price_low  = Math.round(baseCost * factor * lo)
  const price_high = Math.round(baseCost * factor * hi)
  return {
    id, name, included: true,
    price_low, price_high,
    confidence: confidence === 'high' ? 'høy' : confidence === 'medium' ? 'middels' : 'lav',
    paslag_pct,
    basis: basisText,
    assumptions,
    missing_info: missing,
  }
}

// ── Main export ───────────────────────────────────────────────────────────────
export function calculatePrices(facts, history) {
  const blocks = []
  const scope  = facts.scope_items || []
  const similar = findSimilarProjects(facts, history || [])
  const refNames = similar.slice(0, 3).map(s => s.navn).filter(Boolean)
  const refNote  = refNames.length
    ? `Kalibrert mot: ${refNames.join(', ')}.`
    : 'Ingen historiske referanser — bruker fallback-satser.'

  // ── STÅL ──────────────────────────────────────────────────────────────────
  if (scope.includes('stål')) {
    const bra      = facts.bra_m2 || 300
    const { rate, refs, source } = calibrateRate('stal_per_bra', similar, FALLBACK_RATES.stal_per_bra)
    const conf     = facts.bra_m2 ? 'medium' : 'low'
    const paslag   = 15
    // Stål innkjøp includes material + montasje (Ferro adds markup on top of supplier price)
    const innkjop  = Math.round(bra * rate / (1 + paslag / 100))
    const refsStr  = refs.length ? `Referanser: ${refs.slice(0,3).join(', ')}.` : refNote
    blocks.push(makeBlock(
      'stål', 'Stålkonstruksjon (ramme, søyler, åsar)',
      bra * rate / (1 + paslag / 100),
      conf, paslag,
      `${bra} m² BRA × ${rate} kr/m² = innkjøp ca. ${innkjop.toLocaleString('nb-NO')} kr. ${refsStr} ` +
      `NB: stål-pris inkluderer leverandørens montasjepris. Salgspris til kunde inkl. ${paslag}% Ferro-margin.`,
      [
        `${bra} m² BRA brukt som grunnlag`,
        `Rate ${rate} kr/m² (${source === 'history' ? 'historisk kalibr.' : 'fallback-sats'})`,
        'Ferro kjøper komplettstål inkl. prosjektering og frakt',
        'Montasje er inkludert i tilbud fra stålleverandør',
      ],
      facts.bra_m2 ? [] : ['bra_m2 ikke funnet — bruker 300 m² som estimat']
    ))
  }

  // ── YTTERVEGG ─────────────────────────────────────────────────────────────
  if (scope.includes('yttervegg')) {
    const m2       = facts.yttervegg_m2 || estimateWall(facts)
    const hasM2    = !!facts.yttervegg_m2
    const { rate, refs, source } = calibrateRate('yttervegg_per_m2', similar, FALLBACK_RATES.yttervegg_per_m2)
    const conf     = hasM2 ? 'high' : 'low'
    const paslag   = 15
    const sandwichType = facts.materialer?.sandwich_type || 'ukjent sandwich'
    const refsStr  = refs.length ? `Referanser: ${refs.slice(0,3).join(', ')}.` : refNote
    blocks.push(makeBlock(
      'yttervegg', 'Ytterveggselementer (sandwich)',
      m2 * rate / (1 + paslag / 100),
      conf, paslag,
      `${m2} m² fasade × ${rate} kr/m² salgspris (inkl. montasje). ` +
      `Type: ${sandwichType}. ${refsStr}`,
      [
        `${m2} m² yttervegg (${hasM2 ? 'fra tegning' : 'estimert fra BRA'})`,
        `Rate ${rate} kr/m² (${source === 'history' ? 'historisk kalibr.' : 'fallback'})`,
        `Sandwich-type: ${sandwichType}`,
        'Pris inkluderer materiell + Ferro-montasje',
      ],
      hasM2 ? [] : ['yttervegg_m2 ikke i tegning — estimert fra grunnflate og antatt h=5m']
    ))
  }

  // ── TAK ───────────────────────────────────────────────────────────────────
  if (scope.includes('tak')) {
    const m2       = facts.tak_m2 || estimateTak(facts)
    const hasM2    = !!facts.tak_m2
    const { rate, refs, source } = calibrateRate('tak_per_m2', similar, FALLBACK_RATES.tak_per_m2)
    const conf     = hasM2 ? 'high' : 'low'
    const paslag   = 15
    const takType  = facts.materialer?.tak_type || 'ukjent tak'
    const refsStr  = refs.length ? `Referanser: ${refs.slice(0,3).join(', ')}.` : refNote
    blocks.push(makeBlock(
      'tak', 'Takplater og tekking',
      m2 * rate / (1 + paslag / 100),
      conf, paslag,
      `${m2} m² tak × ${rate} kr/m² salgspris (materiell + montasje). ` +
      `Type: ${takType}. ${refsStr}`,
      [
        `${m2} m² takareal (${hasM2 ? 'fra tegning' : 'estimert BRA × 1.10'})`,
        `Rate ${rate} kr/m² (${source === 'history' ? 'historisk kalibr.' : 'fallback'})`,
        `Tak-type: ${takType}`,
      ],
      hasM2 ? [] : ['tak_m2 ikke fra tegning — estimert fra grunnflate']
    ))
  }

  // ── INNERVEGG ─────────────────────────────────────────────────────────────
  if (scope.includes('innervegg') && facts.innervegg_m2) {
    const m2       = facts.innervegg_m2
    const { rate, refs, source } = calibrateRate('innervegg_per_m2', similar, FALLBACK_RATES.innervegg_per_m2)
    const paslag   = 15
    const refsStr  = refs.length ? `Ref: ${refs.slice(0,2).join(', ')}.` : refNote
    blocks.push(makeBlock(
      'innervegg', 'Innervegger (sandwich)',
      m2 * rate / (1 + paslag / 100),
      'medium', paslag,
      `${m2} m² innervegger × ${rate} kr/m². ${refsStr}`,
      [`${m2} m² innervegg fra tegning`, `Rate ${rate} kr/m² (${source})`],
      []
    ))
  }

  // ── KRAN OG LIFT ──────────────────────────────────────────────────────────
  if (scope.includes('kran_lift')) {
    const bra      = facts.bra_m2 || 300
    const { rate, refs, source } = calibrateRate('kran_lift_per_bra', similar, FALLBACK_RATES.kran_lift_per_bra)
    const paslag   = 12
    const refsStr  = refs.length ? `Ref: ${refs.slice(0,3).join(', ')}.` : refNote
    blocks.push(makeBlock(
      'kran_lift', 'Kran og lift',
      bra * rate / (1 + paslag / 100),
      'medium', paslag,
      `${bra} m² BRA × ${rate} kr/m² (historisk snitt kran+lift per m²). ${refsStr}`,
      [`${bra} m² BRA`, `Rate ${rate} kr/m² (${source})`, 'Inkluderer mobilkran + arbeidslift for hele byggemontasje'],
      []
    ))
  }

  // ── DØRER OG PORTER ───────────────────────────────────────────────────────
  if (scope.includes('dorer_vinduer')) {
    const paslag = 10
    const ap     = facts.apninger || {}
    const fp  = ap.foldeporter_stk    || 0
    const sp  = ap.seksjonalporter_stk || 0
    const rp  = ap.ruteporter_stk     || 0
    const dp  = ap.persondorer_stk    || 0
    const totalStk = fp + sp + rp + dp

    if (totalStk > 0) {
      const cost = fp * FALLBACK_RATES.foldeport_per_stk
                 + sp * FALLBACK_RATES.seksjonalport_per_stk
                 + rp * FALLBACK_RATES.ruteport_per_stk
                 + dp * FALLBACK_RATES.persondor_per_stk
      const innkjop = Math.round(cost / (1 + paslag / 100))
      blocks.push(makeBlock(
        'dorer_vinduer', 'Dører og porter',
        innkjop, 'high', paslag,
        `${totalStk} stk åpninger: fold ${fp}, seksj ${sp}, rute ${rp}, dør ${dp}. ` +
        `Innkjøpspris Crawford/Hörmann budsjett.`,
        [
          `Foldeport ${fp} × ${FALLBACK_RATES.foldeport_per_stk.toLocaleString('nb-NO')} kr`,
          `Seksjonalport ${sp} × ${FALLBACK_RATES.seksjonalport_per_stk.toLocaleString('nb-NO')} kr`,
          `Ruteport ${rp} × ${FALLBACK_RATES.ruteport_per_stk.toLocaleString('nb-NO')} kr`,
          `Persondør ${dp} × ${FALLBACK_RATES.persondor_per_stk.toLocaleString('nb-NO')} kr`,
        ],
        []
      ))
    } else {
      // Estimate from building size
      const bra = facts.bra_m2 || 300
      const est = Math.max(2, Math.round(bra / 120))
      const cost = est * FALLBACK_RATES.seksjonalport_per_stk
      blocks.push(makeBlock(
        'dorer_vinduer', 'Dører og porter',
        Math.round(cost / (1 + paslag / 100)),
        'low', paslag,
        `Antall porter ukjent — estimert ${est} stk basert på ${bra} m² BRA.`,
        [`Estimert ${est} seksjonalporter`, 'Antall og type ikke oppgitt i dokumenter'],
        ['Antall og type porter ukjent — spesifiser for bedre estimat']
      ))
    }
  }

  // ── BETONG ────────────────────────────────────────────────────────────────
  if (scope.includes('betong')) {
    const bra  = facts.bra_m2 || 300
    const { rate, refs, source } = calibrateRate('betong_per_m2', similar, FALLBACK_RATES.betong_per_m2)
    const paslag = 12
    const refsStr = refs.length ? `Ref: ${refs.slice(0,2).join(', ')}.` : refNote
    blocks.push(makeBlock(
      'betong', 'Betong gulv (UE)',
      bra * rate / (1 + paslag / 100),
      'medium', paslag,
      `${bra} m² × ${rate} kr/m² (100 mm armert betong gulv, UE-pris). ${refsStr}`,
      [`${bra} m² gulvareal`, `Rate ${rate} kr/m² (${source})`, 'UE-pris inkl. armering og stålglatting'],
      []
    ))
  }

  // ── GRAVING ───────────────────────────────────────────────────────────────
  if (scope.includes('graving')) {
    const bra  = facts.bra_m2 || 300
    const { rate, refs, source } = calibrateRate('graving_per_m2', similar, FALLBACK_RATES.graving_per_m2)
    const paslag = 10
    const refsStr = refs.length ? `Ref: ${refs.slice(0,2).join(', ')}.` : refNote
    blocks.push(makeBlock(
      'graving', 'Graving og planering (UE)',
      bra * rate / (1 + paslag / 100),
      'low', paslag,
      `${bra} m² × ${rate} kr/m² budsjettestim. ${refsStr} VIKTIG: graving avhenger svært av grunnforhold.`,
      [`${bra} m² grunnflate`, `Rate ${rate} kr/m² (${source})`, 'Normalt grunnforhold antatt'],
      ['Graving varierer enormt med grunnforhold — innhent UE-tilbud for presist estimat']
    ))
  }

  const totalLow  = blocks.reduce((s, b) => s + b.price_low,  0)
  const totalHigh = blocks.reduce((s, b) => s + b.price_high, 0)
  return { blocks, totalLow, totalHigh }
}

// ── Geometry helpers ──────────────────────────────────────────────────────────
function estimateWall(facts) {
  const bra = facts.bra_m2
  if (!bra) return 200
  // Assume roughly square building, gesimshøyde 5m
  const side = Math.sqrt(bra)
  return Math.round(4 * side * 5.0)
}

function estimateTak(facts) {
  const type = (facts.bygg_type || '').toLowerCase()
  // Sadeltak adds ~12% to footprint; flat/pulttak adds ~3%
  const factor = type.includes('lager') ? 1.05 : 1.10
  return Math.round((facts.bra_m2 || 300) * factor)
}
