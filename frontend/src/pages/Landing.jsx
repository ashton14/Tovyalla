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
      <header className="sticky top-0 z-20 w-full px-4 py-3 sm:px-6 sm:py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <Link to="/" className="flex min-w-0 shrink items-center gap-2 sm:flex-col sm:items-center sm:gap-0">
            <img src="/tovyalla_logo.png" alt="Tovyalla CRM" className="h-10 w-auto shrink-0 sm:h-16 lg:h-20" />
            <span className="hidden text-white/80 font-light text-xs sm:mt-0.5 sm:block sm:text-sm">
              Customer Relationship Management
            </span>
          </Link>
          <nav className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              to="/login"
              className="min-h-[44px] min-w-[44px] rounded-lg border border-white/40 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:border-white/60 hover:bg-white/20 hover:shadow-lg flex items-center justify-center"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="min-h-[44px] min-w-[44px] rounded-lg bg-gradient-to-r from-pool-blue to-pool-dark px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pool-blue/25 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-pool-dark/30 flex items-center justify-center"
            >
              Sign Up
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10 px-4 pb-16 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <section className="mx-auto max-w-6xl py-12 sm:py-20 lg:py-24">
          <div className="text-center px-1">
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              Complete CRM for Your Business
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/80 sm:mt-6 sm:text-lg sm:leading-relaxed lg:text-xl">
              Manage customers, projects, employees, and more—all in one powerful platform. Built for teams that move fast.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:mt-10 sm:flex-row sm:justify-center sm:gap-6">
              <Link
                to="/register"
                className="w-full min-h-[48px] rounded-xl bg-gradient-to-r from-pool-blue to-pool-dark px-8 py-3.5 text-center text-base font-semibold text-white shadow-xl shadow-pool-blue/25 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-pool-dark/30 flex items-center justify-center sm:w-auto"
              >
                Get Started
              </Link>
              <Link
                to="/login"
                className="w-full min-h-[48px] rounded-xl border-2 border-white/50 bg-white/10 px-8 py-3.5 text-center text-base font-semibold text-white backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:border-white/80 hover:bg-white/20 flex items-center justify-center sm:w-auto"
              >
                Sign In
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section - Bento style */}
        <section className="mx-auto max-w-6xl py-14 sm:py-24">
          <div className="text-center px-1">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">
              Everything you need to run your business
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-white/60 sm:mt-3 sm:text-base lg:text-lg">
              One platform. No spreadsheets. No chaos.
            </p>
          </div>
          <div className="mt-10 grid gap-3 sm:mt-14 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-all duration-200 hover:border-white/20 hover:bg-white/10 sm:p-5"
              >
                <span className="text-xl sm:text-2xl">{feature.icon}</span>
                <h3 className="mt-2 text-base font-semibold text-white sm:mt-3">{feature.title}</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-white/60 sm:mt-1 sm:text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Social proof / Stats bar */}
        <section className="mx-auto max-w-6xl py-10 sm:py-12">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-6 text-center sm:gap-x-12 sm:gap-y-4">
            <div>
              <p className="text-xl font-bold text-white sm:text-3xl">$299</p>
              <p className="text-xs text-white/50 sm:text-sm">per month</p>
            </div>
            <div className="hidden h-8 w-px bg-white/20 sm:block" />
            <div>
              <p className="text-xl font-bold text-white sm:text-3xl">24/5</p>
              <p className="text-xs text-white/50 sm:text-sm">support</p>
            </div>
            <div className="hidden h-8 w-px bg-white/20 sm:block" />
            <div>
              <p className="text-xl font-bold text-white sm:text-3xl">100%</p>
              <p className="text-xs text-white/50 sm:text-sm">cloud-based</p>
            </div>
          </div>
        </section>

        {/* CTA Section - Full bleed style */}
        <section className="mx-auto max-w-6xl py-14 sm:py-28">
          <div className="relative overflow-hidden rounded-xl bg-white px-6 py-12 text-center sm:rounded-2xl sm:px-12 sm:py-20">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.08),transparent_70%)]" />
            <div className="relative">
              <h2 className="text-xl font-bold text-gray-900 sm:text-3xl lg:text-4xl">
                Start managing smarter today
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm text-gray-500 sm:mt-4 sm:text-base">
                $299/mo Business Plan. Get started today.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:justify-center sm:gap-4">
                <Link
                  to="/register"
                  className="w-full min-h-[48px] rounded-lg bg-gray-900 px-8 py-3.5 text-center font-semibold text-white transition-colors hover:bg-gray-800 flex items-center justify-center sm:w-auto"
                >
                  Create account
                </Link>
                <Link
                  to="/contact"
                  className="w-full min-h-[48px] rounded-lg border border-gray-200 px-8 py-3.5 text-center font-semibold text-gray-700 transition-colors hover:bg-gray-50 flex items-center justify-center sm:w-auto"
                >
                  Contact Us
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer - Multi-column like Stripe/Vercel */}
      <footer className="relative z-10 border-t border-white/10 bg-black/20 py-10 sm:py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between sm:gap-10">
            <div className="text-center sm:text-left">
              <span className="text-sm font-medium text-white/90">Tovyalla CRM</span>
              <p className="mt-1 max-w-xs text-xs text-white/50 sm:text-sm">
                Complete CRM for contractors.
              </p>
            </div>
            <div className="flex justify-center gap-12 sm:justify-start sm:gap-16">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-white/60">Product</h4>
                <ul className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
                  {footerLinks.product.map((link) => (
                    <li key={link.to}>
                      <Link to={link.to} className="block py-1 text-sm text-white/70 hover:text-white transition-colors min-h-[36px] flex items-center sm:min-h-0 sm:py-0">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-white/60">Legal</h4>
                <ul className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
                  {footerLinks.legal.map((link) => (
                    <li key={link.to}>
                      <Link to={link.to} className="block py-1 text-sm text-white/70 hover:text-white transition-colors min-h-[36px] flex items-center sm:min-h-0 sm:py-0">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-8 text-center sm:mt-10 sm:flex-row sm:gap-4 sm:pt-10">
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
