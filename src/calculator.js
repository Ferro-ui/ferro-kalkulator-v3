// History-calibrated price calculator for Ferro Stålentreprenør AS.
// Uses real unit rates from historiske_prosjekter.json instead of hardcoded prices.
//
// Architecture:
//   1. extractUnitRates(history)  — compute kr/m² per block from real projects
//   2. findSimilarProjects(facts, history) — find 2–4 closest references
//   3. calibrateRate(block, similar, fallback) — weighted median from similar projects
//   4. calculatePrices(facts, history) — main export

// Brannkrav cost adjustment comes from the AI's own analysis (facts.brannkrav.kostnadspaslag_pct).
// No hardcoded lookup table — the AI reads the actual brannkonsept document and decides.

// ── Fallback rates (updated to match real 2024–2026 Ferro project medians) ────
// These are used only when no historical projects match (no history passed).
const FALLBACK_RATES = {
  // kr per m² BRA — from 19 real Ferro projects, median (heated/insulated buildings)
  stal_per_bra:           2050,
  // kr per m² BRA — kaldtlager (unheated, uninsulated): bare steel frame only
  // Real data: Kaldtlager Rauland 1203 kr/m², Rugtvedt 955 kr/m² → median ~1100
  kaldtlager_stal_per_bra: 1100,
  // kr per m² fasade (yttervegg)
  yttervegg_per_m2:       1470,
  // kr per m² tak (legacy fallback — brukes når tak_konstruksjon_type ikke er gitt)
  tak_per_m2:             1510,
  // Type-baserte rater per storleiks-bucket. Bygd fra Uni Tak tilbud-analyse:
  //   trp_kun: kaldtlager, ingen tekking — bare TRP plater
  //   trp_med_tekking: vaskehall/lett bygg — TRP + asfalt membran (ingen tjukk isolasjon)
  //   varmt_tak_u018: standard isolert (120mm + EPS ~100mm + 2× topplate)
  //   varmt_tak_u013: bedre isolert (180mm + EPS ~165mm + 2× topplate, ~+18%)
  //   sandwich_pir_tak: PIR sandwichpaneler tak (alt-i-ett)
  // Storleiks-bucket: liten<100m², mid 100-300m², stor>300m² — pga faste rigg/stillas/transport
  tak_rates: {
    // trp_kun = bare TRP plates only, NO taktekking — kaldtlager/uisolert only
    // Data: Rugtvedt 407 kr/m², Star Bilskade 573 kr/m², Kaldtlager Rauland 745 kr/m²
    trp_kun:           { liten:  750, mid:  650, stor:  600 },
    // trp_med_tekking = TRP + asfalt/membrane waterproofing — vaskehall/butikk/standard
    // Data: Glitra 2011, Geithus 1709, Nybruveien 1765 (mid) | Finstadjordet 1681, 2008 (stor)
    trp_med_tekking:   { liten: 2200, mid: 1750, stor: 1650 },
    // varmt_tak_u018 = TRP + EPS ~100-120mm + mineralull + taktekking, U=0.18
    // Data: Ringsevja 1045 (mid), Lagerbygg Steinsholt 1781 (mid), Valle 910+1512 (stor avg 1211),
    //        Coop Lunde 460 (stor, large building scale), Bussgarasje 1470 (stor)
    varmt_tak_u018:    { liten: 1600, mid: 1300, stor:  950 },
    // varmt_tak_u013 = TRP + EPS ~165-180mm + mineralull + taktekking, U=0.13
    // Data: Coop Extra Kløfta 2554 kr/m² (mid-stor)
    varmt_tak_u013:    { liten: 2800, mid: 2500, stor: 1800 },
    // sandwich_pir_tak = PIR sandwich panels tak, all-in-one
    // Data: Plantørke 1227 kr/m² (stor)
    sandwich_pir_tak:  { liten: 1800, mid: 1500, stor: 1250 },
  },
  // kr per m² BRA (innervegg extrapolated from projects with innervegg)
  innervegg_per_m2:        680,
  // kran_lift: fixed budget by building height category — NOT per BRA (too variable)
  // lav = gesimshøyde ≤5m, mid = 5–9m, høy = >9m
  kran_lift_lav:         120000,
  kran_lift_mid:         220000,
  kran_lift_høy:         380000,
  // kr per m² gulv
  betong_per_m2:           650,
  // kr per m² — graving varies enormously; set high default + wide uncertainty
  graving_per_m2:          520,
  // door/gate rates per unit
  foldeport_per_stk:      95000,
  seksjonalport_per_stk:  62000,
  ruteport_per_stk:       52000,
  persondor_per_stk:      14000,
}

// Size-correction factor for stål: small buildings have higher kr/m² due to fixed costs
// Real data: 74m²=4168, 96m²=3882, 171m²=2051, 204m²=2059, 270m²=2034
function stalSizeFactor(bra) {
  if (bra < 100) return 1.90  // tiny building — fixed mobilkran/fundament costs dominate
  if (bra < 150) return 1.40
  if (bra < 220) return 1.10
  return 1.00
}

// Tak-rate basert på konstruksjonstype + storleik (mer presist enn historie-kalibrering aleine)
// Returnerer kr/m² inkl. materiell + montasje + rigg/stillas/transport (Uni Tak struktur)
function takRateByType(tak_konstruksjon_type, m2) {
  const bucket = m2 < 100 ? 'liten' : m2 <= 300 ? 'mid' : 'stor'
  const rates  = FALLBACK_RATES.tak_rates[tak_konstruksjon_type]
  if (!rates) return null  // ukjent type — fall back til kalibrert rate
  return { rate: rates[bucket], bucket }
}

// kran_lift budget based on takhøyde category (much more predictive than BRA)
function kranBudget(takhøyde_kategori) {
  if (takhøyde_kategori === 'høy') return FALLBACK_RATES.kran_lift_høy
  if (takhøyde_kategori === 'mid') return FALLBACK_RATES.kran_lift_mid
  return FALLBACK_RATES.kran_lift_lav
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
    kaldtlager: ['kaldtlager', 'kald lager', 'uisolert', 'strølager', 'saltlager', 'sandlager', 'plantørke'],
    lager: ['lager', 'lagerbygg', 'logistikk', 'hall', 'båtopplag', 'båthall'],
    vaskehall: ['vaskehall', 'vask', 'buss', 'garasje'],
    verksted: ['verksted', 'service', 'mekanisk', 'bilskade'],
    butikk: ['butikk', 'handel', 'forretning', 'dagligvare', 'coop', 'extra'],
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
    const bra        = facts.bra_m2 || 300
    const isKald     = facts.kaldtlager === true
    const fallbackRate = isKald ? FALLBACK_RATES.kaldtlager_stal_per_bra : FALLBACK_RATES.stal_per_bra
    const rateKey    = isKald ? 'kaldtlager_stal_per_bra' : 'stal_per_bra'
    // For kaldtlager use the kaldtlager-specific calibration; for normal buildings use stal_per_bra
    const { rate: baseRate, refs, source } = isKald
      ? calibrateRate('stal_per_bra', similar.filter(s => s.bygg_type?.toLowerCase().includes('kald') || s.stal_per_bra < 1400), fallbackRate)
      : calibrateRate('stal_per_bra', similar, FALLBACK_RATES.stal_per_bra)

    // Size correction: small buildings cost significantly more per m² due to fixed mobilkran/fundament costs
    const sizeFactor  = stalSizeFactor(bra)
    const rate        = Math.round(baseRate * sizeFactor)
    const conf        = facts.bra_m2 ? 'medium' : 'low'
    const paslag      = 15

    // Brannkrav adjustment: AI-provided percentage (0–50), not a lookup table.
    const brann       = facts.brannkrav || {}
    const brannPct    = brann.kostnadspaslag_pct ?? 0
    const adjRate     = Math.round(rate * (1 + brannPct / 100))
    const innkjop     = Math.round(bra * adjRate / (1 + paslag / 100))
    const refsStr     = refs.length ? `Referanser: ${refs.slice(0,3).join(', ')}.` : refNote

    const brannNote = brannPct > 0
      ? `Brannkrav (${brann.stal_brannkrav || '?'}): +${brannPct}% tillegg → ${rate} → ${adjRate} kr/m². ${brann.kommentar || ''}`
      : brann.kommentar || 'Ingen brannisolasjon påkrevd.'

    const sizeNote = sizeFactor > 1.0
      ? `Størrelseskorreksjon ×${sizeFactor} (lite bygg — faste kostnader fordelt på få m²).`
      : ''

    blocks.push(makeBlock(
      'stål', 'Stålkonstruksjon (ramme, søyler, åsar)',
      bra * adjRate / (1 + paslag / 100),
      conf, paslag,
      `${bra} m² BRA × ${adjRate} kr/m² = innkjøp ca. ${innkjop.toLocaleString('nb-NO')} kr. ` +
      `${sizeNote} ${brannNote} ${refsStr}`.trim(),
      [
        `${bra} m² BRA`,
        isKald ? 'Kaldtlager: uisolert ramme, lavere stålmengde' : 'Varmtlager/bygg: isolert konstruksjon',
        `Basisrate ${baseRate} kr/m² (${source === 'history' ? 'historisk kalibr.' : 'fallback'})`,
        sizeFactor > 1.0 ? `Størrelseskorreksjon ×${sizeFactor} → ${rate} kr/m²` : `Rate ${rate} kr/m²`,
        brannPct > 0 ? `Branntillegg +${brannPct}% (AI-vurdert fra brannkonsept)` : 'Ingen brannisolasjon',
        `Kilde: ${brann.kilde || 'ikke oppgitt'}`,
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
    const takKonstr = facts.tak_konstruksjon_type || null
    const typeRate = takKonstr ? takRateByType(takKonstr, m2) : null
    // Prioritet: 1) type-rate hvis AI klassifiserte tak, 2) historisk kalibr., 3) fallback
    let rate, refs = [], source, basis
    if (typeRate) {
      rate   = typeRate.rate
      source = 'type-bucket'
      basis  = `Konstruksjonstype: ${takKonstr} (${typeRate.bucket} bucket)`
    } else {
      const cal = calibrateRate('tak_per_m2', similar, FALLBACK_RATES.tak_per_m2)
      rate   = cal.rate
      refs   = cal.refs
      source = cal.source
      basis  = `Type ukjent — historisk kalibr.`
    }
    const conf     = hasM2 && typeRate ? 'high' : hasM2 ? 'medium' : 'low'
    const paslag   = 15
    const takType  = facts.materialer?.tak_type || 'ukjent tak'
    const refsStr  = refs.length ? `Referanser: ${refs.slice(0,3).join(', ')}.` : refNote
    blocks.push(makeBlock(
      'tak', 'Takplater og tekking',
      m2 * rate / (1 + paslag / 100),
      conf, paslag,
      `${m2} m² tak × ${rate} kr/m² salgspris (materiell + montasje + rigg/stillas/transport). ` +
      `${basis}. ${typeRate ? '' : refsStr}`,
      [
        `${m2} m² takareal (${hasM2 ? 'fra tegning' : 'estimert BRA × 1.10'})`,
        `Rate ${rate} kr/m² (${source})`,
        `Tak-materialer: ${takType}`,
        takKonstr ? `Konstruksjon: ${takKonstr}` : 'Konstruksjonstype ikke klassifisert',
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
  // kran_lift depends on building HEIGHT and SPAN, not BRA — per-m² calibration was ±60-170% off.
  // Use takhøyde_kategori from AI: lav (≤5m gesims), mid (5–9m), høy (>9m).
  if (scope.includes('kran_lift')) {
    const kat     = facts.takhøyde_kategori || 'mid'
    const budget  = kranBudget(kat)
    const paslag  = 12
    const katLabel = { lav: '≤5m gesims', mid: '5–9m gesims', høy: '>9m gesims' }[kat] || kat
    blocks.push(makeBlock(
      'kran_lift', 'Kran og lift',
      Math.round(budget / (1 + paslag / 100)),
      'medium', paslag,
      `Mobilkran + arbeidslift budsjett for ${katLabel}. Kategori: ${kat}.`,
      [
        `Takhøydekategori: ${kat} (${katLabel})`,
        `Budsjett: ${budget.toLocaleString('nb-NO')} kr (mobilkran + lift hele montasje)`,
        'Kran-kostnad avhenger av høyde og spennvidde — ikke BRA',
      ],
      kat === 'mid' && !facts.takhøyde_kategori
        ? ['takhøyde_kategori ikke oppgitt — bruker "mid" (5–9m) som standard']
        : []
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
