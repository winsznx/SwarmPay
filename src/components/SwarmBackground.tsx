'use client'
import { useEffect, useRef } from 'react'

export function SwarmBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = canvas.width = window.innerWidth
    let h = canvas.height = window.innerHeight

    const particles: Particle[] = []
    const particleCount = 45
    const connectionDistance = 120

    class Particle {
      x: number
      y: number
      vx: number
      vy: number
      size: number

      constructor() {
        this.x = Math.random() * w
        this.y = Math.random() * h
        this.vx = (Math.random() - 0.5) * 0.4
        this.vy = (Math.random() - 0.5) * 0.4
        this.size = Math.random() * 1.5 + 0.5
      }

      update() {
        this.x += this.vx
        this.y += this.vy
        if (this.x < 0 || this.x > w) this.vx *= -1
        if (this.y < 0 || this.y > h) this.vy *= -1
      }

      draw() {
        if (!ctx) return
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(59, 130, 246, 0.4)'
        ctx.fill()
      }
    }

    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle())
    }

    let rafId = 0
    let paused = document.visibilityState === 'hidden'

    const animate = () => {
      if (paused) { rafId = 0; return }
      ctx.clearRect(0, 0, w, h)

      particles.forEach((p, i) => {
        p.update()
        p.draw()

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j]
          const dx = p.x - p2.x
          const dy = p.y - p2.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < connectionDistance) {
            ctx.beginPath()
            ctx.strokeStyle = `rgba(59, 130, 246, ${(1 - dist / connectionDistance) * 0.15})`
            ctx.lineWidth = 0.5
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.stroke()
          }
        }
      })
      rafId = requestAnimationFrame(animate)
    }

    animate()

    const handleResize = () => {
      w = canvas.width = window.innerWidth
      h = canvas.height = window.innerHeight
    }
    const handleVisibility = () => {
      paused = document.visibilityState === 'hidden'
      if (!paused && rafId === 0) animate()
    }

    window.addEventListener('resize', handleResize)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      paused = true
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  return (
    <div className="fixed inset-0 z-0 bg-gray-950 pointer-events-none">
      {/* High-Fidelity Mesh Swarm */}
      <canvas ref={canvasRef} className="absolute inset-0 opacity-60" />
      
      {/* Echo Radial Gradients */}
      <div className="absolute inset-x-0 top-0 h-screen bg-[radial-gradient(circle_at_50%_40%,rgba(30,58,138,0.1)_0%,rgba(0,0,0,0)_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(88,28,135,0.03)_0%,rgba(0,0,0,0)_50%)]" />
      
      {/* Subtle Grid Echo */}
      <div 
        className="absolute inset-0 opacity-[0.03]" 
        style={{ 
          backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
          backgroundSize: '100px 100px'
        }} 
      />
    </div>
  )
}
