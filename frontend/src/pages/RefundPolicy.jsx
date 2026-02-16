import { Link } from 'react-router-dom'

function RefundPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pool-blue via-pool-dark to-gray-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-8 md:p-12">
          <div className="mb-6">
            <Link to="/" className="text-pool-blue hover:text-pool-dark font-semibold text-sm">
              ← Back to Home
            </Link>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Refund and Cancellation Policy</h1>
          <p className="text-gray-600 mb-8">Last updated: {new Date().toLocaleDateString()}</p>

          <div className="prose prose-gray max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Subscription Cancellation</h2>
              <p className="text-gray-700 leading-relaxed">
                You may cancel your subscription at any time through your account settings or by contacting our support team. When you cancel, your subscription will remain active until the end of your current billing period. You will continue to have access to all features until that time.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Refund Policy</h2>
              <p className="text-gray-700 leading-relaxed mb-2">
                We offer refunds under the following circumstances:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li><strong>Within 30 days of initial subscription:</strong> Full refund available if you are not satisfied with the service</li>
                <li><strong>Billing errors:</strong> Full refund for any billing mistakes on our part</li>
                <li><strong>Service unavailability:</strong> Pro-rated refunds for extended service outages</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-3">
                Refunds are processed to the original payment method within 5-10 business days.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">3. No Refund Scenarios</h2>
              <p className="text-gray-700 leading-relaxed">
                Refunds are not available for:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1 text-gray-700">
                <li>Subscriptions cancelled after 30 days from initial purchase</li>
                <li>Partial months of service</li>
                <li>Data loss due to user error</li>
                <li>Violation of terms of service resulting in account termination</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Cancellation Process</h2>
              <p className="text-gray-700 leading-relaxed">
                To cancel your subscription:
              </p>
              <ol className="list-decimal pl-6 mt-2 space-y-1 text-gray-700">
                <li>Log into your Tovyalla CRM account</li>
                <li>Navigate to Account Settings or Billing</li>
                <li>Click "Cancel Subscription"</li>
                <li>Confirm your cancellation</li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Data After Cancellation</h2>
              <p className="text-gray-700 leading-relaxed">
                After cancellation, your account data will be immediately deleted and cannot be recovered.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Contact for Refunds</h2>
              <p className="text-gray-700 leading-relaxed">
                To request a refund or discuss cancellation, please contact us at:
              </p>
              <p className="text-gray-700 mt-2">
                <strong>Email:</strong> support@tovyalla.com<br />
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RefundPolicy

