import { Link } from 'react-router-dom'

function Contact() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pool-blue via-pool-dark to-gray-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-8 md:p-12">
          <div className="mb-6">
            <Link to="/" className="text-pool-blue hover:text-pool-dark font-semibold text-sm">
              ← Back to Home
            </Link>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Contact Us</h1>
          <p className="text-gray-600 mb-8">Get in touch with our support team</p>

          <div className="prose prose-gray max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Email Support</h2>
              <p className="text-gray-700 leading-relaxed">
                For general inquiries, support requests, or questions about our services, please email us at:
              </p>
              <p className="text-gray-700 mt-3">
                <a href="mailto:support@tovyalla.com" className="text-pool-blue hover:text-pool-dark font-semibold underline">
                  support@tovyalla.com
                </a>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Business Address</h2>
              <p className="text-gray-700 leading-relaxed">
                Our business address is:
              </p>
              <p className="text-gray-700 mt-3 font-medium">
                2949 Heavenly Ridge Street<br />
                Thousand Oaks, CA 91362
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Response Time</h2>
              <p className="text-gray-700 leading-relaxed">
                We aim to respond to all inquiries within 24-48 hours during business days. For urgent matters, please indicate "URGENT" in your email subject line.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Support Hours</h2>
              <p className="text-gray-700 leading-relaxed">
                Our support team is available Monday through Friday, 9:00 AM to 5:00 PM Pacific Time.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Contact

