// Deterministic price calculator — ported from ferro-backend/calculator.js
// Uses hardcoded price table + markup rules (same as backend DB seeds).

const PRICE_TABLE = [
  { supplier: 'Storm',    material: 'sandwich_pir_120_tak',      unit: 'm2',  price_nok: 580 },
  { supplier: 'Storm',    material: 'sandwich_pir_180_tak',      unit: 'm2',  price_nok: 680 },
  { supplier: 'Ruukki',   material: 'trp_tak_galv',              unit: 'm2',  price_nok: 220 },
  { supplier: 'Ruukki',   material: 'trp_tak_lakkert',           unit: 'm2',  price_nok: 265 },
  { supplier: 'Storm',    material: 'sandwich_steinull_150_vegg', unit: 'm2',  price_nok: 650 },
  { supplier: 'Storm',    material: 'sandwich_steinull_200_vegg', unit: 'm2',  price_nok: 720 },
  { supplier: 'Storm',    material: 'sandwich_pir_100_vegg',      unit: 'm2',  price_nok: 590 },
  { supplier: 'Ruukki',   material: 'trapesblikk_vegg',           unit: 'm2',  price_nok: 180 },
  { supplier: 'Storm',    material: 'sandwich_innervegg_80',      unit: 'm2',  price_nok: 420 },
  { supplier: 'Crawford', material: 'foldeport_standard',         unit: 'stk', price_nok: 24000 },
  { supplier: 'Crawford', material: 'ruteport_standard',          unit: 'stk', price_nok: 18000 },
  { supplier: 'Crawford', material: 'seksjonalport',              unit: 'stk', price_nok: 22000 },
  { supplier: 'Crawford', material: 'peis_dor',                   unit: 'stk', price_nok: 4500  },
  { supplier: 'UE',       material: 'kran_dag',                   unit: 'dag', price_nok: 8500  },
  { supplier: 'UE',       material: 'lift_dag',                   unit: 'dag', price_nok: 3200  },
  { supplier: 'UE',       material: 'betong_gulv_100mm',          unit: 'm2',  price_nok: 450   },
  { supplier: 'UE',       material: 'betong_fundament',           unit: 'stk', price_nok: 8500  },
  // Stålkonstruksjon — ramme, søyler, åsar (budsjettpriser per m² BRA)
  { supplier: 'Stål-UE',  material: 'stal_ramme_lager',           unit: 'm2',  price_nok: 680   },
  { supplier: 'Stål-UE',  material: 'stal_ramme_verksted',        unit: 'm2',  price_nok: 780   },
  // Graving — budsjettestim per m²
  { supplier: 'UE',       material: 'graving_m2',                 unit: 'm2',  price_nok: 380   },
]

const MARKUP_RULES = {
  yttervegg:    { labor_nok_per_unit: 85,   markup_pct: 15 },
  innervegg:    { labor_nok_per_unit: 75,   markup_pct: 15 },
  tak:          { labor_nok_per_unit: 70,   markup_pct: 15 },
  kran_lift:    { labor_nok_per_unit: 0,    markup_pct: 12 },
  dorer_vinduer:{ labor_nok_per_unit: 1200, markup_pct: 10 },
  betong:       { labor_nok_per_unit: 0,    markup_pct: 12 },
  graving:      { labor_nok_per_unit: 0,    markup_pct: 10 },
  stål:         { labor_nok_per_unit: 175,  markup_pct: 15 },
  andre:        { labor_nok_per_unit: 0,    markup_pct: 15 },
}

export function calculatePrices(facts) {
  const blocks = []
  const scope = facts.scope_items || []

  if (scope.includes('yttervegg')) {
    const m2   = facts.yttervegg_m2 || estimateWall(facts)
    const rule = MARKUP_RULES.yttervegg
    const mat  = findMat(facts.materialer?.sandwich_type, 'vegg') || findByKey('sandwich_steinull_150_vegg')
    if (mat && rule) {
      const cost = m2 * (mat.price_nok + rule.labor_nok_per_unit)
      const [low, high] = withMarkup(cost, rule.markup_pct, facts.yttervegg_m2 ? 'high' : 'low')
      blocks.push(makeBlock('yttervegg', 'Ytterveggselementer', low, high,
        facts.yttervegg_m2 ? 'høy' : 'lav', rule.markup_pct, m2, mat, rule,
        facts.yttervegg_m2 ? [] : ['yttervegg_m2 estimert fra BRA']))
    }
  }

  if (scope.includes('tak')) {
    const m2   = facts.tak_m2 || estimateTak(facts)
    const rule = MARKUP_RULES.tak
    const mat  = findMat(facts.materialer?.tak_type, 'tak') || findByKey('sandwich_pir_120_tak')
    if (mat && rule) {
      const cost = m2 * (mat.price_nok + rule.labor_nok_per_unit)
      const [low, high] = withMarkup(cost, rule.markup_pct, facts.tak_m2 ? 'high' : 'low')
      blocks.push(makeBlock('tak', 'Takplater og tekking', low, high,
        facts.tak_m2 ? 'høy' : 'lav', rule.markup_pct, m2, mat, rule,
        facts.tak_m2 ? [] : ['tak_m2 estimert fra BRA']))
    }
  }

  if (scope.includes('innervegg') && facts.innervegg_m2) {
    const m2   = facts.innervegg_m2
    const rule = MARKUP_RULES.innervegg
    const mat  = findByKey('sandwich_innervegg_80')
    if (mat && rule) {
      const cost = m2 * (mat.price_nok + rule.labor_nok_per_unit)
      const [low, high] = withMarkup(cost, rule.markup_pct, 'medium')
      blocks.push(makeBlock('innervegg', 'Innervegger', low, high, 'middels', rule.markup_pct, m2, mat, rule, []))
    }
  }

  if (scope.includes('dorer_vinduer')) {
    const rule = MARKUP_RULES.dorer_vinduer
    const ap   = facts.apninger || {}
    const stk  = (ap.foldeporter_stk || 0) + (ap.seksjonalporter_stk || 0) +
                 (ap.ruteporter_stk  || 0) + (ap.persondorer_stk     || 0)
    if (stk > 0 && rule) {
      let cost = 0
      if (ap.foldeporter_stk)    cost += ap.foldeporter_stk    * matPrice('foldeport_standard')
      if (ap.seksjonalporter_stk) cost += ap.seksjonalporter_stk * matPrice('seksjonalport')
      if (ap.ruteporter_stk)     cost += ap.ruteporter_stk     * matPrice('ruteport_standard')
      if (ap.persondorer_stk)    cost += ap.persondorer_stk    * matPrice('peis_dor')
      cost += stk * rule.labor_nok_per_unit
      const [low, high] = withMarkup(cost, rule.markup_pct, 'high')
      blocks.push({ id: 'dorer_vinduer', name: 'Dører og porter', included: true,
        price_low: Math.round(low), price_high: Math.round(high),
        confidence: 'høy', paslag_pct: rule.markup_pct,
        basis: `${stk} stk åpninger. Priser fra prisliste.`,
        assumptions: [`Folder: ${ap.foldeporter_stk||0}, Seksj: ${ap.seksjonalporter_stk||0}, Rute: ${ap.ruteporter_stk||0}, Dør: ${ap.persondorer_stk||0}`],
        missing_info: [] })
    } else if (rule) {
      const bra  = facts.bra_m2 || 300
      const est  = Math.max(2, Math.round(bra / 150))
      const cost = est * 22000 + est * rule.labor_nok_per_unit
      const [low, high] = withMarkup(cost, rule.markup_pct, 'low')
      blocks.push({ id: 'dorer_vinduer', name: 'Dører og porter', included: true,
        price_low: Math.round(low), price_high: Math.round(high),
        confidence: 'lav', paslag_pct: rule.markup_pct,
        basis: `Estimert ${est} stk åpninger basert på BRA ${bra}m²`,
        assumptions: ['Antall åpninger ukjent — estimert'], missing_info: ['Antall og type porter ikke oppgitt'] })
    }
  }

  if (scope.includes('kran_lift')) {
    const rule  = MARKUP_RULES.kran_lift
    const bra   = facts.bra_m2 || 300
    const kd    = Math.max(3, Math.round(bra / 80))
    const ld    = Math.max(5, Math.round(bra / 50))
    const cost  = kd * matPrice('kran_dag') + ld * matPrice('lift_dag')
    const [low, high] = withMarkup(cost, rule.markup_pct, 'medium')
    blocks.push({ id: 'kran_lift', name: 'Kran og lift', included: true,
      price_low: Math.round(low), price_high: Math.round(high),
      confidence: 'middels', paslag_pct: rule.markup_pct,
      basis: `Ca. ${kd} krandag + ${ld} liftdag basert på BRA ${bra}m²`,
      assumptions: [`Kran ${kd}d × ${matPrice('kran_dag')}kr, lift ${ld}d × ${matPrice('lift_dag')}kr`],
      missing_info: [] })
  }

  if (scope.includes('stål')) {
    const rule = MARKUP_RULES.stål
    const bra  = facts.bra_m2 || 300
    const isVerksted = ['verksted','vaskehall'].includes(facts.bygg_type)
    const mat  = findByKey(isVerksted ? 'stal_ramme_verksted' : 'stal_ramme_lager')
    if (mat && rule) {
      const cost = bra * (mat.price_nok + rule.labor_nok_per_unit)
      const [low, high] = withMarkup(cost, rule.markup_pct, facts.bra_m2 ? 'medium' : 'low')
      blocks.push({ id: 'stål', name: 'Stålkonstruksjon (ramme)', included: true,
        price_low: Math.round(low), price_high: Math.round(high),
        confidence: facts.bra_m2 ? 'middels' : 'lav', paslag_pct: rule.markup_pct,
        basis: `${bra}m² BRA × (${mat.price_nok}kr stål + ${rule.labor_nok_per_unit}kr montering) + ${rule.markup_pct}% margin. Budsjettestim ramme+søyler+åsar.`,
        assumptions: [`${bra}m² BRA`, `${mat.material} @ ${mat.price_nok}kr/m²`, 'Budsjettpriser — avhengig av spenn og laster'],
        missing_info: facts.bra_m2 ? [] : ['bra_m2 ukjent — bruker defaultestim 300m²'] })
    }
  }

  if (scope.includes('betong')) {
    const rule = MARKUP_RULES.betong
    const bra  = facts.bra_m2 || 300
    const mat  = findByKey('betong_gulv_100mm')
    if (mat && rule) {
      const cost = bra * mat.price_nok
      const [low, high] = withMarkup(cost, rule.markup_pct, 'medium')
      blocks.push({ id: 'betong', name: 'Betong gulv', included: true,
        price_low: Math.round(low), price_high: Math.round(high),
        confidence: 'middels', paslag_pct: rule.markup_pct,
        basis: `${bra}m² × ${mat.price_nok}kr/m² (100mm armert betong gulv) + ${rule.markup_pct}% margin. UE-pris.`,
        assumptions: [`${bra}m² gulvareal`, `${mat.material} @ ${mat.price_nok}kr/m²`],
        missing_info: [] })
    }
  }

  if (scope.includes('graving')) {
    const rule = MARKUP_RULES.graving
    const bra  = facts.bra_m2 || 300
    const mat  = findByKey('graving_m2')
    if (mat && rule) {
      const cost = bra * mat.price_nok
      const [low, high] = withMarkup(cost, rule.markup_pct, 'low')
      blocks.push({ id: 'graving', name: 'Graving og planering', included: true,
        price_low: Math.round(low), price_high: Math.round(high),
        confidence: 'lav', paslag_pct: rule.markup_pct,
        basis: `${bra}m² × ${mat.price_nok}kr/m² budsjettestim + ${rule.markup_pct}% margin. Svært avhengig av grunnforhold.`,
        assumptions: [`${bra}m² grunnflate`, 'Normalt grunnforhold antatt'],
        missing_info: ['Graving er svært avhengig av grunnforhold — konfirmer med UE'] })
    }
  }

  const totalLow  = blocks.reduce((s, b) => s + b.price_low,  0)
  const totalHigh = blocks.reduce((s, b) => s + b.price_high, 0)
  return { blocks, totalLow, totalHigh }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function makeBlock(id, name, low, high, confidence, paslag_pct, m2, mat, rule, missing) {
  return {
    id, name, included: true,
    price_low: Math.round(low), price_high: Math.round(high),
    confidence, paslag_pct,
    basis: `${m2}m² × (${mat.price_nok}kr materiell + ${rule.labor_nok_per_unit}kr montering) + ${paslag_pct}% margin. Leverandør: ${mat.supplier}.`,
    assumptions: [`${m2}m² areal`, `${mat.material} @ ${mat.price_nok}kr/m²`],
    missing_info: missing,
  }
}

function withMarkup(baseCost, pct, confidence) {
  const factor      = 1 + pct / 100
  const uncertainty = confidence === 'high' ? 0.08 : confidence === 'medium' ? 0.15 : 0.25
  return [baseCost * factor * (1 - uncertainty), baseCost * factor * (1 + uncertainty)]
}

function findMat(hint, context) {
  if (!hint) return null
  const h = hint.toLowerCase()
  if (context === 'vegg') {
    if (h.includes('200')) return findByKey('sandwich_steinull_200_vegg')
    if (h.includes('steinull')) return findByKey('sandwich_steinull_150_vegg')
    if (h.includes('pir'))     return findByKey('sandwich_pir_100_vegg')
  }
  if (context === 'tak') {
    if (h.includes('180'))    return findByKey('sandwich_pir_180_tak')
    if (h.includes('pir'))    return findByKey('sandwich_pir_120_tak')
    if (h.includes('trp'))    return findByKey('trp_tak_galv')
  }
  return findByKey(hint)
}

function findByKey(material) {
  return PRICE_TABLE.find(p => p.material === material) || null
}

function matPrice(material) {
  return findByKey(material)?.price_nok || 0
}

function estimateWall(facts) {
  const bra = facts.bra_m2
  if (!bra) return 300
  const side = Math.sqrt(bra)
  return Math.round(4 * side * 4.5)
}

function estimateTak(facts) {
  return Math.round((facts.bra_m2 || 300) * 1.1)
}
