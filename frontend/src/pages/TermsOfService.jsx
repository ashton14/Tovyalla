import { Link } from 'react-router-dom'

function TermsOfService() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pool-blue via-pool-dark to-gray-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-8 md:p-12">
          <div className="mb-6">
            <Link to="/" className="text-pool-blue hover:text-pool-dark font-semibold text-sm">
              ← Back to Home
            </Link>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
          <p className="text-gray-600 mb-8">Last updated: {new Date().toLocaleDateString()}</p>

          <div className="prose prose-gray max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
              <p className="text-gray-700 leading-relaxed">
                By accessing and using Tovyalla CRM ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Use License</h2>
              <p className="text-gray-700 leading-relaxed">
                Permission is granted to temporarily use Tovyalla CRM for personal or commercial business management. This is the grant of a license, not a transfer of title, and under this license you may not:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1 text-gray-700">
                <li>Modify or copy the materials</li>
                <li>Use the materials for any commercial purpose without explicit written permission</li>
                <li>Attempt to reverse engineer any software contained in the Service</li>
                <li>Remove any copyright or other proprietary notations from the materials</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Subscription and Payment</h2>
              <p className="text-gray-700 leading-relaxed">
                The Service is provided on a subscription basis. By subscribing, you agree to pay the monthly subscription fee as displayed at the time of registration. Subscriptions automatically renew unless cancelled. You may cancel your subscription at any time through your account settings.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">4. User Account</h2>
              <p className="text-gray-700 leading-relaxed">
                You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Data and Privacy</h2>
              <p className="text-gray-700 leading-relaxed">
                Your use of the Service is also governed by our Privacy Policy. Please review our Privacy Policy to understand our practices regarding the collection and use of your data.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Limitation of Liability</h2>
              <p className="text-gray-700 leading-relaxed">
                In no event shall Tovyalla CRM or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Contact Information</h2>
              <p className="text-gray-700 leading-relaxed">
                If you have any questions about these Terms of Service, please contact us at:
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

export default TermsOfService

