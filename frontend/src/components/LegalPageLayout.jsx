import { Link } from 'react-router-dom'

export default function LegalPageLayout({ title, subtitle, children }) {
  return (
    <div className="relative min-h-screen min-h-dvh w-screen overflow-y-auto">
      {/* Header */}
      <header className="sticky top-0 z-20 w-full px-4 py-4 sm:px-6 sm:py-5 backdrop-blur-md bg-slate-950/60 border-b border-white/5">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link to="/" className="flex flex-col items-center">
            <img src="/tovyalla_logo.png" alt="Tovyalla CRM" className="h-14 sm:h-16 lg:h-20 w-auto" />
            <span className="text-white/80 font-light text-xs sm:text-sm mt-0.5">
              Customer Relationship Management
            </span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/login"
              className="rounded-lg border border-white/40 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:border-white/60 hover:bg-white/20"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="rounded-lg bg-gradient-to-r from-pool-blue to-pool-dark px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-pool-blue/25 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl"
            >
              Sign Up
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10 px-4 py-12 sm:px-6 lg:px-8 pb-20">
        <div className="mx-auto max-w-4xl">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-white/80 hover:text-white transition-colors mb-8 group"
          >
            <span className="group-hover:-translate-x-1 transition-transform">←</span>
            Back to Home
          </Link>

          <div className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl shadow-2xl overflow-hidden">
            <div className="border-b border-white/10 bg-white/5 px-8 py-10 sm:px-12 sm:py-12">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                {title}
              </h1>
              <p className="mt-2 text-lg text-white/70">
                {subtitle}
              </p>
            </div>
            <div className="p-8 sm:p-12">
              {children}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 py-8 mt-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-white/60">
              <Link to="/terms" className="hover:text-white/80 underline transition-colors">
                Terms of Service
              </Link>
              <span>•</span>
              <Link to="/privacy" className="hover:text-white/80 underline transition-colors">
                Privacy Policy
              </Link>
              <span>•</span>
              <Link to="/refund" className="hover:text-white/80 underline transition-colors">
                Refund Policy
              </Link>
              <span>•</span>
              <Link to="/contact" className="hover:text-white/80 underline transition-colors">
                Contact
              </Link>
            </div>
            <p className="text-xs text-white/60">
              © 2026 Tovyalla CRM. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
