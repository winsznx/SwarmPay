'use client'
import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, Boxes, Shield, Users, Wallet, LayoutDashboard } from 'lucide-react'

interface HeaderProps {
  displayBalance?: number
  onToggleMobileMenu?: () => void
  isMobileMenuOpen?: boolean
}

export const Header: React.FC<HeaderProps> = ({ 
  displayBalance = 5.00, 
  onToggleMobileMenu,
  isMobileMenuOpen 
}) => {
  const pathname = usePathname()

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-3 h-3" /> },
    { href: '/marketplace', label: 'Marketplace', icon: <Boxes className="w-3 h-3" /> },
    { href: '/agents', label: 'Agents', icon: <Users className="w-3 h-3" /> },
    { href: '/security', label: 'Security', icon: <Shield className="w-3 h-3" /> },
  ]

  return (
    <nav className="border-b border-white/5 bg-slate-950/40 backdrop-blur-2xl sticky top-0 z-[100]">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 h-12 flex items-center justify-between">
        <div className="flex items-center gap-4 md:gap-6">
          {/* Mobile Menu Toggle */}
          <button 
            onClick={onToggleMobileMenu}
            className="lg:hidden p-2 text-slate-400 hover:text-white transition-colors"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
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
          <div className="flex items-center gap-3 px-3 py-1 bg-white/5 border border-white/10 rounded-full">
            <Wallet className="w-3 h-3 text-blue-400" />
            <span className="font-mono text-[11px] font-black tracking-tighter">
              <span className="text-blue-400">$</span>{displayBalance.toFixed(2)} <span className="text-slate-500 ml-0.5 uppercase">USDC</span>
            </span>
          </div>
        </div>
      </div>
    </nav>
  )
}
