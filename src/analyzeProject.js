// Routes project files to the Ferro backend for analysis.
// When VITE_BACKEND_URL is not set, calls Claude directly from the browser
// and runs the deterministic price calculator client-side.

import Anthropic from '@anthropic-ai/sdk'
import * as XLSX from 'xlsx'
import { calculatePrices } from './calculator.js'

const BASE_URL = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '')

const EXTRACTION_PROMPT = `Du er en erfaren kalkulatør og ingeniør hos Ferro Stålentreprenør AS.
Du har 20 års erfaring med å lese byggetegninger og kalkulere stålbygg.
Du tenker som en ingeniør — du regner, ikke gjetter.

═══════════════════════════════════════════════════════
OPPGAVE: Les ALLE vedlagte dokumenter systematisk.
Ekstraher dimensjoner og fakta. BEREGN arealer fra mål.
Returner KUN JSON — ingen forklarende tekst rundt.
═══════════════════════════════════════════════════════

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEG 1 — LES TEGNINGSTYPER
Tegninger kommer fra ULIKE arkitekter og har ULIK stil.
Se etter disse elementene uansett tegningsstil:

PLANTEGNING (plan/floor plan):
  • Byggets ytre mål — lengde og bredde
  • Aksebetegnelser (A-B-C eller 1-2-3) og cc-mål mellom aksene
  • Romdisponering — hva er lager, kontor, garasje, vaskehall
  • Porter/dører og deres plassering

FASADETEGNING (elevation/fasade Nord/Sør/Øst/Vest):
  • Gesimshøyde = høyde til takfot (det er vegghoiden du trenger)
  • Mønsthøyde = høyde til takmøne (for sadeltak)
  • Vindu- og portåpninger med mål
  • Takfall og taktype (pulttak, sadeltak, flatt)

SNITT (section/tverrsnitt):
  • Bekrefter gesimshøyde og mønsthøyde
  • Viser konstruksjonsoppbygging (fundament, søyle, tak)
  • Isolasjonstype og tykkelse

STYKKLISTE / MATERIALSPESIFIKASJON:
  • Sandwich-type: f.eks. "PIR 120mm", "Steinull 200mm RW", "Steinull 150mm"
  • Taktype: "PIR SP2E 180mm", "TRP galvanisert", "Trapesblokk"
  • Takstol/åstype

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEG 2 — BEREGN DIMENSJONER (ALLTID VIS REGNESTYKKET)

VIKTIG: Mål i tegninger kan være i MM eller M — sjekk skala/tittelblokk.
Typisk: mm hvis tall er 5000, 6000, 12000. Meter hvis 5.0, 6.0, 12.0.

Lengde/bredde fra aksemål:
  Eksempel: 6 spenn × 5 000 mm = 30 000 mm = 30.0 m
  Eksempel: akse A–G = 6 felt × 4 500 mm = 27.0 m

BRA (bruksareal / grunnflate):
  bra_m2 = lengde_m × bredde_m
  Eksempel: 30.0 × 15.0 = 450 m²

YTTERVEGG-AREAL:
  yttervegg_m2 = 2 × (lengde_m + bredde_m) × gesimshøyde_m
  Eksempel: 2 × (30 + 15) × 5.0 = 450 m²
  Trekk fra store portåpninger > 3m² (en foldeport 4×4 = 16 m²)

TAK-AREAL:
  Pulttak / flatt tak: tak_m2 = lengde × bredde × 1.03
  Sadeltak lav vinkel (<15°): tak_m2 = lengde × bredde × 1.08
  Sadeltak normal (15-30°): tak_m2 = lengde × bredde × 1.15
  Eksempel sadeltak: 30 × 15 × 1.08 = 486 m²

PORTER OG DØRER — tell fra plantegning og fasadetegning:
  Foldeport: stor åpning (3–5m bred, 3–5m høy) — typisk for vaskehall, lager
  Seksjonalport: standard garasjeport (2.5–4m bred, 2.5–4m høy)
  Ruteport: liten port med vindu
  Persondør: standard 0.9m × 2.1m

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEG 3 — BRANNKRAV OG KONSEPT (kritisk for kostnad)

BRANNKRAV OG MATERIALVALG — tenk som en bygningsingeniør, ikke som en regelbok.

Les først alle dokumentene. Finn hva som faktisk er skrevet om brann:
  • Tittelblokk: "Risikoklasse X, Brannklasse Y" — dette er det formelle grunnlaget
  • Brannkonsept-PDF: viser hvilke bygningsdeler som trenger hva (R-krav per element)
  • Stykkliste / materialliste: viser hva som faktisk er valgt (PIR, Steinull, Conlitt)
  • Tegningsnotes: "søyler brannisolert R30", "stål males RAL 7000 P1" (= primert = ingen/R15)
  • RIBr nevnt = brannrådgiver engasjert = R30+ prosjekt nesten alltid

NÅR DU HAR LEST DOKUMENTENE — vurder som en erfaren Ferro-kalkulator:

  Hva betyr brannkravet KONKRET for stål-leveransen?
  ─────────────────────────────────────────────────
  Ingen / R15: Stål males eller primeres, ingen isolasjonsmatte. Kaldtlager, RKL 1
               smått bygg. Billigste alternativ — ingen tillegg.

  R30 på søyler/bjelker: Brannisolasjon (f.eks. Isover FireProtect / Conlitt spray)
               på primærstål. Vanligst på lager >1000m², vaskehall, verksted.
               Avhengig av antall søyler og profil — kan være 8–18% av stålpris.

  R60+:        Tykkere isolasjon, gjerne hele rammen. Krever mer arbeid og material.
               Typisk for bygg med mange ansatte, publikum, 2 etasjer.
               Vanligvis 18–30% av stålpris hvis full frame.

  R90/R120:   Hulldekke, etasjeskille, messanin — spesielle krav.
               Conlitt på hulldekke-bæring, krevende montasje.

  Viktig: R-kravet gjelder ULIKE elementer. Et prosjekt kan ha:
  • Søyler R30, sekundærstål ingen (bare maling)
  • Hulldekke R90, vegger/tak ingen spesialkrav

  Kombiner ALLTID med historiske referanser (se nedenfor) for å kalibrere.

Materialvalg fra brannkrav — fyll inn sandwich_type og tak_type basert på EI-krav:
  • Ingen EI-krav eller EI 15-30: PIR 120mm kan brukes (god u-verdi, rimelig)
  • EI 60 krav på vegg: Steinull 150mm minimum (PIR er ikke godkjent EI 60 i alle tilfeller)
  • EI 120 krav på vegg: Steinull 200mm (f.eks. Ruukki nSPB 200 WEE, A2-klassifisering)
  • A2-krav (ubrennbar fasade): alltid Steinull, aldri PIR

  Hvis brannkonsept ikke er vedlagt, men bygg-typen tilsier krav:
  → Bruk historiske prosjekter for lignende byggtype som referanse.
  → Sett sandwich_type basert på hva Ferro typisk bruker for denne klassen.

Estimer kostnadspaslag_pct for stål basert på din vurdering:
  → 0:    Ingen brannisolasjon
  → 5–10: Lett R15/R30, bare primærsøyler, lite antall søyler
  → 10–20: R30 full frame, normalt antall søyler og bjelker
  → 20–35: R60+, hulldekke, mesanin, krevende geometri

KONSEPT — hva slags leveranse er dette:
  Stålentreprise: Ferro gjør stål + kledning, betong/graving/elektro er UE eller andre
  Totalentreprise: Ferro tar hele nøkkelferdig bygg inkl. betong, graving, porter, elektro
  Undertilbud: Ferro leverer til en annen HE (ikke direkte til byggherre)

  Les konsept fra tilleggsinformasjon og dokumenter.
  Hvis totalentreprise: scope_items skal inkludere betong, graving, porter.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEG 3B — KALDTLAGER vs VARMTLAGER (kritisk for stålpris — opp til 2× forskjell)

kaldtlager = true HVIS bygget er:
  • Uisolert stålhall (ingen sandwich-panel, bare TRP-kledning eller åpent)
  • Ikke oppvarmet (ingen varme, ingen isolasjon i tak/vegg — eller bare tynn isolasjon for frost)
  • Typisk: strølager, sandlager, saltlager, plantørke, båthall uten varme, materiallager ute
  • Stål-pris er 40–55% lavere enn varmtlager (lettere profiler, ingen brannisolasjon typisk)

kaldtlager = false (standard) HVIS:
  • Isolerte sandwich-vegger (PIR eller Steinull)
  • Oppvarmet bygg
  • Butikk, vaskehall, verksted, kontor, klubbhus — alltid false

Tegn på kaldtlager i dokumenter:
  • Ingen sandwich-panel nevnt
  • TRP-plater som eneste kledning
  • Stykkliste viser bare konstruksjonsstål, ingen isolasjon
  • Bruksformål: kornlager, sand, salt, grus, båter, landbruk

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEG 3C — TAKHØYDE-KATEGORI (kritisk for kran- og liftkostnad)

kran_lift-kostnad avhenger av TAKHØYDE (gesimshøyde), ikke av BRA.
  Sett takhøyde_kategori:
  "lav"  — gesimshøyde ≤ 5.0m (enkel mobilkran, lett arbeid)
  "mid"  — gesimshøyde 5–9m   (standard lager/vaskehall — vanligst)
  "høy"  — gesimshøyde > 9m   (stor hall, båtlager, industri — krevende oppsett)

Les gesimshøyde fra fasadetegning (høyde fra ferdig gulv til takavrenning).
Hvis ikke oppgitt eksplisitt: utled fra snitt-tegning eller bygg-type:
  Vaskehall typisk 4–5m → lav
  Lager 250–600m² typisk 5–7m → mid
  Stor industri/båtlager > 1000m² typisk 8–12m → høy

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEG 3D — TAK KONSTRUKSJONSTYPE (avgjør tak-rate kr/m²)

Tak-pris drives av: (1) U-verdi krav → isolasjonstjukkleik, (2) om det er tekking eller bare TRP.
Klassifiser tak_konstruksjon_type:

  "trp_kun"
    → Bare TRP-plater (galvanisert/lakkert), ingen isolasjon, ingen tekking
    → Kaldtlager, uisolert hall, sandlager
    → Typisk 450–600 kr/m². U-verdi: ikke aktuelt.

  "trp_med_tekking"
    → TRP + lett asfaltmembran + minimal/ingen isolasjon
    → Vaskehall (lite/ingen oppvarming), enkle bygg
    → Typisk 950–1200 kr/m². U-verdi: ikke streng.

  "varmt_tak_u018"  ← VANLIGSTE for normale isolerte bygg
    → Dampsperre + 120mm underlagsplate + ~100mm EPS + 2× topplate + asfaltbelegg
    → Lager, butikk, kontor, verksted med standard isolasjon
    → U-verdi 0,17–0,20 (krav 0,18 typisk). Typisk 850–1250 kr/m².

  "varmt_tak_u013"
    → Dampsperre + 180mm underlagsplate + ~165mm EPS + 2× topplate + asfaltbelegg
    → Strengere isolasjonskrav (TEK17 § 14-3 / passivhus / kjølelager)
    → U-verdi 0,11–0,14. Typisk 1000–1450 kr/m² (~+18% over u018 pga tjukkere).

  "sandwich_pir_tak"
    → PIR sandwichpaneler tak (alt-i-ett, ingen separat tekking)
    → SP2E 180mm e.l. — egen leverandør (Krokstadelva, Storm)
    → Typisk 1200–1500 kr/m². U-verdi 0,12–0,15.

REGLER:
- Les Ferro sitt eget tilbud (Tilbud mal/Budsjettoverslag) FØRST — der står U-verdi tak ofte direkte.
- Sjekk Uni Tak / Pecel / taktekkings-tilbud i undermappe "Taktekking/" om finst — der står detaljert struktur.
- Funksjonsbeskrivelse / TEK17-krav i anbudsdokumenter spesifiserer U-verdi.
- HVIS U-verdi ≤ 0,15 → "varmt_tak_u013"
- HVIS U-verdi 0,16–0,22 → "varmt_tak_u018"
- HVIS kaldtlager/uisolert → "trp_kun"
- HVIS vaskehall uten varme → "trp_med_tekking"
- HVIS sandwichpaneler oppgitt for tak (ikke bare vegg) → "sandwich_pir_tak"
- Ikkje sikker → null (kalkulator faller tilbake til historisk kalibrering)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEG 4 — VURDER SCOPE (hva skal Ferro levere)

Ferro er stålentreprenør. Standard Ferro-leveranse:
  ✓ stål — alltid med (ramme, søyler, åsar, sekundærstål)
  ✓ yttervegg — sandwich-panel vegger (hvis stålbygg, IKKE kaldtlager)
  ✓ tak — sandwich-plate eller TRP-tak (hvis stålbygg)
  ✓ kran_lift — alltid med ved montering av stålbygg
  ? innervegg — kun hvis romoppdeling i scope
  ? dorer_vinduer — porter og dører (spesifisert eller typisk for bygg)
  ? betong — betong gulv (kun hvis Ferro har scope)
  ? graving — graving/planering (kun hvis Ferro har scope)

Bruk TILLEGGSINFORMASJON fra bruker som primærkilde for scope.
Bruk historiske prosjekter (hvis oppgitt) for å forstå typisk scope for denne bygningstypen.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEG 5 — HÅNDTER UFULLSTENDIGE DOKUMENTER

Tegninger er fra ULIKE arkitekter — ingen standardisert stil.
Ikke alle tegninger har alle mål eksplisitt.

Strategi når mål mangler:
  1. Prøv å beregne fra aksemål i plantegning
  2. Se i fasadetegning for høyder
  3. Sjekk om BRA er oppgitt i rom-areal-liste eller tittelblokk
  4. Hvis tegning mangler — bruk tilleggsinformasjon fra bruker
  5. Hvis ingenting — returner null og legg til i "missing"

Sett confidence basert på hva du faktisk fant:
  "high"   — dimensjoner lest direkte fra tegning med klare mål
  "medium" — dimensjoner beregnet fra aksemål eller delvis lesbare tegninger
  "low"    — estimert fra grunnflate eller tilleggsinformasjon alene

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RETURNER BARE DETTE JSON-OBJEKTET:

{
  "bygg_type": "lager|kaldtlager|vaskehall|verksted|butikk|klubbhus|garasje|annet",
  "kaldtlager": false,
  "dimensjoner": "f.eks. 30×15×5.0m (L×B×H gesims), eller null",
  "bra_m2": 450,
  "tak_m2": 486,
  "yttervegg_m2": 450,
  "innervegg_m2": null,
  "takhøyde_kategori": "lav|mid|høy",
  "tak_konstruksjon_type": "trp_kun|trp_med_tekking|varmt_tak_u018|varmt_tak_u013|sandwich_pir_tak|null",
  "u_verdi_tak": 0.18,
  "materialer": {
    "sandwich_type": "PIR 120mm|Steinull 150mm|Steinull 200mm|null",
    "tak_type": "PIR SP2E 180mm|TRP galvanisert|Trapesblokk|null",
    "isolasjon_mm": 120
  },
  "apninger": {
    "foldeporter_stk": null,
    "seksjonalporter_stk": null,
    "ruteporter_stk": null,
    "persondorer_stk": null,
    "vinduer_stk": null
  },
  "scope_items": ["stål","yttervegg","tak","kran_lift"],
  "brannkrav": {
    "risikoklasse": "1|2|3|null",
    "brannklasse": "1|2|3|null",
    "stal_brannkrav": "ingen|R15|R30|R60|R120|ukjent",
    "brannisolasjon_paakrevd": true,
    "kostnadspaslag_pct": 12,
    "kilde": "fra_tegning|utledet_fra_type|ikke_oppgitt",
    "kommentar": "f.eks. 'R30 på primærsøyler, ca. 18 søyler HEA200 → ca. 12% tillegg'"
  },
  "konsept": {
    "type": "stalentreprise|totalentreprise|undertilbud|ukjent",
    "beskrivelse": "kort: hva Ferro leverer vs hva som er UE/ikke inkludert"
  },
  "lokasjon": "by/sted eller null",
  "confidence": "high|medium|low",
  "beregning_notater": "kort forklaring: hvordan dimensjoner ble beregnet, f.eks. '6 spenn × 5000mm = 30m'",
  "missing": ["felt som genuint IKKE kunne leses eller beregnes"]
}

REGLER:
- BEREGN yttervegg_m2 og tak_m2 fra mål — null KUN hvis dimensjoner er totalt fraværende
- Vis regnestykket i "beregning_notater"
- scope_items: kun det Ferro faktisk skal levere (fra tilleggsinformasjon eller klart fra dokumenter)
- Aldri returner prisfelt — bare fakta og mål
- scope_items gyldige verdier: stål, yttervegg, innervegg, tak, dorer_vinduer, kran_lift, betong, graving
- brannkrav.stal_brannkrav: ALLTID fyll inn — utled fra type/størrelse hvis ikke oppgitt
- brannkrav.brannisolasjon_paakrevd: true hvis R30 eller høyere på søyler/bjelker
- brannkrav.kostnadspaslag_pct: estimer 0-35% tillegg på stålkostnad — 0 for ingen krav, 8-18% for R30 på søyler, 18-30% for R60 full ramme, 30-35% for R120. Bruk historiske referanser og omfang fra dokumenter.
- konsept.type: utled fra tilleggsinformasjon + typisk for bygningstypen
- kaldtlager: true BARE for uisolerte/uoppvarmede stålhaller. Ellers false. Avgjørende for stålpris (±50%).
- takhøyde_kategori: "lav" (≤5m), "mid" (5–9m), "høy" (>9m) — avgjørende for kran/lift-kostnad. Les fra fasadetegning.
- tak_konstruksjon_type: en av {trp_kun, trp_med_tekking, varmt_tak_u018, varmt_tak_u013, sandwich_pir_tak} eller null. Avgjørende for tak-rate (450–1500 kr/m²). Les U-verdi tak fra Ferro-tilbud eller funksjonsbeskrivelse, og taktekkings-tilbud (Uni Tak/Pecel) for materialstruktur.
- u_verdi_tak: tall mellom 0.10 og 0.30, eller null. Hentet direkte fra Ferro-tilbud, anbudsdokument eller TEK17-krav.`

// ─── History context formatter ────────────────────────────────────────────────
function formatHistoryContext(projects) {
  if (!projects?.length) return null
  const lines = [
    'HISTORISKE FERRO-PROSJEKTER — bruk for å forstå typisk scope, materialvalg og prisnivå per m²:',
  ]
  for (const p of projects) {
    const b  = p.bygg || {}
    const pr = p.priser_til_kunde || {}
    const inn = p.innkjop_fra_leverandorer || {}

    const bra     = b.bra_m2
    const fasade  = b.fasade_m2
    const tak_m2  = b.tak_m2

    const bygInfo = [b.type, b.dimensjoner, bra ? bra + 'm²' : null, b.lokasjon].filter(Boolean).join(' · ')

    // Absolute prices
    const priceFields = [
      ['Stål', pr.stal], ['Yttervegg', pr.yttervegg], ['Innervegg', pr.innervegg],
      ['Tak', pr.tak], ['Kran/lift', pr.kran_lift], ['Dører', pr.dorer_vinduer],
      ['Betong', pr.betong], ['Graving', pr.graving], ['SUM', pr.sum_eks_mva],
    ].filter(([, v]) => v != null).map(([k, v]) => `${k}: ${Number(v).toLocaleString('nb-NO')} kr`).join(', ')

    // Unit rates per m²  — the key calibration data
    const rates = []
    if (bra   && pr.stal)      rates.push(`stål ${Math.round(pr.stal/bra)} kr/m²BRA`)
    if (fasade && pr.yttervegg) rates.push(`yttervegg ${Math.round(pr.yttervegg/fasade)} kr/m²fasade`)
    if (tak_m2 && pr.tak)      rates.push(`tak ${Math.round(pr.tak/tak_m2)} kr/m²tak`)
    if (bra   && pr.kran_lift) rates.push(`kran/lift ${Math.round(pr.kran_lift/bra)} kr/m²BRA`)
    if (bra   && pr.betong)    rates.push(`betong ${Math.round(pr.betong/bra)} kr/m²`)

    // Brann + konsept
    const brannInfo = []
    const tl = (p.tekniske_losninger || '').toLowerCase()
    if (tl.includes('r120')) brannInfo.push('R120')
    else if (tl.includes('r60')) brannInfo.push('R60')
    else if (tl.includes('r30')) brannInfo.push('R30')
    else if (tl.includes('r15')) brannInfo.push('R15')
    else if (tl.includes('ingen brann') || tl.includes('uisolert')) brannInfo.push('ingen brannisolasjon')
    const konseptInfo = p.scope ? (
      p.scope.toLowerCase().includes('totalentreprise') ? 'totalentreprise' :
      p.scope.toLowerCase().includes('undertilbud') ? 'undertilbud' : 'stålentreprise'
    ) : null

    // Supplier / material type
    const matInfo = [
      inn.sandwich_type ? `panel: ${inn.sandwich_type}` : null,
      inn.stal_leverandor ? `stål: ${inn.stal_leverandor.split('—')[0].trim()}` : null,
      brannInfo.length ? `brann: ${brannInfo.join('/')}` : null,
      konseptInfo ? `konsept: ${konseptInfo}` : null,
    ].filter(Boolean).join(', ')

    lines.push(
      `• ${p.navn}` +
      (bygInfo      ? `\n  Bygg: ${bygInfo}` : '') +
      (p.scope      ? `\n  Scope: ${p.scope}` : '') +
      (priceFields  ? `\n  Priser: ${priceFields}` : '') +
      (rates.length ? `\n  Enhetsrater: ${rates.join(', ')}` : '') +
      (matInfo      ? `\n  Materialer: ${matInfo}` : '') +
      (p.merknader  ? `\n  Merknader: ${p.merknader.slice(0, 200)}` : ''),
    )
  }
  return lines.join('\n\n')
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function analyzeProject(wrappedFiles, extraInfo, apiKey, onStatus, historyData) {
  if (BASE_URL) {
    return analyzeViaBackend(wrappedFiles, extraInfo, onStatus)
  }
  if (!apiKey) {
    throw new Error('Legg inn Anthropic API-nøkkel (🔑-knappen) for å bruke AI-analyse.')
  }
  return analyzeViaBrowser(wrappedFiles, extraInfo, apiKey, onStatus, historyData)
}

// ─── Backend path ─────────────────────────────────────────────────────────────
async function analyzeViaBackend(wrappedFiles, extraInfo, onStatus) {
  onStatus('Forbereder filer...')
  const normalized = wrappedFiles.map(f => f.file ? f : { file: f, fileType: 'other' })
  const totalMB = normalized.reduce((s, w) => s + w.file.size, 0) / 1024 / 1024
  onStatus(`Sender ${normalized.length} fil(er) (${totalMB.toFixed(1)} MB) til server...`)

  const form = new FormData()
  for (const { file } of normalized) form.append('files', file, file.name)
  if (extraInfo) form.append('extraInfo', extraInfo)

  let res
  try {
    res = await fetch(`${BASE_URL}/api/analyze`, { method: 'POST', body: form })
  } catch (e) {
    throw new Error(`Kan ikke nå Ferro-serveren (${BASE_URL}). Er backend oppe? ${e.message}`)
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Serverfeil: ${res.status}`)
  }

  onStatus('Analyserer med AI + kalkulerer priser...')
  const result = await res.json()
  if (!result.blocks || !Array.isArray(result.blocks)) {
    throw new Error('Serveren returnerte ugyldig respons. Prøv igjen.')
  }
  if (!result.total_low || !result.total_high) {
    const inc = result.blocks.filter(b => b.included)
    result.total_low  = inc.reduce((s, b) => s + (b.price_low  || 0), 0)
    result.total_high = inc.reduce((s, b) => s + (b.price_high || 0), 0)
  }
  onStatus('Ferdig!')
  return result
}

// ─── Browser-direct path ──────────────────────────────────────────────────────
async function analyzeViaBrowser(wrappedFiles, extraInfo, apiKey, onStatus, historyData) {
  const client     = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  const normalized = wrappedFiles.map(f => f.file ? f : { file: f, fileType: 'other' })

  onStatus('Forbereder filer...')
  const content = []
  if (extraInfo?.trim()) {
    content.push({ type: 'text', text: `TILLEGGSINFORMASJON FRA BRUKER:\n${extraInfo}` })
  }
  for (let i = 0; i < normalized.length; i++) {
    const { file } = normalized[i]
    onStatus(`Leser ${i + 1}/${normalized.length}: ${file.name}`)
    const block = await fileToBlock(file)
    if (block) content.push(block)
  }
  const histCtx = formatHistoryContext(historyData)
  if (histCtx) content.push({ type: 'text', text: histCtx })
  content.push({ type: 'text', text: EXTRACTION_PROMPT })

  onStatus('Sender til Claude AI...')
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content }],
  })

  const text  = response.content[0].text.trim()
  const start = text.indexOf('{')
  const end   = text.lastIndexOf('}')
  if (start === -1) throw new Error('Claude klarte ikke å tolke dokumentene. Prøv å legge til tilleggsinformasjon.')
  const facts = JSON.parse(text.slice(start, end + 1))

  onStatus('Kalkulerer priser...')
  const { blocks, totalLow, totalHigh } = calculatePrices(facts, historyData)

  if (!blocks.length) {
    throw new Error('Fant ingen arbeidsblokker å estimere. Legg til mer info om hva Ferro skal levere.')
  }

  const typeMap = { lager: 'Lagerbygg', vaskehall: 'Vaskehall', verksted: 'Verksted',
    butikk: 'Butikk/forretning', klubbhus: 'Klubbhus', garasje: 'Garasje' }

  onStatus('Ferdig!')
  return {
    project_summary: `${typeMap[facts.bygg_type] || facts.bygg_type || 'Bygg'}${facts.bra_m2 ? ', ' + facts.bra_m2 + 'm²' : ''}${facts.lokasjon ? ', ' + facts.lokasjon : ''}.`,
    building: {
      type: facts.bygg_type || 'ukjent',
      size_m2: facts.bra_m2,
      dimensions: facts.dimensjoner,
      location: facts.lokasjon,
    },
    blocks,
    total_low:  totalLow,
    total_high: totalHigh,
    exclusions: [],
    warnings: [
      ...(facts.missing?.length ? [`Manglende data: ${facts.missing.join(', ')}`] : []),
      ...(facts.beregning_notater ? [`Beregning: ${facts.beregning_notater}`] : []),
    ],
    recommended_rigg_pct: 8,
    forutsetninger: {
      u_verdi_tak: 0.18, u_verdi_vegg: 0.18, u_verdi_glass: 1.2,
      tiltaksklasse: '2', bruddgrense_kn_m2: 250, gyldighet_dager: 14,
    },
  }
}

// ─── History extraction (admin feature — calls Claude directly) ───────────────
const HISTORY_EXTRACT_PROMPT = `Du er en erfaren kalkulatør hos Ferro Stålentreprenør AS.
Du mottar dokumenter fra et FULLFØRT Ferro-prosjekt. Trekk ut faktiske data.

Returner KUN gyldig JSON (ingen tekst rundt):
{
  "navn": "Prosjektnavn",
  "bygg": {
    "type": "kort beskrivelse av bygget",
    "dimensjoner": "f.eks. 29×12×5m",
    "bra_m2": 345,
    "fasade_m2": null,
    "tak_m2": null,
    "lokasjon": "by/sted"
  },
  "priser_til_kunde": {
    "stal": null, "yttervegg": null, "innervegg": null, "tak": null,
    "kran_lift": null, "dorer_vinduer": null, "betong": null, "graving": null,
    "rigg_drift_pct": 8, "sum_eks_mva": null
  },
  "innkjop_fra_leverandorer": {
    "stal_leverandor": null, "stal_innkjop_kr": null,
    "sandwich_leverandor": null, "sandwich_innkjop_kr": null, "sandwich_type": null,
    "tak_leverandor": null, "tak_innkjop_kr": null, "andre_ue": null
  },
  "paaslag_beregnet": {
    "stal_paslag": null, "sandwich_paslag": null, "kommentar": null
  },
  "scope": "kommaseparert liste over hva Ferro leverte",
  "tekniske_losninger": "kort teknisk beskrivelse",
  "merknader": "viktige notater"
}`

export async function extractProjectHistory(wrappedFiles, apiKey, onStatus) {
  if (!apiKey) throw new Error('API-nøkkel mangler. Klikk 🔑 og lim inn nøkkelen.')

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  onStatus('Forbereder filer...')
  const content = [{ type: 'text', text: `Jeg laster opp ${wrappedFiles.length} dokument(er) fra et fullført Ferro-prosjekt.` }]

  const normalized = wrappedFiles.map(f => f.file ? f : { file: f, fileType: 'other' })
  for (let i = 0; i < normalized.length; i++) {
    const { file } = normalized[i]
    onStatus(`Leser ${i + 1}/${normalized.length}: ${file.name}`)
    const block = await fileToBlock(file)
    if (block) content.push(block)
  }

  onStatus('Sender til Claude AI...')
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: HISTORY_EXTRACT_PROMPT,
    messages: [{ role: 'user', content }],
  })

  const text  = response.content[0].text.trim()
  const start = text.indexOf('{')
  const end   = text.lastIndexOf('}')
  if (start === -1) throw new Error('AI klarte ikke å tolke dokumentene. Fyll inn feltene manuelt.')
  return JSON.parse(text.slice(start, end + 1))
}

// ─── File helpers ─────────────────────────────────────────────────────────────
async function fileToBlock(file) {
  const mime  = file.type || ''
  const lower = file.name.toLowerCase()

  if (mime === 'application/pdf' || lower.endsWith('.pdf')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const bytes = new Uint8Array(reader.result)
        let binary = ''
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
        resolve({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: btoa(binary) },
        })
      }
      reader.onerror = () => reject(new Error(`Kunne ikke lese ${file.name}`))
      reader.readAsArrayBuffer(file)
    })
  }

  if (mime.startsWith('image/')) {
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve({
        type: 'image',
        source: { type: 'base64', media_type: mime, data: reader.result.split(',')[1] },
      })
      reader.readAsDataURL(file)
    })
  }

  if (mime.includes('spreadsheet') || mime.includes('excel') ||
      lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    return xlsxToBlock(file)
  }

  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = () => resolve({ type: 'text', text: `[${file.name}]\n${reader.result.slice(0, 8000)}` })
    reader.readAsText(file)
  })
}

function xlsxToBlock(file) {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const wb   = XLSX.read(new Uint8Array(reader.result), { type: 'array' })
        const prio = ['Tilbud', 'Resultat', 'Prisoppsett']
        const sorted = [
          ...prio.filter(n => wb.SheetNames.includes(n)),
          ...wb.SheetNames.filter(n => !prio.includes(n)),
        ]
        const lines = [`[Excel: ${file.name}]`]
        for (const name of sorted) {
          const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name], { blankrows: false })
          if (!csv.trim()) continue
          lines.push(`\n--- Ark: ${name} ---\n${csv.slice(0, 4000)}`)
        }
        resolve({ type: 'text', text: lines.join('\n') })
      } catch (e) {
        resolve({ type: 'text', text: `[Excel: ${file.name} — feil: ${e.message}]` })
      }
    }
    reader.readAsArrayBuffer(file)
  })
}
