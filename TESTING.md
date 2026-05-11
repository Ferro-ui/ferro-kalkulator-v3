# Ferro Kalkulator — Testing & Checklist

## Запуск тестів

```bash
node scripts/docx.test.mjs
```

Запускає `scripts/docx.test.mjs` через Node.js (31 тест, без браузера).

## Що тести перевіряють

| Suite | Що перевіряє |
|-------|-------------|
| A — buildDocument | Документ повертає об'єкт з sections, headers, footers |
| B — stål price | Ціна сталі береться з stalPrice або з stål-блоку; rigg рахується вірно |
| C — blockDescription | Текст опису для кожного типу блоку (stål, tak, yttervegg, hulldekker, heis тощо) |
| D — document structure | Sections мають children, Header/Footer присутній |
| E — price math | totalLow/totalHigh рахуються правильно зі списку блоків |

## Чеклист перед кожним коммітом

### Якщо міняв `src/calculator.js`

- [ ] `npm test` — всі 31 тести зелені
- [ ] Запусти в браузері: вставте тестовий проект → перевір що всі очікувані блоки з'явились
- [ ] Перевір що `totalLow/totalHigh` рахуються правильно (є в секції E тестів)
- [ ] Якщо додав новий блок: додай відповідний `id` до `blockDescription()` в `generateDocx.js`
- [ ] Якщо додав новий блок: додай `id` до `scope_items` → REGLER в `analyzeProject.js`
- [ ] Якщо додав новий rate: додай у `FALLBACK_RATES` в `calculator.js`

### Якщо міняв `src/generateDocx.js`

- [ ] `npm test` — Suite A, B, C, D зелені
- [ ] Скачай `.docx` через браузер і відкрий у Word/LibreOffice
- [ ] Перевір: лого на місці, navy header, ціни правильні, всі блоки є
- [ ] Перевір що Safari завантажує файл (не лише Chrome)
- [ ] Якщо міняв `buildDocument()`: перевір Suite A та D

### Якщо міняв `src/analyzeProject.js`

- [ ] Запусти реальний аналіз у браузері з тестовим проектом
- [ ] Перевір що JSON повертається без помилки "AI svarte ikke med gyldig JSON"
- [ ] Перевір що нові поля (наприклад `hulldekker_m2`) є в JSON і передаються в calculator
- [ ] Якщо збільшив/зменшив `max_tokens`: протестуй на великому проекті (3+ будівлі)

### Якщо міняв `scope_items` або додав новий тип блоку

Перевір весь ланцюжок:
1. `analyzeProject.js` → JSON schema містить нове поле / нове значення scope_items
2. `analyzeProject.js` → REGLER: нове значення додано до "gyldige verdier"
3. `calculator.js` → є блок `if (scope.includes('новий_тип'))` з правильною логікою
4. `generateDocx.js` → `blockDescription()` повертає текст для нового `id`
5. `scripts/docx.test.mjs` → є тест для нового `blockDescription` (Suite C)

## Відомі обмеження

- **Safari download**: використовує `dispatchEvent(MouseEvent)` + 30s DOM cleanup щоб обійти Safari async gesture restriction
- **max_tokens: 8192**: якщо проект дуже складний (5+ будівель) і знову з'являється JSON помилка → збільшити до 16384 в `analyzeProject.js`
- **hulldekker**: спрацьовує тільки якщо AI повернув `hulldekker_m2 > 0` в facts — перевір у console.log що facts містить це поле
- **heis**: не потребує `m2` — тільки перевіряє `scope.includes('heis')`

## Локальне тестування без браузера

```bash
# docx тести
node scripts/docx.test.mjs

# Перевір build (Vite)
npm run build
```

`npm run build` покаже синтаксичні помилки в JSX/JS до деплою.
