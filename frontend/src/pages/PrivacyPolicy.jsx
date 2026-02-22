import LegalPageLayout from '../components/LegalPageLayout'

function Section({ number, title, children, isLast }) {
  return (
    <section className="group">
      <div className="flex items-start gap-4 mb-4">
        <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-pool-blue/20 text-pool-blue flex items-center justify-center font-bold text-sm">
          {number}
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold text-white mb-3">{title}</h2>
          <div className="text-white/80 leading-relaxed space-y-3 [&>p]:text-white/80 [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:space-y-2 [&>li]:text-white/80">
            {children}
          </div>
        </div>
      </div>
      <div className={`ml-14 pb-8 ${!isLast ? 'border-b border-white/5' : ''}`} />
    </section>
  )
}

function PrivacyPolicy() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      subtitle={`Last updated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`}
    >
      <div className="space-y-8">
        <Section number="1" title="Information We Collect">
          <p>We collect information that you provide directly to us, including:</p>
          <ul>
            <li>Account information (name, email address, company name)</li>
            <li>Payment information (processed securely through Stripe)</li>
            <li>Business data you enter into the CRM system</li>
            <li>Usage data and analytics</li>
          </ul>
        </Section>

        <Section number="2" title="How We Use Your Information">
          <p>We use the information we collect to:</p>
          <ul>
            <li>Provide, maintain, and improve our services</li>
            <li>Process transactions and send related information</li>
            <li>Send technical notices, updates, and support messages</li>
            <li>Respond to your comments and questions</li>
          </ul>
        </Section>

        <Section number="3" title="Information Sharing">
          <p>We do not sell, trade, or rent your personal information to third parties. We may share your information only:</p>
          <ul>
            <li>With service providers who assist us in operating our platform (e.g., payment processors)</li>
            <li>When required by law or to protect our rights</li>
            <li>With your consent</li>
          </ul>
        </Section>

        <Section number="4" title="Data Security">
          <p>
            We implement appropriate technical and organizational security measures to protect your personal information. However, no method of transmission over the Internet is 100% secure.
          </p>
        </Section>

        <Section number="5" title="Your Rights">
          <p>You have the right to:</p>
          <ul>
            <li>Access your personal information</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Opt-out of certain communications</li>
          </ul>
        </Section>

        <Section number="6" title="Cookies and Tracking">
          <p>
            We use cookies and similar tracking technologies to track activity on our service and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
          </p>
        </Section>

        <Section number="7" title="Contact Us" isLast>
          <p>If you have any questions about this Privacy Policy, please contact us at:</p>
          <p className="text-pool-blue font-medium">
            privacy@tovyalla.com
          </p>
        </Section>
      </div>
    </LegalPageLayout>
  )
}

export default PrivacyPolicy
