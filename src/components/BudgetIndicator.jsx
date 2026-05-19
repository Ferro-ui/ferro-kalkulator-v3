import { motion } from 'framer-motion'

export default function BudgetIndicator({ current, target, constraints }) {
  if (!target) return null

  const percent = (current / target) * 100
  let status = 'success'
  let statusColor = '#4DB8E8'
  let statusText = 'I budsjett'

  if (percent > 100) {
    status = 'danger'
    statusColor = '#C03030'
    statusText = 'Over budsjett'
  } else if (percent > 85) {
    status = 'warning'
    statusColor = '#FF9800'
    statusText = 'Nærmer seg grense'
  }

  const clampedPercent = Math.min(percent, 100)

  return (
    <div style={{ marginTop: 24, padding: 20, background: 'rgba(13,30,53,0.04)', borderRadius: 12, border: `1px solid ${statusColor}20` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Budsjett Status
        </div>
        <motion.div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: statusColor,
            padding: '4px 10px',
            background: `${statusColor}15`,
            borderRadius: 4,
          }}
          animate={{ scale: status === 'danger' ? [1, 1.05, 1] : 1 }}
          transition={{ duration: status === 'danger' ? 1.5 : 0, repeat: status === 'danger' ? Infinity : 0 }}
        >
          {statusText}
        </motion.div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
          <span>{current.toLocaleString('no-NO')} kr</span>
          <span style={{ color: 'var(--text-dim)' }}>{target.toLocaleString('no-NO')} kr</span>
        </div>
        <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          <motion.div
            style={{
              height: '100%',
              background: statusColor,
              borderRadius: 4,
            }}
            initial={{ width: 0 }}
            animate={{ width: `${clampedPercent}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
        {percent > 100
          ? `${(percent - 100).toFixed(1)}% over budsjett`
          : `${(100 - percent).toFixed(1)}% margin igjen`}
      </div>
    </div>
  )
}
