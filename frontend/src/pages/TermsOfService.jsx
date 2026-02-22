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

function TermsOfService() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      subtitle={`Last updated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`}
    >
      <div className="space-y-8">
        <Section number="1" title="Acceptance of Terms">
          <p>
            By accessing and using Tovyalla CRM ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
          </p>
        </Section>

        <Section number="2" title="Use License">
          <p>
            Permission is granted to temporarily use Tovyalla CRM for personal or commercial business management. This is the grant of a license, not a transfer of title, and under this license you may not:
          </p>
          <ul>
            <li>Modify or copy the materials</li>
            <li>Use the materials for any commercial purpose without explicit written permission</li>
            <li>Attempt to reverse engineer any software contained in the Service</li>
            <li>Remove any copyright or other proprietary notations from the materials</li>
          </ul>
        </Section>

        <Section number="3" title="Subscription and Payment">
          <p>
            The Service is provided on a subscription basis. By subscribing, you agree to pay the monthly subscription fee as displayed at the time of registration. Subscriptions automatically renew unless cancelled. You may cancel your subscription at any time through your account settings.
          </p>
        </Section>

        <Section number="4" title="User Account">
          <p>
            You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
          </p>
        </Section>

        <Section number="5" title="Data and Privacy">
          <p>
            Your use of the Service is also governed by our Privacy Policy. Please review our Privacy Policy to understand our practices regarding the collection and use of your data.
          </p>
        </Section>

        <Section number="6" title="Limitation of Liability">
          <p>
            In no event shall Tovyalla CRM or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the Service.
          </p>
        </Section>

        <Section number="7" title="Contact Information" isLast>
          <p>
            If you have any questions about these Terms of Service, please contact us at:
          </p>
          <p className="text-pool-blue font-medium">
            support@tovyalla.com
          </p>
        </Section>
      </div>
    </LegalPageLayout>
  )
}

export default TermsOfService
