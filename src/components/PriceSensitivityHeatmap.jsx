import { motion } from 'framer-motion'

export default function PriceSensitivityHeatmap({ blocks, totalBudget }) {
  if (!blocks || blocks.length === 0) return null

  // Calculate impact percentage for each block
  const impacts = blocks.map(block => ({
    name: block.name || `Block ${blocks.indexOf(block) + 1}`,
    midpoint: (block.priceFrom + block.priceTo) / 2,
    impact: (((block.priceTo - block.priceFrom) / 2) / totalBudget) * 100
  }))

  const maxImpact = Math.max(...impacts.map(i => i.impact))

  const getHeatColor = (impact) => {
    const ratio = impact / maxImpact
    if (ratio > 0.7) return '#C03030' // red - high impact
    if (ratio > 0.4) return '#FF9800' // orange - medium
    return '#4DB8E8' // cyan - low
  }

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const item = {
    hidden: { opacity: 0, x: -20 },
    show: { opacity: 1, x: 0 }
  }

  return (
    <div style={{ marginTop: 32, padding: 24, background: 'rgba(77,184,232,0.05)', borderRadius: 12, border: '1px solid rgba(77,184,232,0.1)' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cyan)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 24, fontFamily: "'Big Shoulders Display',sans-serif" }}>
        Prisfølsomhet
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        {impacts.map((block, idx) => {
          const heatColor = getHeatColor(block.impact)
          const intensity = block.impact / maxImpact

          return (
            <motion.div
              key={idx}
              variants={item}
              style={{
                display: 'grid',
                gridTemplateColumns: '150px 1fr auto',
                gap: 16,
                alignItems: 'center',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {block.name}
              </div>

              <div style={{ position: 'relative', height: 24, background: 'rgba(0,0,0,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                <motion.div
                  style={{
                    height: '100%',
                    background: heatColor,
                    borderRadius: 4,
                    boxShadow: `0 0 12px ${heatColor}40`,
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${block.impact}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, color: heatColor, minWidth: 60, textAlign: 'right' }}>
                {block.impact.toFixed(1)}%
              </div>
            </motion.div>
          )
        })}
      </motion.div>

      <div style={{ marginTop: 20, padding: 12, background: 'rgba(0,0,0,0.1)', borderRadius: 6, fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
        <strong>Tolking:</strong> Høy prosentandel betyr at blokken har størst innvirkning på totalbudsjett. Større variasjoner i prisestimater = høyere risiko.
      </div>
    </div>
  )
}
