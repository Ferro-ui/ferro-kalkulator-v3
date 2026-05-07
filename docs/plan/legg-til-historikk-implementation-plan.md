# Implementation Plan — «Legg til i historikk»

**Feature:** Додавання завершеного проекту в AI-базу прямо з браузера  
**Дата:** 2026-05-06  
**Автор:** Marian Mychko + Claude

---

## Goal

Дати Маріану можливість завантажити PDF/Excel завершеного проекту → AI автоматично витягує
будівельні дані та реальні ціни → після підтвердження зберігає у localStorage →
всі наступні аналізи використовують ці проекти як референс поряд з `historiske_prosjekter.json`.

Жодного backend, жодного Node.js, жодного Google Drive — тільки браузер.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     App.jsx                             │
│                                                         │
│  [📁 Legg til historikk]  ← нова кнопка в топ-барі     │
│           ↓                                             │
│   HistorikkModal                                        │
│   ├── FileUpload (PDF, xlsx)                            │
│   ├── ProjectName input                                 │
│   ├── [Analyser →] → extractProjectHistory()            │
│   ├── ExtractedDataPreview (редаговані поля)            │
│   └── [Lagre i historikk] → saveManualProject()        │
└─────────────────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────────────────┐
│                 analyzeProject.js                       │
│                                                         │
│  extractProjectHistory(files, apiKey, onStatus)         │
│  └── callClaude(HISTORY_EXTRACT_PROMPT, files)          │
│      → повертає структурований JSON проекту             │
│                                                         │
│  buildHistoricalContext()                               │
│  ├── historiske_prosjekter.json  (статичний)            │
│  └── loadManualProjects()        (localStorage) ← НОВЕ │
└─────────────────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────────────────┐
│                    utils.js                             │
│                                                         │
│  saveManualProject(project)                             │
│  loadManualProjects() → []                              │
│  deleteManualProject(index)                             │
│  exportManualProjectsJSON()  ← скачати як файл         │
└─────────────────────────────────────────────────────────┘
```

---

## Data Model

```js
// localStorage key: 'ferro_manual_projects_v1'  →  Array<ManualProject>

{
  navn: "Lagerbygg Steinsholt",
  dato_lagt_til: "2026-05-06",         // auto
  bygg: {
    type: "Kaldtlager",                // AI витягує
    dimensjoner: "20×12×6m",           // AI витягує
    bra_m2: 240,                       // AI витягує або null
    lokasjon: "Steinsholt"             // AI витягує або null
  },
  scope: "Yttervegg + tak + porter",  // AI витягує
  priser_til_kunde: {
    yttervegg: 180000,
    innervegg: null,
    tak: 210000,
    kran_lift: 70000,
    dorer_vinduer: 120000,
    betong: null,
    graving: null,
    sum_eks_mva: 580000,
    rigg_drift_pct: 8
  },
  innkjop: {                           // якщо є в документах
    stal_leverandor: "Ruukki",
    sandwich_leverandor: "Storm",
    sandwich_type: "SP120 PIR"
  },
  merknader: "Uoppvarmet lager, enkel konstruksjon"
}
```

---

## Files to Change

| Файл | Що змінюється |
|------|--------------|
| `src/analyzeProject.js` | + `extractProjectHistory()` + новий промпт `HISTORY_EXTRACT_PROMPT` + merge у `buildHistoricalContext()` |
| `src/utils.js` | + `saveManualProject`, `loadManualProjects`, `deleteManualProject`, `exportManualProjectsJSON` |
| `src/App.jsx` | + `HistorikkModal` компонент + кнопка в топ-барі + state `showHistorikkModal` |
| `src/translations.js` | + нові ключі для HistorikkModal (nb + uk) |

---

## Task Breakdown

### Task 1 — `utils.js`: localStorage helpers
```
saveManualProject(project)       → додає в масив
loadManualProjects()             → повертає масив або []
deleteManualProject(index)       → видаляє по індексу
exportManualProjectsJSON()       → скачує .json файл (для backup/transfer)
```

### Task 2 — `analyzeProject.js`: HISTORY_EXTRACT_PROMPT
Новий системний промпт який каже Claude:
- Це ЗАВЕРШЕНИЙ проект — витягни реальні ціни
- Повернути JSON у форматі `ManualProject` (без `navn`, `dato_lagt_til`)
- Якщо в xlsx є колонки "Pris til kunde" — це головне джерело
- Якщо є tilbud PDF — це innkjøpspris (треба відрізняти від customer price)
- Формат відповіді: тільки JSON, без markdown

```js
const HISTORY_EXTRACT_PROMPT = `Du er en erfaren kalkulatør...
Returner KUN gyldig JSON:
{
  "bygg": { "type": "...", "dimensjoner": "...", "bra_m2": null, "lokasjon": "..." },
  "scope": "...",
  "priser_til_kunde": { "yttervegg": null, "tak": null, ... "sum_eks_mva": null },
  "innkjop": { "stal_leverandor": null, "sandwich_leverandor": null, ... },
  "merknader": "..."
}`
```

### Task 3 — `analyzeProject.js`: `extractProjectHistory()`
```js
export async function extractProjectHistory(wrappedFiles, apiKey, onStatus) {
  // Аналогічно до analyzeSingleCall але:
  // 1. Використовує HISTORY_EXTRACT_PROMPT
  // 2. max_tokens: 2048 (менше — відповідь коротша)
  // 3. Повертає ManualProject без navn та dato
}
```

### Task 4 — `analyzeProject.js`: оновити `buildHistoricalContext()`
```js
function buildHistoricalContext() {
  const staticProjects = historiskeProsjekter   // як зараз
  const manualProjects = loadManualProjects()   // НОВЕ з localStorage

  const allProjects = [...staticProjects, ...manualProjects.map(p => ({
    ...p,
    // map до формату historiske_prosjekter для уніфікованого відображення
    priser: p.priser_til_kunde,
    merknader: `${p.merknader || ''} [Manuelt lagt til ${p.dato_lagt_til}]`
  }))]

  // решта логіки без змін — ітерує allProjects
}
```

### Task 5 — `App.jsx`: `HistorikkModal`
```
HistorikkModal
├── Заголовок + підзаголовок
├── ProjectName input (обов'язкове)
├── FileUpload zone (PDF, xlsx — той самий компонент що в головному UI)
├── [Analyser filer →] кнопка
│   └── spinner + onStatus повідомлення
├── ExtractedPreview (якщо extractedData є):
│   ├── Bygg: type, dimensjoner, bra_m2, lokasjon
│   ├── Scope текст
│   ├── Priser grid (yttervegg, tak, kran, dorer, sum)
│   └── Merknader textarea
├── [✓ Lagre i historikk] кнопка
└── Список збережених (loadManualProjects()) з кнопкою ×
    └── [↓ Eksporter JSON]
```

### Task 6 — `App.jsx`: кнопка в топ-барі
```jsx
// У топ-барі поруч з 📊:
<button onClick={() => setShowHistorikkModal(true)} title="Legg til prosjekt i historikk">
  📁
</button>
```

---

## Промпт стратегія для витягування

Головна різниця від основного аналізу:

| Основний аналіз | History Extract |
|-----------------|-----------------|
| Оцінює нове невідоме | Витягує реальні дані |
| Дає Fra/Til діапазон | Дає конкретні числа |
| Великі батчі, паузи | Один call, швидко |
| 8192 tokens output | 2048 tokens output |
| Фокус: що треба зробити | Фокус: що зроблено і за скільки |

---

## Validation Rules

- `navn` — обов'язкове (не можна зберегти без назви)
- `sum_eks_mva` — якщо null, показати попередження але дозволити зберегти
- Дублі по `navn` — показати warning "Prosjekt med dette navnet finnes allerede"
- Максимум 50 ручних проектів у localStorage (попередження при досягненні)

---

## Edge Cases

| Ситуація | Поведінка |
|----------|-----------|
| AI не знайшов цін | Показати порожні поля — user заповнює вручну |
| Файл > 5MB | Батчинг як в основному аналізі |
| JSON parsing fail | Показати raw text, дати редагувати |
| localStorage full | Catch error + пропозиція exportувати і видалити старі |

---

## Estimated Effort

| Task | Складність | Час |
|------|-----------|-----|
| utils.js helpers | Просто | 15 хв |
| HISTORY_EXTRACT_PROMPT | Середньо | 20 хв |
| extractProjectHistory() | Просто | 10 хв |
| buildHistoricalContext() merge | Просто | 10 хв |
| HistorikkModal UI | Середньо | 45 хв |
| Кнопка + state | Просто | 5 хв |
| **Разом** | | **~1.5 год** |

---

## Future Enhancements (після MVP)

- Кнопка «Lagre som referanse» прямо після аналізу (автозаповнення з результату)
- Синхронізація через GitHub API (для майбутніх колег)
- Fra/Til діапазон у .docx замість midpoint
