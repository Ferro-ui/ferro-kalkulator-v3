import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

export default function AnimatedCounter({ from = 0, to, duration = 2, format = (n) => n.toLocaleString('no-NO') }) {
  const [count, setCount] = useState(from)

  useEffect(() => {
    const start = Date.now()
    const interval = setInterval(() => {
      const progress = (Date.now() - start) / (duration * 1000)
      if (progress >= 1) {
        setCount(to)
        clearInterval(interval)
      } else {
        const current = from + (to - from) * progress
        setCount(Math.floor(current))
      }
    }, 16)
    return () => clearInterval(interval)
  }, [to, duration, from])

  return (
    <motion.span
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      {format(count)}
    </motion.span>
  )
}
