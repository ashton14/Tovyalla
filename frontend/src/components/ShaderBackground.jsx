import { useEffect, useState } from 'react'

const ShaderBackground = () => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="absolute inset-0 -z-10 w-full h-full overflow-hidden" aria-hidden="true">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      
      {/* Animated aurora layers - all constantly pulsing */}
      <div 
        className={`absolute inset-0 transition-opacity duration-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}
      >
        {/* Large cyan pulse - center left */}
        <div 
          className="absolute -inset-[30%] animate-aurora-pulse-1"
          style={{
            background: 'radial-gradient(ellipse 70% 55% at 35% 50%, rgba(14, 165, 233, 0.4) 0%, transparent 55%)',
          }}
        />
        
        {/* Blue pulse - top right */}
        <div 
          className="absolute -inset-[40%] animate-aurora-pulse-2"
          style={{
            animationDelay: '-1s',
            background: 'radial-gradient(ellipse 60% 50% at 70% 35%, rgba(59, 130, 246, 0.35) 0%, transparent 50%)',
          }}
        />
        
        {/* Teal pulse - bottom center */}
        <div 
          className="absolute -inset-[35%] animate-aurora-pulse-3"
          style={{
            animationDelay: '-2s',
            background: 'radial-gradient(ellipse 55% 45% at 50% 65%, rgba(20, 184, 166, 0.3) 0%, transparent 50%)',
          }}
        />

        {/* Purple pulse - top left */}
        <div 
          className="absolute -inset-[25%] animate-aurora-pulse-4"
          style={{
            animationDelay: '-0.5s',
            background: 'radial-gradient(ellipse 50% 40% at 30% 30%, rgba(139, 92, 246, 0.25) 0%, transparent 45%)',
          }}
        />

        {/* Cyan highlight pulse - center */}
        <div 
          className="absolute -inset-[20%] animate-aurora-pulse-2"
          style={{
            animationDelay: '-1.5s',
            background: 'radial-gradient(ellipse 45% 35% at 55% 50%, rgba(34, 211, 238, 0.25) 0%, transparent 40%)',
          }}
        />

        {/* Deep blue drift - background layer */}
        <div 
          className="absolute -inset-[50%] animate-aurora-drift"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(30, 64, 175, 0.2) 0%, transparent 55%)',
          }}
        />

        {/* Secondary teal pulse - offset timing */}
        <div 
          className="absolute -inset-[30%] animate-aurora-pulse-1"
          style={{
            animationDelay: '-2s',
            background: 'radial-gradient(ellipse 50% 40% at 65% 55%, rgba(6, 182, 212, 0.3) 0%, transparent 45%)',
          }}
        />

        {/* Bright accent pulse */}
        <div 
          className="absolute -inset-[20%] animate-aurora-pulse-4"
          style={{
            animationDelay: '-1.75s',
            background: 'radial-gradient(ellipse 40% 30% at 45% 40%, rgba(56, 189, 248, 0.2) 0%, transparent 40%)',
          }}
        />
      </div>

      {/* Subtle grain texture */}
      <div 
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Vignettes */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
    </div>
  )
}

export default ShaderBackground
