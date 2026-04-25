'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, Boxes, Shield, Users, Wallet, LayoutDashboard, RefreshCw, Activity } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface HeaderProps {
  displayBalance?: number
  onToggleMobileMenu?: () => void
  isMobileMenuOpen?: boolean
}

export const Header: React.FC<HeaderProps> = ({ 
  displayBalance = 5.00, 
  onToggleMobileMenu: externalToggle,
  isMobileMenuOpen: externalState
}) => {
  const pathname = usePathname()
  const [localOpen, setLocalOpen] = useState(false)
  
  // Use external state if controlled, otherwise use local
  const isOpen = externalState !== undefined ? externalState : localOpen
  const toggle = externalToggle || (() => setLocalOpen(!localOpen))

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4 md:w-3 md:h-3" /> },
    { href: '/why', label: 'Why SwarmPay', icon: <img src="/icon.png" className="w-4 h-4 md:w-3 md:h-3" /> },
    { href: '/marketplace', label: 'Marketplace', icon: <Boxes className="w-4 h-4 md:w-3 md:h-3" /> },
    { href: '/agents', label: 'Agents', icon: <Users className="w-4 h-4 md:w-3 md:h-3" /> },
    { href: '/security', label: 'Security', icon: <Shield className="w-4 h-4 md:w-3 md:h-3" /> },
  ]

  return (
    <>
      <nav className={`border-b border-white/5 bg-slate-950/40 backdrop-blur-2xl z-[100] ${
        pathname === '/dashboard' ? 'sticky top-0' : 'fixed top-0 left-0 right-0'
      }`}>
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 h-12 flex items-center justify-between">
          <div className="flex items-center gap-4 md:gap-6">
            {/* Mobile Menu Toggle */}
            <button 
              onClick={toggle}
              className="lg:hidden p-2 text-slate-400 hover:text-white transition-colors"
            >
              {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <Link href="/" className="flex items-center gap-3 group">
              <img 
                src="/icon.png" 
                alt="SwarmPay" 
                className="w-8 h-8 drop-shadow-[0_0_10px_rgba(59,130,246,0.3)] group-hover:scale-110 transition-transform" 
              />
              <div className="flex flex-col leading-none">
                <span className="font-black text-[11px] uppercase tracking-[0.2em] text-white">SwarmPay</span>
                <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest mt-0.5">Node v1.2</span>
              </div>
            </Link>
            
            <div className="h-4 w-px bg-white/10 hidden lg:block" />
            
            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-6">
              {navLinks.map((link) => (
                <Link 
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${
                    pathname === link.href 
                      ? 'text-blue-400' 
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {link.icon} {link.label}
                </Link>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-4 md:gap-6">
            <div className="hidden sm:flex items-center gap-2">
               <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
               <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Network Live</span>
            </div>

            {pathname === '/dashboard' && (
              <div className="flex items-center gap-3 px-3 py-1 bg-white/5 border border-white/10 rounded-full group/wallet">
                <button 
                  onClick={async () => {
                    const btn = document.getElementById('sync-icon');
                    if (btn) btn.classList.add('animate-spin');
                    await fetch('/api/agents');
                    if (btn) setTimeout(() => btn.classList.remove('animate-spin'), 1000);
                  }}
                  className="p-1 hover:bg-white/5 rounded-full transition-colors"
                  title="Sync on-chain balance"
                >
                   <RefreshCw id="sync-icon" className="w-3 h-3 text-slate-500 hover:text-blue-400 transition-colors" />
                </button>
                <div className="h-3 w-px bg-white/10" />
                <Wallet className="w-3 h-3 text-blue-400" />
                <span className="font-mono text-[11px] font-black tracking-tighter">
                  <span className="text-blue-400">$</span>{displayBalance.toFixed(2)} <span className="text-slate-500 ml-0.5 uppercase">USDC</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* MOBILE DRAWER */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => externalToggle ? externalToggle() : setLocalOpen(false)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[150] lg:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-[280px] bg-[#020617] border-r border-white/10 z-[200] lg:hidden shadow-2xl"
            >
              <div className="p-6 h-full flex flex-col gap-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src="/icon.png" alt="SwarmPay" className="w-8 h-8" />
                    <span className="font-black text-xs uppercase tracking-widest text-white">SwarmPay</span>
                  </div>
                  <button onClick={() => externalToggle ? externalToggle() : setLocalOpen(false)}>
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                <div className="space-y-4">
                  {navLinks.map((item, i) => (
                    <Link 
                      key={i} 
                      href={item.href}
                      onClick={() => externalToggle ? externalToggle() : setLocalOpen(false)}
                      className={`flex items-center gap-4 text-sm font-black uppercase tracking-widest transition-colors hover:text-blue-400 group 
                        ${pathname === item.href ? 'text-blue-400' : 'text-slate-400'}
                      `}
                    >
                      <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-blue-600/20 transition-colors">
                        {item.icon}
                      </span>
                      {item.label}
                    </Link>
                  ))}
                    <Link 
                      href="/dashboard"
                      onClick={() => externalToggle ? externalToggle() : setLocalOpen(false)}
                      className={`flex items-center gap-4 text-sm font-black uppercase tracking-widest transition-colors hover:text-blue-400 group 
                        ${pathname === '/dashboard' ? 'text-blue-400' : 'text-slate-400'}
                      `}
                    >
                      <span className="w-8 h-8 rounded-lg bg-blue-600/10 flex items-center justify-center group-hover:bg-blue-600/20 transition-colors">
                        <Activity className="w-4 h-4 text-blue-400" />
                      </span>
                      Mission Records
                    </Link>
                    <div className="flex items-center gap-4 text-sm font-black text-slate-400 uppercase tracking-widest opacity-50 cursor-not-allowed">
                      <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                        <RefreshCw className="w-4 h-4" />
                      </span>
                      Network Stats
                    </div>
                  </div>
                
                <div className="mt-auto pt-6 border-t border-white/5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                      <span className="text-[10px] text-slate-400 font-black tracking-widest uppercase">Node Fully Operational</span>
                    </div>
                    <div className="mt-2 text-[10px] font-mono font-bold text-slate-600">Arc Network v1.2.4</div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
