import { Link } from 'react-router-dom'
import LegalPageLayout from '../components/LegalPageLayout'

function ContactCard({ icon, title, children }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6 hover:bg-white/[0.08] hover:border-white/20 transition-all duration-300">
      <div className="flex items-start gap-4">
        <span className="flex-shrink-0 w-12 h-12 rounded-xl bg-pool-blue/20 text-pool-blue flex items-center justify-center text-2xl">
          {icon}
        </span>
        <div>
          <h3 className="font-semibold text-white mb-2">{title}</h3>
          <div className="text-white/80 leading-relaxed [&>a]:text-pool-blue [&>a]:hover:text-pool-light [&>a]:underline [&>a]:transition-colors">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

function Contact() {
  return (
    <LegalPageLayout
      title="Contact Us"
      subtitle="Get in touch with our support team—we're here to help."
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <ContactCard
          icon="✉️"
          title="Email Support"
        >
          <p className="mb-3">
            For general inquiries, support requests, or questions about our services:
          </p>
          <a href="mailto:support@tovyalla.com">support@tovyalla.com</a>
        </ContactCard>

        <ContactCard
          icon="📍"
          title="Business Address"
        >
          <p className="mb-2">Our business address:</p>
          <p className="font-medium text-white/90">
            2949 Heavenly Ridge Street<br />
            Thousand Oaks, CA 91362
          </p>
        </ContactCard>

        <ContactCard
          icon="⏱️"
          title="Response Time"
        >
          <p>
            We aim to respond to all inquiries within 24-48 hours during business days. For urgent matters, please indicate "URGENT" in your email subject line.
          </p>
        </ContactCard>

        <ContactCard
          icon="🕐"
          title="Support Hours"
        >
          <p>
            Our support team is available Monday through Friday, 9:00 AM to 5:00 PM Pacific Time.
          </p>
        </ContactCard>
      </div>

      <div className="mt-10 rounded-xl border border-pool-blue/30 bg-pool-blue/10 p-6 text-center">
        <p className="text-white/90 mb-4">
          Ready to get started? Create an account and experience the full power of Tovyalla CRM.
        </p>
        <Link
          to="/register"
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-pool-blue to-pool-dark px-6 py-3 font-semibold text-white shadow-lg shadow-pool-blue/25 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl"
        >
          Create Account
        </Link>
      </div>
    </LegalPageLayout>
  )
}

export default Contact
