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
          <div className="text-white/80 leading-relaxed space-y-3 [&>p]:text-white/80 [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:space-y-2 [&>ol]:list-decimal [&>ol]:pl-6 [&>ol]:space-y-2 [&>li]:text-white/80">
            {children}
          </div>
        </div>
      </div>
      <div className={`ml-14 pb-8 ${!isLast ? 'border-b border-white/5' : ''}`} />
    </section>
  )
}

function RefundPolicy() {
  return (
    <LegalPageLayout
      title="Refund and Cancellation Policy"
      subtitle={`Last updated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`}
    >
      <div className="space-y-8">
        <Section number="1" title="Subscription Cancellation">
          <p>
            You may cancel your subscription at any time through your account settings or by contacting our support team. When you cancel, your subscription will remain active until the end of your current billing period. You will continue to have access to all features until that time.
          </p>
        </Section>

        <Section number="2" title="Refund Policy">
          <p>We offer refunds under the following circumstances:</p>
          <ul>
            <li><strong>Within 30 days of initial subscription:</strong> Full refund available if you are not satisfied with the service</li>
            <li><strong>Billing errors:</strong> Full refund for any billing mistakes on our part</li>
            <li><strong>Service unavailability:</strong> Pro-rated refunds for extended service outages</li>
          </ul>
          <p>
            Refunds are processed to the original payment method within 5-10 business days.
          </p>
        </Section>

        <Section number="3" title="No Refund Scenarios">
          <p>Refunds are not available for:</p>
          <ul>
            <li>Subscriptions cancelled after 30 days from initial purchase</li>
            <li>Partial months of service</li>
            <li>Data loss due to user error</li>
            <li>Violation of terms of service resulting in account termination</li>
          </ul>
        </Section>

        <Section number="4" title="Cancellation Process">
          <p>To cancel your subscription:</p>
          <ol>
            <li>Log into your Tovyalla CRM account</li>
            <li>Navigate to Account Settings or Billing</li>
            <li>Click "Cancel Subscription"</li>
            <li>Confirm your cancellation</li>
          </ol>
        </Section>

        <Section number="5" title="Data After Cancellation">
          <p>
            After cancellation, your account data will be immediately deleted and cannot be recovered.
          </p>
        </Section>

        <Section number="6" title="Contact for Refunds" isLast>
          <p>To request a refund or discuss cancellation, please contact us at:</p>
          <p className="text-pool-blue font-medium">
            support@tovyalla.com
          </p>
        </Section>
      </div>
    </LegalPageLayout>
  )
}

export default RefundPolicy
