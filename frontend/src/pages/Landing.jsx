import { Link } from 'react-router-dom'

const features = [
  { icon: '📊', text: 'Complete CRM Dashboard' },
  { icon: '👥', text: 'Customer & Employee Management' },
  { icon: '📁', text: 'Project Tracking & Documents' },
  { icon: '🔧', text: 'Subcontractor Management' },
  { icon: '📅', text: 'Calendar & Scheduling' },
  { icon: '📦', text: 'Inventory Management' },
  { icon: '💰', text: 'Expense Tracking & Reporting' },
  { icon: '📧', text: 'Integrated Email and Esignatures System' },
]

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

        {/* Features Section */}
        <section className="mx-auto max-w-6xl py-16 sm:py-20">
          <h2 className="text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Everything You Need
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-white/70">
            A full-featured CRM designed for modern businesses.
          </p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group rounded-2xl border border-white/20 bg-white/95 p-6 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:border-white/30 hover:shadow-2xl hover:shadow-pool-blue/10"
              >
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-pool-light text-2xl transition-colors group-hover:bg-pool-blue/20">
                  {feature.icon}
                </div>
                <p className="font-semibold text-gray-900">{feature.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Business Details Section */}
        <section className="mx-auto max-w-6xl py-16 sm:py-20">
          <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/95 shadow-2xl backdrop-blur-sm">
            <div className="bg-gradient-to-r from-pool-blue to-pool-dark px-6 py-5 sm:px-8 sm:py-6">
              <h2 className="text-2xl font-bold text-white sm:text-3xl">
                Contact & Support
              </h2>
              <p className="mt-1 text-white/80">
                We're here to help your business succeed.
              </p>
            </div>
            <div className="grid gap-8 p-6 sm:grid-cols-2 lg:grid-cols-4 sm:p-8">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Email</h3>
                <a
                  href="mailto:support@tovyalla.com"
                  className="mt-1 block text-pool-blue hover:text-pool-dark font-semibold underline transition-colors"
                >
                  support@tovyalla.com
                </a>
              </div>
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Address</h3>
                <p className="mt-1 font-medium text-gray-900">
                  2949 Heavenly Ridge Street<br />
                  Thousand Oaks, CA 91362
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Support Hours</h3>
                <p className="mt-1 font-medium text-gray-900">
                  Mon–Fri, 9:00 AM – 5:00 PM PT
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Pricing</h3>
                <p className="mt-1 font-medium text-gray-900">
                  $299/mo Business Plan
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="mx-auto max-w-6xl py-16 sm:py-20">
          <div className="rounded-2xl border border-white/20 bg-white/95 p-8 text-center backdrop-blur-sm sm:p-12">
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              Ready to Get Started?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-gray-600">
              Join businesses that trust Tovyalla CRM to manage their operations.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
              <Link
                to="/register"
                className="w-full rounded-xl bg-gradient-to-r from-pool-blue to-pool-dark px-8 py-4 text-center font-semibold text-white shadow-lg shadow-pool-blue/25 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl sm:w-auto"
              >
                Create Account
              </Link>
              <Link
                to="/contact"
                className="w-full rounded-xl border border-gray-300 bg-gray-50 px-8 py-4 text-center font-semibold text-gray-700 transition-all duration-300 hover:scale-[1.02] hover:bg-gray-100 sm:w-auto"
              >
                Contact Us
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 py-8">
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

export default Landing
