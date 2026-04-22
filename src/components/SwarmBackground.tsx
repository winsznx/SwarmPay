'use client'

export function SwarmBackground() {
  return (
    <div className="fixed inset-0 z-0 bg-gray-950 pointer-events-none">
      {/* Replaced Swarm with a clean, high-performance gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(30,58,138,0.15)_0%,rgba(0,0,0,0)_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(88,28,135,0.05)_0%,rgba(0,0,0,0)_50%)]" />
    </div>
  )
}
