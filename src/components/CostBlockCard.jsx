import { useState } from 'react'
import { motion } from 'framer-motion'
import PriceRangeSlider from './PriceRangeSlider'
import AnimatedCounter from './AnimatedCounter'

/**
 * CostBlockCard - Modern, interactive cost block component
 * Replaces old block rendering with improved visual design
 */
export default function CostBlockCard({ block, index, onChange }) {
  const [expanded, setExpanded] = useState(false)

  // Icon mapping for different block types
  const getBlockIcon = () => {
    const name = block.name?.toLowerCase() || ''
    if (name.includes('stål') || name.includes('steel')) return '🏗️'
    if (name.includes('rig') || name.includes('arbeid') || name.includes('labour')) return '👷'
    if (name.includes('material')) return '📦'
    if (name.includes('transport')) return '🚚'
    if (name.includes('sikk') || name.includes('safety')) return '⚠️'
    if (name.includes('pris') || name.includes('price')) return '💰'
    return '🔧'
  }

  // Confidence color mapping
  const getConfidenceColor = (conf) => {
    const c = parseInt(conf) || 0
    if (c >= 80) return '#0D7A52' // success
    if (c >= 60) return '#C48B00' // warning
    return '#B56B0A' // warning/danger
  }

  const confColor = getConfidenceColor(block.confidence)
  const icon = getBlockIcon()

  const handlePriceLowChange = (newVal) => {
    onChange({
      ...block,
      priceFrom: newVal,
      price_low: newVal, // keep both for compatibility
    })
  }

  const handlePriceHighChange = (newVal) => {
    onChange({
      ...block,
      priceTo: newVal,
      price_high: newVal, // keep both for compatibility
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      style={{
        borderRadius: 12,
        border: '1px solid rgba(77,184,232,0.15)',
        background: '#fff',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(13,30,53,0.06)',
        transition: 'all 0.2s ease',
      }}
      onHoverStart={{ boxShadow: '0 8px 20px rgba(13,30,53,0.12)' }}
    >
      {/* Header with Icon and Info */}
      <div
        style={{
          padding: '16px 18px',
          background: 'linear-gradient(135deg, rgba(77,184,232,0.03) 0%, rgba(77,184,232,0.01) 100%)',
          borderBottom: '1px solid rgba(77,184,232,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          justifyContent: 'space-between',
        }}
      >
        {/* Icon + Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(77,184,232,0.1) 0%, rgba(77,184,232,0.05) 100%)',
              border: '2px solid rgba(77,184,232,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: 'var(--navy)',
                fontFamily: "'Big Shoulders Display', sans-serif",
                marginBottom: 4,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {block.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              #{String(index + 1).padStart(2, '0')}
            </div>
          </div>
        </div>

        {/* Confidence Badge */}
        <div
          style={{
            padding: '6px 12px',
            borderRadius: 8,
            background: confColor + '14',
            border: `1px solid ${confColor}30`,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: confColor,
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 700, color: confColor, fontFamily: "'Big Shoulders Display', sans-serif" }}>
            {block.confidence || '?'}%
          </span>
        </div>

        {/* Expand Button */}
        <motion.button
          onClick={() => setExpanded(!expanded)}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: '1px solid rgba(77,184,232,0.2)',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--cyan)',
            transition: 'all 0.2s',
            flexShrink: 0,
          }}
          whileHover={{ background: 'rgba(77,184,232,0.1)' }}
          whileTap={{ scale: 0.95 }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M2 5l5 5 5-5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.button>
      </div>

      {/* Price Display */}
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid rgba(77,184,232,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Estimat
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
                color: 'var(--cyan)',
              }}
            >
              <AnimatedCounter to={block.priceFrom || block.price_low || 0} duration={0.8} />
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>–</span>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
                color: 'var(--navy)',
              }}
            >
              <AnimatedCounter to={block.priceTo || block.price_high || 0} duration={0.8} />
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>kr</span>
          </div>
        </div>

        {/* Markup % */}
        {block.paslag_pct !== undefined && (
          <div
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              background: 'rgba(77,184,232,0.08)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2, fontWeight: 600 }}>Påslag</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--cyan)', fontFamily: "'JetBrains Mono', monospace" }}>
              {block.paslag_pct}%
            </div>
          </div>
        )}
      </div>

      {/* Price Range Slider */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(77,184,232,0.1)' }}>
        <PriceRangeSlider
          min={(block.priceFrom || block.price_low || 0) * 0.8}
          max={(block.priceTo || block.price_high || 0) * 1.2}
          onChange={(range) =>
            onChange({
              ...block,
              priceFrom: range.min,
              priceTo: range.max,
              price_low: range.min,
              price_high: range.max,
            })
          }
          label="Justér prisintervall"
        />
      </div>

      {/* Expanded Details */}
      <motion.div
        initial={false}
        animate={{ height: expanded ? 'auto' : 0, opacity: expanded ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        style={{ overflow: 'hidden' }}
      >
        <div style={{ padding: '12px 18px', background: 'rgba(77,184,232,0.03)' }}>
          {block.assumptions && block.assumptions.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--cyan)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 6,
                }}
              >
                Antakelser
              </div>
              {block.assumptions.map((assumption, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4, display: 'flex', gap: 8 }}>
                  <span style={{ color: 'var(--cyan)', opacity: 0.6, marginTop: 2 }}>◆</span>
                  {assumption}
                </div>
              ))}
            </div>
          )}

          {block.missing_info && block.missing_info.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#B56B0A',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 6,
                }}
              >
                Manglende Informasjon
              </div>
              {block.missing_info.map((info, i) => (
                <div key={i} style={{ fontSize: 12, color: '#B56B0A', marginBottom: 4, display: 'flex', gap: 8 }}>
                  <span style={{ opacity: 0.6, marginTop: 2 }}>▲</span>
                  {info}
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
