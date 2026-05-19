import { motion } from 'framer-motion'

/**
 * EmptyStateReset - shown after user resets a completed estimate
 * Encourages them to start a new analysis
 */
export default function EmptyStateReset({ onNewProject }) {
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
        minHeight: '350px',
        padding: '60px 24px',
        textAlign: 'center',
        background: 'linear-gradient(135deg, rgba(77,184,232,0.05) 0%, rgba(77,184,232,0.02) 100%)',
        borderRadius: 12,
        marginTop: 40,
      }}
    >
      {/* Icon Circle */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'rgba(77,184,232,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 28,
          fontSize: 40,
          border: '2px solid rgba(77,184,232,0.15)',
        }}
      >
        ✨
      </motion.div>

      {/* Heading */}
      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        style={{
          fontSize: 28,
          fontWeight: 900,
          fontFamily: "'Big Shoulders Display', sans-serif",
          color: 'var(--navy)',
          marginBottom: 10,
          letterSpacing: '-0.01em',
        }}
      >
        Klar for nytt prosjekt?
      </motion.h3>

      {/* Subtext */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        style={{
          fontSize: 14,
          color: 'var(--text-dim)',
          maxWidth: 340,
          marginBottom: 24,
          lineHeight: 1.6,
        }}
      >
        Last opp en ny fil eller skriv inn prosjektdetaljer for å estimere neste prosjekt.
      </motion.p>

      {/* CTA Button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        whileHover={{
          scale: 1.05,
          boxShadow: '0 8px 16px rgba(77,184,232,0.15)',
        }}
        whileTap={{ scale: 0.98 }}
        onClick={onNewProject}
        style={{
          padding: '12px 24px',
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "'Big Shoulders Display', sans-serif",
          letterSpacing: '0.05em',
          color: '#fff',
          background: 'var(--cyan)',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: '0 4px 12px rgba(77,184,232,0.15)',
        }}
      >
        NYTT PROSJEKT
      </motion.button>
    </motion.div>
  )
}
