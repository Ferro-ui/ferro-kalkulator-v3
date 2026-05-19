import { useEffect, useRef } from 'react'

export default function Confetti({ trigger }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!trigger) return

    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const ctx = canvas.getContext('2d')

    const confetti = []
    const colors = ['#4DB8E8', '#0D1E35', '#FF9800', '#4DB8E8', '#FFD700']

    for (let i = 0; i < 100; i++) {
      confetti.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        vx: (Math.random() - 0.5) * 8,
        vy: Math.random() * 4 + 4,
        size: Math.random() * 6 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
      })
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      let anyVisible = false
      confetti.forEach((p) => {
        if (p.y < canvas.height) {
          anyVisible = true
          p.x += p.vx
          p.y += p.vy
          p.vy += 0.1 // gravity
          p.rotation += p.rotationSpeed

          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate(p.rotation)
          ctx.fillStyle = p.color
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
          ctx.restore()
        }
      })

      if (anyVisible) {
        requestAnimationFrame(animate)
      } else {
        canvas.style.display = 'none'
      }
    }

    canvas.style.display = 'block'
    animate()
  }, [trigger])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  )
}
