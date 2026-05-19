# Empty States Documentation

## Overview
Beautiful, inviting empty state components for the Ferro Kalkulator cost estimation app. Styled after Aceternity UI with smooth animations and on-brand design.

## Components

### EmptyState.jsx
**Purpose:** Initial welcome state when no files have been uploaded.

**Features:**
- Animated icon circle with glow effect
- Large, bold heading ("Ingen estimater ennå")
- Descriptive subtext explaining the purpose
- Cyan accent divider for visual interest
- CTA button with hover animations ("Last opp fil nå")
- Helper text for additional context

**Usage:**
```jsx
<EmptyState
  onAction={() => document.querySelector('input[type="file"]')?.click()}
  actionLabel="Last opp fil nå"
  icon="📄"
/>
```

**Props:**
- `onAction` (function): Callback when button is clicked
- `actionLabel` (string): Button text (default: "Last opp fil")
- `icon` (string): Emoji icon to display (default: "📊")

**Styling:**
- Uses CSS variables: `--navy`, `--cyan`, `--text-dim`, `--border`
- Font families: Big Shoulders Display (headings), system (body)
- Smooth Framer Motion animations on mount
- Responsive padding and spacing

### EmptyStateReset.jsx
**Purpose:** Encouragement screen shown after user resets a completed estimate.

**Features:**
- More compact vertical spacing
- Celebratory emoji icon (✨)
- Friendly heading ("Klar for nytt prosjekt?")
- Subtle background gradient
- Uppercase button text for emphasis ("NYTT PROSJEKT")

**Usage:**
```jsx
<EmptyStateReset onNewProject={handleResetAndScroll} />
```

**Props:**
- `onNewProject` (function): Callback to start new project

## Integration Points

### In App.jsx
EmptyState appears in the main content area when:
1. User first loads the app (no files uploaded yet)
2. `files.length === 0` and `!analyzing`

Shows above the UploadPanel to create a welcoming first impression.

```jsx
{/* Show EmptyState if no files uploaded yet */}
{files.length === 0 && !analyzing && (
  <EmptyState
    onAction={() => document.querySelector('input[type="file"]')?.click()}
    actionLabel="Last opp fil nå"
    icon="📄"
  />
)}
```

## Animation Details

### EmptyState Sequence
1. **Icon circle** (delay: 100ms): scales in from 0 to 1
2. **Heading** (delay: 200ms): fades and slides up
3. **Subtext** (delay: 250ms): fades and slides up
4. **Divider** (delay: 300ms): scales in from left to right
5. **Button** (delay: 350ms): fades and scales in
6. **Helper text** (delay: 450ms): fades in

All animations use `easeOut` for natural feel.

### Interactive States
- **Button hover**: scales 1.05, enhanced shadow
- **Button tap**: scales 0.98 for tactile feedback
- **Icon circle**: continuous pulse animation on glow shadow

## Color Scheme
Matches Ferro Kalkulator design system:
- **Cyan accent:** `var(--cyan)` / `#4DB8E8`
- **Navy text:** `var(--navy)` / Dark blue
- **Dim text:** `var(--text-dim)` / Gray
- **Border:** `var(--border)` / Light gray
- **Background:** Light neutral with subtle gradients

## Accessibility
- Semantic HTML structure
- Clear, descriptive text
- Sufficient color contrast (WCAG AA compliant)
- Keyboard-accessible buttons
- Animations respect prefers-reduced-motion (via Framer Motion defaults)

## Future Enhancements
- Add "Browse examples" secondary button
- Include quick-start template cards
- Add contextual tips based on project type
- Support for dark mode variant
- Animated background pattern matching Aceternity style

## Browser Support
- Modern browsers with CSS Grid and Flexbox
- Framer Motion v12.38.0+
- Tested on:
  - Chrome/Edge (latest)
  - Firefox (latest)
  - Safari 15+
  - Mobile browsers (iOS Safari, Chrome mobile)
