import { motion } from 'framer-motion'

export default function EmptyState({ onAction, actionLabel = 'Last opp fil', icon = '📊' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        padding: '60px 24px',
        textAlign: 'center',
      }}
    >
      {/* Icon Circle Background */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        style={{
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(77,184,232,0.15) 0%, rgba(77,184,232,0.05) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 32,
          fontSize: 48,
          border: '2px solid rgba(77,184,232,0.2)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Animated background glow */}
        <motion.div
          animate={{
            boxShadow: [
              '0 0 20px rgba(77,184,232,0.2)',
              '0 0 40px rgba(77,184,232,0.4)',
              '0 0 20px rgba(77,184,232,0.2)',
            ]
          }}
          transition={{ duration: 3, repeat: Infinity }}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
          }}
        />
        <span style={{ position: 'relative', zIndex: 1 }}>{icon}</span>
      </motion.div>

      {/* Heading */}
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        style={{
          fontSize: 32,
          fontWeight: 900,
          fontFamily: "'Big Shoulders Display', sans-serif",
          color: 'var(--navy)',
          marginBottom: 12,
          letterSpacing: '-0.01em',
          lineHeight: 1.2,
        }}
      >
        Ingen estimater ennå
      </motion.h2>

      {/* Subtext */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        style={{
          fontSize: 15,
          color: 'var(--text-dim)',
          maxWidth: 360,
          marginBottom: 32,
          lineHeight: 1.6,
        }}
      >
        Last opp en prosjektfil eller skriv inn detaljer for å få en AI-drevet kostnadsestimering for ditt byggeprosjekt.
      </motion.p>

      {/* Divider */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        style={{
          width: 40,
          height: 2,
          background: 'var(--cyan)',
          borderRadius: 1,
          marginBottom: 32,
        }}
      />

      {/* CTA Button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        whileHover={{
          scale: 1.05,
          boxShadow: '0 12px 24px rgba(77,184,232,0.2)',
        }}
        whileTap={{ scale: 0.98 }}
        onClick={onAction}
        style={{
          padding: '14px 28px',
          fontSize: 14,
          fontWeight: 700,
          fontFamily: "'Big Shoulders Display', sans-serif",
          letterSpacing: '0.05em',
          color: '#fff',
          background: 'var(--cyan)',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: '0 4px 12px rgba(77,184,232,0.15)',
        }}
      >
        {actionLabel}
      </motion.button>

      {/* Optional Help Text */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45, duration: 0.4 }}
        style={{
          marginTop: 24,
          fontSize: 12,
          color: 'var(--text-dim)',
        }}
      >
        eller <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>velg eksempel</span> for å komme i gang
      </motion.div>
    </motion.div>
  )
}
