// generateDocx.js — runs entirely in the browser, no server needed
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, AlignmentType, BorderStyle, WidthType,
  ShadingType, VerticalAlign, LevelFormat, PageNumber
} from 'docx'
import { FERRO_LOGO_B64 } from './ferroLogo.js'

// ── Palette — navy/cyan extracted from Ferro logo ─────────────────────────────
const NAVY        = '0D1E35'   // deep navy (slightly darker than logo for richness)
const NAVY_BAND   = '1B3050'   // exact logo navy — used for header band
const NAVY_MID    = '1E3D65'
const CYAN        = '4DB8E8'   // exact logo cyan
const CYAN_PALE   = 'B8DFF3'   // very light cyan for ruled lines
const INK         = '111C27'   // near-black for body text
const SLATE       = '3A5068'   // muted mid for secondary text
const ASH         = '7B96AA'   // light secondary labels
const PAPER       = 'F6F9FC'   // barely-tinted page fill for table rows
const WHITE       = 'FFFFFF'

// ── No-border shorthand ───────────────────────────────────────────────────────
const nb  = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const NB  = { top: nb, bottom: nb, left: nb, right: nb, insideHorizontal: nb, insideVertical: nb }

// ── Typography helpers ────────────────────────────────────────────────────────
const run = (text, opts = {}) => new TextRun({ text, font: 'Arial', size: 20, color: INK, ...opts })

// Micro label — spaced caps, ASH color
const label = (text) => new Paragraph({
  spacing: { before: 0, after: 40 },
  children: [new TextRun({ text: text.toUpperCase(), font: 'Arial', size: 14, color: ASH, characterSpacing: 60 })]
})

// Section heading — tabbed left accent via left-border paragraph + bold navy text
const sectionHead = (text) => new Paragraph({
  spacing: { before: 340, after: 100 },
  border: { left: { style: BorderStyle.SINGLE, size: 12, color: CYAN, space: 8 } },
  indent: { left: 160 },
  children: [new TextRun({ text, font: 'Arial', size: 21, bold: true, color: NAVY_BAND })]
})

const body = (text, opts = {}) => new Paragraph({
  spacing: { before: 0, after: 140 },
  indent: { left: 0 },
  children: [run(text, { size: 19, color: SLATE, ...opts })]
})

const bullet = (text) => new Paragraph({
  numbering: { reference: 'bullets', level: 0 },
  spacing: { before: 0, after: 80 },
  children: [run(text, { size: 18, color: SLATE })]
})

const gap = (pts = 6) => new Paragraph({ spacing: { before: 0, after: pts * 20 } })

// ── Horizontal rules ──────────────────────────────────────────────────────────
const ruleHeavy = () => new Paragraph({
  border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: NAVY_BAND, space: 4 } },
  spacing: { before: 0, after: 80 },
  children: [new TextRun('')]
})

const ruleThin = () => new Paragraph({
  border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: CYAN_PALE, space: 4 } },
  spacing: { before: 0, after: 60 },
  children: [new TextRun('')]
})

// ── Price table — 3-row specification style ───────────────────────────────────
function priceTable(sumExMva, mva, sumInkMva) {
  const fmtNO = (n) => Math.round(n).toLocaleString('nb-NO') + ',-'

  const specRow = (code, label, value, isTotal) => new TableRow({
    children: [
      // Code column
      new TableCell({
        width: { size: 900, type: WidthType.DXA },
        shading: { fill: isTotal ? NAVY_BAND : PAPER, type: ShadingType.CLEAR },
        margins: { top: isTotal ? 160 : 100, bottom: isTotal ? 160 : 100, left: 200, right: 80 },
        borders: {
          top: nb, left: nb, right: nb,
          bottom: { style: BorderStyle.SINGLE, size: 2, color: isTotal ? CYAN : CYAN_PALE },
        },
        children: [new Paragraph({ children: [new TextRun({ text: code, font: 'Arial', size: 15, color: isTotal ? CYAN : ASH, characterSpacing: 30 })] })]
      }),
      // Label column
      new TableCell({
        width: { size: 5700, type: WidthType.DXA },
        shading: { fill: isTotal ? NAVY_BAND : WHITE, type: ShadingType.CLEAR },
        margins: { top: isTotal ? 160 : 100, bottom: isTotal ? 160 : 100, left: 160, right: 80 },
        borders: {
          top: nb, left: nb, right: nb,
          bottom: { style: BorderStyle.SINGLE, size: 2, color: isTotal ? CYAN : CYAN_PALE },
        },
        children: [new Paragraph({ children: [new TextRun({ text: label, font: 'Arial', size: isTotal ? 23 : 20, bold: isTotal, color: isTotal ? WHITE : INK })] })]
      }),
      // Value column
      new TableCell({
        width: { size: 2400, type: WidthType.DXA },
        shading: { fill: isTotal ? NAVY_BAND : WHITE, type: ShadingType.CLEAR },
        margins: { top: isTotal ? 160 : 100, bottom: isTotal ? 160 : 100, left: 80, right: 200 },
        borders: {
          top: nb, left: nb, right: nb,
          bottom: { style: BorderStyle.SINGLE, size: 2, color: isTotal ? CYAN : CYAN_PALE },
        },
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: value, font: 'Arial', size: isTotal ? 23 : 20, bold: isTotal, color: isTotal ? CYAN : INK })]
        })]
      })
    ]
  })

  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    columnWidths: [900, 5700, 2400],
    borders: NB,
    rows: [
      specRow('01', 'Sum uten opsjoner eks. mva', fmtNO(sumExMva), false),
      specRow('02', 'Mva (25 %)', fmtNO(mva), false),
      specRow('SUM', 'Totalt inkl. mva', fmtNO(sumInkMva), true),
    ]
  })
}

// ── Header: navy band, logo + document meta ───────────────────────────────────
function buildHeader(logoBytes) {
  return new Header({
    children: [
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2800, 6560],
        borders: NB,
        rows: [
          new TableRow({
            children: [
              // Logo cell — white so logo is always visible
              new TableCell({
                borders: NB,
                shading: { fill: WHITE, type: ShadingType.CLEAR },
                margins: { top: 160, bottom: 160, left: 220, right: 160 },
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({
                  children: [new ImageRun({ data: logoBytes, transformation: { width: 108, height: 72 }, type: 'png' })]
                })]
              }),
              // Meta cell — also navy background, right-aligned
              new TableCell({
                borders: NB,
                shading: { fill: NAVY_BAND, type: ShadingType.CLEAR },
                margins: { top: 160, bottom: 160, left: 160, right: 220 },
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({ text: 'FERRO STÅLENTREPRENØR AS', font: 'Arial', size: 17, bold: true, color: WHITE, characterSpacing: 40 }),
                    new TextRun({ text: 'Ringsevja 3, 3830 Ulefoss', font: 'Arial', size: 14, color: CYAN_PALE, break: 1 }),
                    new TextRun({ text: 'ferrostal.no  ·  marian@ferrostal.no', font: 'Arial', size: 14, color: CYAN_PALE, break: 1 }),
                  ]
                })]
              })
            ]
          })
        ]
      }),
      // Cyan stripe under the band
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: CYAN, space: 0 } },
        spacing: { before: 0, after: 0 },
        children: [new TextRun('')]
      }),
    ]
  })
}

// ── Footer ────────────────────────────────────────────────────────────────────
function buildFooter() {
  return new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 2, color: CYAN_PALE, space: 4 } },
        spacing: { before: 60, after: 0 },
        children: [new TextRun('')]
      }),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [6360, 3000],
        borders: NB,
        rows: [new TableRow({
          children: [
            new TableCell({
              borders: NB,
              margins: { top: 0, bottom: 0, left: 0, right: 0 },
              children: [new Paragraph({
                children: [new TextRun({ text: 'Ferro Stålentreprenør AS  ·  Org.nr: 926 542 680  ·  ferrostal.no', font: 'Arial', size: 14, color: ASH })]
              })]
            }),
            new TableCell({
              borders: NB,
              margins: { top: 0, bottom: 0, left: 0, right: 0 },
              children: [new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: 'Side ', font: 'Arial', size: 14, color: ASH }),
                  new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 14, color: ASH }),
                ]
              })]
            })
          ]
        })]
      })
    ]
  })
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function generateAndDownloadDocx(data) {
  const DEFAULT_SIGNER = { name: 'Marian Mychko', title: 'Kalkulatør', tlf: '91 92 36 26', email: 'marian@ferrostal.no' }
  const DEFAULT_FORUTSETNINGER = {
    u_verdi_tak: 0.18,
    u_verdi_vegg: 0.18,
    u_verdi_glass: 1.2,
    tiltaksklasse: '2',
    bruddgrense_kn_m2: 250,
    gyldighet_dager: 14,
  }
  const { projectName, result, blocks, stalPrice, riggPct, kunde } = data
  const signer = { ...DEFAULT_SIGNER, ...(data.signer || {}) }
  const f = { ...DEFAULT_FORUTSETNINGER, ...(data.forutsetninger || {}) }

  const uVerdiText = () => {
    const parts = []
    if (f.u_verdi_tak  != null) parts.push(`tak ${String(f.u_verdi_tak).replace('.', ',')}`)
    if (f.u_verdi_vegg != null) parts.push(`vegg ${String(f.u_verdi_vegg).replace('.', ',')}`)
    if (f.u_verdi_glass != null) parts.push(`glass ${String(f.u_verdi_glass).replace('.', ',')}`)
    return parts.length > 0
      ? `U-verdi: ${parts.join(', ')}.`
      : 'Uisolert bygg, ingen U-verdi krav.'
  }

  const logoBytes = Uint8Array.from(atob(FERRO_LOGO_B64), c => c.charCodeAt(0))

  const filteredBlocks = (blocks || []).filter(b =>
    !['stal', 'stål', 'stalkonstruksjon'].includes((b.id || '').toLowerCase()) &&
    !b.name?.toLowerCase().includes('stålkonstruks')
  )

  const stal = parseInt(stalPrice) || 0
  const totalBlocks = filteredBlocks.reduce((s, b) => s + Math.round((b.price_low + b.price_high) / 2), 0)
  const rigg = totalBlocks * ((riggPct || 8) / 100)
  const sumExMvaRaw = totalBlocks + stal + rigg
  const sumExMva = Math.round(sumExMvaRaw / 1000) * 1000
  const mva = Math.round(sumExMva * 0.25)
  const sumInkMva = sumExMva + mva

  const today = new Date().toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })
  const fmtNO = (n) => Math.round(n).toLocaleString('nb-NO') + ',-'
  const docRef = `FAS-${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`

  // Recipient block (left)  |  Doc meta (right)
  const recipientTable = new Table({
    width: { size: 9000, type: WidthType.DXA },
    columnWidths: [4800, 4200],
    borders: NB,
    rows: [new TableRow({
      children: [
        new TableCell({
          borders: NB,
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
          children: [
            ...(kunde?.firma ? [
              new Paragraph({ spacing: { before: 0, after: 40 }, children: [run(kunde.firma, { bold: true, size: 21, color: INK })] }),
              ...(kunde.kontakt ? [new Paragraph({ spacing: { before: 0, after: 40 }, children: [run(kunde.kontakt, { size: 19, color: SLATE })] })] : []),
              ...(kunde.adresse ? [new Paragraph({ spacing: { before: 0, after: 0  }, children: [run(kunde.adresse, { size: 19, color: SLATE })] })] : []),
            ] : [new Paragraph({ children: [new TextRun('')] })])
          ]
        }),
        new TableCell({
          borders: NB,
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { before: 0, after: 30 },
              children: [run(`Ulefoss, ${today}`, { size: 18, color: ASH })]
            }),
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { before: 0, after: 0 },
              children: [run(docRef, { size: 18, color: ASH })]
            }),
          ]
        })
      ]
    })]
  })

  // Scope section items
  const scopeItems = []

  if (stal > 0) {
    scopeItems.push(sectionHead('Stålkonstruksjon'))
    scopeItems.push(body('Det er medregnet stålkonstruksjon til prosjektet. Pris er innhentet fra leverandør.'))
  }

  filteredBlocks.forEach(b => {
    scopeItems.push(sectionHead(b.name))
  })

  const notIncluded = (result.exclusions || []).filter(e =>
    !e.toLowerCase().includes('stål') && !e.toLowerCase().includes('stal')
  )
  if (notIncluded.length > 0) {
    scopeItems.push(sectionHead('Ikke medregnet'))
    notIncluded.forEach(e => scopeItems.push(bullet(e)))
  }

  scopeItems.push(sectionHead('Grunnarbeid'))
  scopeItems.push(body('Grunnarbeid er ikke medregnet, og graver må gjøre klart for isolering og støp. Forutsetter at graver legger strøm, vann og avløp inn til innsiden av bygget yttervegg. Frostisolering utvendig ivaretas av grave firma.'))

  scopeItems.push(sectionHead('Branntetting'))
  scopeItems.push(body('Det er ikke medtatt brannisolering av bæresystem og det forutsettes R0 på stålet, men dette kan ikke fastsettes før det er utarbeidet en brannrapport.'))

  if (result.warnings?.length) {
    scopeItems.push(sectionHead('Forbehold'))
    result.warnings.forEach(w => scopeItems.push(bullet(w)))
  }

  const doc = new Document({
    numbering: {
      config: [{
        reference: 'bullets',
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT,
          style: {
            paragraph: { indent: { left: 480, hanging: 240 } },
            run: { font: 'Arial', color: CYAN }
          }
        }]
      }]
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1800, right: 1300, bottom: 1400, left: 1300 }
        }
      },
      headers: { default: buildHeader(logoBytes) },
      footers: { default: buildFooter() },
      children: [
        // Recipient + date/ref row
        recipientTable,
        gap(20),

        // Document type label — small spaced caps
        new Paragraph({
          spacing: { before: 0, after: 40 },
          children: [new TextRun({ text: 'TILBUD / BUDSJETTPRIS', font: 'Arial', size: 15, color: CYAN, characterSpacing: 80, bold: true })]
        }),

        // Project name — large, navy, dominant
        new Paragraph({
          spacing: { before: 0, after: 60 },
          children: [new TextRun({
            text: projectName || result.project_summary?.slice(0, 80) || 'Prosjekt',
            font: 'Arial', size: 40, bold: true, color: NAVY_BAND,
          })]
        }),

        // Thin cyan rule under title
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: CYAN, space: 4 } },
          spacing: { before: 0, after: 280 },
          children: [new TextRun('')]
        }),

        // Intro
        new Paragraph({
          spacing: { before: 0, after: 280 },
          children: [run('Vi takker for deres forespørsel og tilbyr følgende budsjett:', { size: 19, color: SLATE, italics: true })]
        }),

        // Price table
        priceTable(sumExMva, mva, sumInkMva),
        gap(24),

        // Closing
        body('Vedlagte beskrivelse spesifiserer arbeidet i detalj. Vi ser frem til et godt samarbeid og håper budsjettet er konkurransedyktig.'),
        gap(20),

        // Signature block
        new Paragraph({ spacing: { before: 0, after: 40 }, children: [run('Med vennlig hilsen,', { size: 19, color: SLATE })] }),
        new Paragraph({ spacing: { before: 0, after: 40 }, children: [run('Ferro Stålentreprenør AS', { size: 21, bold: true, color: NAVY_BAND })] }),
        gap(28),

        // Signer line — cyan rule
        new Paragraph({
          spacing: { before: 0, after: 20 },
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: CYAN, space: 6 } },
          children: [run(signer.name, { size: 20, bold: true, color: NAVY_BAND })]
        }),
        new Paragraph({ spacing: { before: 0, after: 0  }, children: [run(signer.title, { size: 17, color: ASH })] }),
        new Paragraph({ spacing: { before: 0, after: 400 }, children: [run(`${signer.tlf}  ·  ${signer.email}`, { size: 17, color: ASH })] }),

        ruleHeavy(),
        gap(4),

        // Scope section
        new Paragraph({
          spacing: { before: 0, after: 100 },
          children: [new TextRun({ text: 'LEVERANSEBESKRIVELSE', font: 'Arial', size: 18, bold: true, color: NAVY_BAND, characterSpacing: 60 })]
        }),

        ...scopeItems,

        gap(20),
        ruleHeavy(),
        gap(4),

        // General conditions
        new Paragraph({
          spacing: { before: 0, after: 120 },
          children: [new TextRun({ text: 'GENERELLE FORUTSETNINGER', font: 'Arial', size: 18, bold: true, color: NAVY_BAND, characterSpacing: 60 })]
        }),
        bullet('Ved tilleggsarbeid: 750,- pr. time for montør, 1 200,- pr. time for prosjektleder, 15 % materialpåslag.'),
        bullet('Mengder gjeldende, reguleres før kontrakt.'),
        bullet('Budsjettet skriftlig bestilles av kunde. Kontinuerlig montasje forutsettes.'),
        bullet('Tegning på stål gjelder for pris. Prisjustering iht. beregningsgrunnlag.'),
        bullet('Fundamentering dimensjonert for monteringslaster, Ferro ikke ansvar for setninger.'),
        bullet('Fremkommelig vei rundt bygget (min. 4 m bredde) for kran/transport.'),
        bullet(`Budsjettet gyldig ${f.gyldighet_dager} dager.`),
        bullet('Stålpris-forbehold: Budsjettet på stål er bygd på gårsdagens innkjøpspriser. Verkene har varslet prisoppgang og holder kun priser på dagsbasis. Vi forbeholder oss retten til gjennomgang ved kontrakt.'),
        bullet(`Tiltaksklasse ${f.tiltaksklasse}, seismikk utelates, direkte fundamentering ${f.bruddgrense_kn_m2} kN/m² bruddgrense.`),
        bullet(uVerdiText()),
        bullet('War-clause: Force majeure iht. NS 8417 pkt. 33 / NS 8415 pkt. 24.'),
        bullet('Ryddet ut etter eget arbeid, ikke vasket.'),
        bullet('Budsjettet er basert på foreliggende dokumentasjon. Endelig pris gjennomgås dersom grunnlaget endres vesentlig.'),
      ]
    }]
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const slug = (projectName || 'prosjekt').replace(/\s+/g, '_').replace(/[^\w_]/g, '')
  const date = new Date().toISOString().slice(0, 10)
  a.download = `Budsjett_${slug}_${date}.docx`
  a.click()
  URL.revokeObjectURL(url)
}
