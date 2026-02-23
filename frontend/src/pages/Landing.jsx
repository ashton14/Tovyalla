import { Link } from 'react-router-dom'

const features = [
  { icon: '📊', title: 'Dashboard', desc: 'Real-time overview of your pipeline and key metrics' },
  { icon: '👥', title: 'Customers & Team', desc: 'Manage contacts and your team in one place' },
  { icon: '📁', title: 'Projects & Docs', desc: 'Track projects from lead to completion with document storage' },
  { icon: '🔧', title: 'Subcontractors', desc: 'Assign work, track costs, and manage COIs' },
  { icon: '📅', title: 'Calendar', desc: 'Schedule jobs and sync with Google Calendar' },
  { icon: '📦', title: 'Inventory', desc: 'Stock levels, materials, and equipment tracking' },
  { icon: '💰', title: 'Expenses & Reports', desc: 'Track costs, margins, and generate reports' },
  { icon: '📧', title: 'E-Signatures', desc: 'Send contracts and proposals for electronic signature' },
]

const footerLinks = {
  product: [
    { to: '/register', label: 'Sign Up' },
    { to: '/login', label: 'Sign In' },
    { to: '/contact', label: 'Contact' },
  ],
  legal: [
    { to: '/terms', label: 'Terms of Service' },
    { to: '/privacy', label: 'Privacy Policy' },
    { to: '/refund', label: 'Refund Policy' },
  ],
}

function Landing() {
  return (
    <div className="relative min-h-screen min-h-dvh w-screen overflow-y-auto">
      {/* Header - Sticky */}
      <header className="sticky top-0 z-20 w-full px-4 py-4 sm:px-6 sm:py-5">
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
              className="rounded-lg border border-white/40 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:border-white/60 hover:bg-white/20 hover:shadow-lg"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="rounded-lg bg-gradient-to-r from-pool-blue to-pool-dark px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-pool-blue/25 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-pool-dark/30"
            >
              Sign Up
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10 px-4 pb-16 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <section className="mx-auto max-w-6xl py-16 sm:py-20 lg:py-24">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Complete CRM for Your Business
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-white/80 sm:text-xl">
              Manage customers, projects, employees, and more—all in one powerful platform. Built for teams that move fast.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
              <Link
                to="/register"
                className="w-full rounded-xl bg-gradient-to-r from-pool-blue to-pool-dark px-8 py-4 text-center text-base font-semibold text-white shadow-xl shadow-pool-blue/25 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-pool-dark/30 sm:w-auto"
              >
                Get Started
              </Link>
              <Link
                to="/login"
                className="w-full rounded-xl border-2 border-white/50 bg-white/10 px-8 py-4 text-center text-base font-semibold text-white backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:border-white/80 hover:bg-white/20 sm:w-auto"
              >
                Sign In
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section - Bento style */}
        <section className="mx-auto max-w-6xl py-20 sm:py-24">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Everything you need to run your business
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base text-white/60 sm:text-lg">
              One platform. No spreadsheets. No chaos.
            </p>
          </div>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm transition-all duration-200 hover:border-white/20 hover:bg-white/10"
              >
                <span className="text-2xl">{feature.icon}</span>
                <h3 className="mt-3 font-semibold text-white">{feature.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-white/60">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Social proof / Stats bar */}
        <section className="mx-auto max-w-6xl py-12">
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-center">
            <div>
              <p className="text-2xl font-bold text-white sm:text-3xl">$299</p>
              <p className="text-sm text-white/50">per month</p>
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div>
              <p className="text-2xl font-bold text-white sm:text-3xl">24/5</p>
              <p className="text-sm text-white/50">support</p>
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div>
              <p className="text-2xl font-bold text-white sm:text-3xl">100%</p>
              <p className="text-sm text-white/50">cloud-based</p>
            </div>
          </div>
        </section>

        {/* CTA Section - Full bleed style */}
        <section className="mx-auto max-w-6xl py-20 sm:py-28">
          <div className="relative overflow-hidden rounded-2xl bg-white px-8 py-16 text-center sm:px-12 sm:py-20">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.08),transparent_70%)]" />
            <div className="relative">
              <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl lg:text-4xl">
                Start managing smarter today
              </h2>
              <p className="mx-auto mt-4 max-w-md text-gray-500">
                $299/mo Business Plan. Get started today.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  to="/register"
                  className="w-full rounded-lg bg-gray-900 px-8 py-3.5 text-center font-semibold text-white transition-colors hover:bg-gray-800 sm:w-auto"
                >
                  Create account
                </Link>
                <Link
                  to="/contact"
                  className="w-full rounded-lg border border-gray-200 px-8 py-3.5 text-center font-semibold text-gray-700 transition-colors hover:bg-gray-50 sm:w-auto"
                >
                  Contact Us
                </Link>
              </div>
              
            </div>
          </div>
        </section>
      </main>

      {/* Footer - Multi-column like Stripe/Vercel */}
      <footer className="relative z-10 border-t border-white/10 bg-black/20 py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className="text-sm font-medium text-white/90">Tovyalla CRM</span>
              <p className="mt-1 max-w-xs text-sm text-white/50">
                Complete CRM for pool and spa businesses.
              </p>
            </div>
            <div className="flex gap-12 sm:gap-16">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-white/60">Product</h4>
                <ul className="mt-4 space-y-3">
                  {footerLinks.product.map((link) => (
                    <li key={link.to}>
                      <Link to={link.to} className="text-sm text-white/70 hover:text-white transition-colors">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-white/60">Legal</h4>
                <ul className="mt-4 space-y-3">
                  {footerLinks.legal.map((link) => (
                    <li key={link.to}>
                      <Link to={link.to} className="text-sm text-white/70 hover:text-white transition-colors">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-10 sm:flex-row">
            <p className="text-xs text-white/50">
              © 2026 Tovyalla CRM. All rights reserved.
            </p>
            <p className="text-xs text-white/50">
              $299/mo Business Plan · Mon–Fri 9am–5pm PT
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Landing
