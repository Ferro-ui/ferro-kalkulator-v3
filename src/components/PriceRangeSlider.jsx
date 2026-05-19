import { useState } from 'react'
import { motion } from 'framer-motion'

export default function PriceRangeSlider({ min, max, onChange, label }) {
  const [localMin, setLocalMin] = useState(min)
  const [localMax, setLocalMax] = useState(max)

  const handleMinChange = (e) => {
    const newMin = Math.min(Number(e.target.value), localMax - 1000)
    setLocalMin(newMin)
    onChange({ min: newMin, max: localMax })
  }

  const handleMaxChange = (e) => {
    const newMax = Math.max(Number(e.target.value), localMin + 1000)
    setLocalMax(newMax)
    onChange({ min: localMin, max: newMax })
  }

  const range = max - min
  const minPercent = ((localMin - min) / range) * 100
  const maxPercent = ((localMax - min) / range) * 100

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.05em', marginBottom: 12, textTransform: 'uppercase' }}>
        {label}
      </div>
      
      <div style={{ position: 'relative', height: 60, marginBottom: 20 }}>
        {/* Track */}
        <div style={{
          position: 'absolute',
          top: 24,
          left: 0,
          right: 0,
          height: 6,
          background: 'var(--border)',
          borderRadius: 3,
        }} />
        
        {/* Active range */}
        <motion.div
          style={{
            position: 'absolute',
            top: 24,
            left: `${minPercent}%`,
            right: `${100 - maxPercent}%`,
            height: 6,
            background: 'var(--cyan)',
            borderRadius: 3,
          }}
          animate={{ left: `${minPercent}%`, right: `${100 - maxPercent}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
        
        {/* Min slider */}
        <input
          type="range"
          min={min}
          max={max}
          value={localMin}
          onChange={handleMinChange}
          style={{
            position: 'absolute',
            top: 18,
            left: 0,
            right: 0,
            width: '100%',
            zIndex: 5,
            appearance: 'none',
            background: 'transparent',
            pointerEvents: 'none',
          }}
        />
        
        {/* Max slider */}
        <input
          type="range"
          min={min}
          max={max}
          value={localMax}
          onChange={handleMaxChange}
          style={{
            position: 'absolute',
            top: 18,
            left: 0,
            right: 0,
            width: '100%',
            zIndex: 6,
            appearance: 'none',
            background: 'transparent',
            pointerEvents: 'none',
          }}
        />
        
        {/* Labels */}
        <div style={{ position: 'absolute', top: 0, left: 0, fontSize: 13, fontWeight: 700, color: 'var(--cyan)' }}>
          {localMin.toLocaleString('no-NO')} kr
        </div>
        <div style={{ position: 'absolute', top: 0, right: 0, fontSize: 13, fontWeight: 700, color: 'var(--cyan)' }}>
          {localMax.toLocaleString('no-NO')} kr
        </div>
      </div>

      <style>{`
        input[type="range"] {
          pointer-events: all;
        }
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 18px;
          height: 18px;
          background: var(--cyan);
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(77, 184, 232, 0.3);
          transition: all 0.2s ease;
        }
        input[type="range"]::-webkit-slider-thumb:hover {
          width: 22px;
          height: 22px;
          box-shadow: 0 4px 16px rgba(77, 184, 232, 0.5);
        }
        input[type="range"]::-moz-range-thumb {
          width: 18px;
          height: 18px;
          background: var(--cyan);
          border-radius: 50%;
          border: none;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(77, 184, 232, 0.3);
          transition: all 0.2s ease;
        }
        input[type="range"]::-moz-range-thumb:hover {
          width: 22px;
          height: 22px;
          box-shadow: 0 4px 16px rgba(77, 184, 232, 0.5);
        }
      `}</style>
    </div>
  )
}
