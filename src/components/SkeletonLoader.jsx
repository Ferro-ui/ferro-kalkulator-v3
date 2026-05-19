import { motion } from 'framer-motion'

export default function SkeletonLoader() {
  const pulse = {
    opacity: [0.6, 1, 0.6],
    transition: { duration: 1.5, repeat: Infinity }
  }

  return (
    <div style={{ marginTop: 40, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
      {[1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          style={{
            background: 'var(--bg-card)',
            borderRadius: 12,
            padding: 24,
            border: '1px solid var(--border)',
            height: 200,
          }}
          animate={pulse}
        >
          <div style={{ height: 20, background: 'var(--border)', borderRadius: 4, marginBottom: 16 }} />
          <div style={{ height: 24, background: 'var(--border)', borderRadius: 4, marginBottom: 20 }} />
          <div style={{ height: 16, background: 'var(--border)', borderRadius: 4, marginBottom: 12 }} />
          <div style={{ height: 16, background: 'var(--border)', borderRadius: 4 }} />
        </motion.div>
      ))}
    </div>
  )
}
