'use client';

import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/ui/logo';

export default function TermsOfServicePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <Logo size="sm" />
        </div>

        <h1 className="text-3xl font-bold text-foreground mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: January 24, 2025</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using Agathon, you agree to be bound by these Terms of Service and our Privacy Policy.
              If you do not agree to these terms, please do not use our platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              Agathon is an educational platform that provides AI-powered learning tools, including digital
              whiteboards, journaling features, and study assistance. Our services are designed to support
              learning and educational activities.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">3. User Accounts</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">To use Agathon, you must:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Create an account with accurate information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Notify us immediately of any unauthorized access</li>
              <li>Be at least 13 years old (or have parental consent)</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              You are responsible for all activities that occur under your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">4. Acceptable Use</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">You agree not to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Use the platform for any illegal purpose</li>
              <li>Upload harmful, offensive, or inappropriate content</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Interfere with the proper functioning of the platform</li>
              <li>Use the service to harass, abuse, or harm others</li>
              <li>Share your account with others or create multiple accounts</li>
              <li>Use automated systems to access the platform without permission</li>
              <li>Reverse engineer or attempt to extract source code</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">5. User Content</h2>
            <p className="text-muted-foreground leading-relaxed">
              You retain ownership of content you create on Agathon. By using our platform, you grant us a
              limited license to store, display, and process your content as necessary to provide our services.
              You are responsible for ensuring your content does not violate any laws or third-party rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">6. AI-Generated Content</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our platform uses AI to provide educational assistance. AI-generated content is provided for
              informational and educational purposes only. While we strive for accuracy, AI responses may
              contain errors. You should verify important information and not rely solely on AI-generated
              content for critical decisions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">7. Educational Use</h2>
            <p className="text-muted-foreground leading-relaxed">
              Agathon is designed to support learning, not replace it. Users should use AI assistance as a
              study aid while developing their own understanding. Submitting AI-generated content as your own
              work may violate academic integrity policies at your institution.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">8. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              Agathon and its original content, features, and functionality are owned by us and are protected
              by international copyright, trademark, and other intellectual property laws. Our trademarks may
              not be used without our prior written consent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">9. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may terminate or suspend your account at any time for violations of these terms or for any
              other reason at our discretion. You may also delete your account at any time. Upon termination,
              your right to use the platform will immediately cease.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">10. Disclaimer of Warranties</h2>
            <p className="text-muted-foreground leading-relaxed">
              Agathon is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind. We do not
              guarantee that the platform will be uninterrupted, secure, or error-free. We are not responsible
              for the accuracy of AI-generated content or any decisions made based on such content.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">11. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              To the maximum extent permitted by law, Agathon shall not be liable for any indirect, incidental,
              special, consequential, or punitive damages, including loss of data, profits, or goodwill, arising
              from your use of the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">12. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to modify these terms at any time. We will notify users of significant changes
              by posting a notice on our platform. Continued use of the platform after changes constitutes
              acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">13. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These terms shall be governed by and construed in accordance with the laws of the United States,
              without regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">14. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about these Terms of Service, please contact us at{' '}
              <a href="mailto:support@agathon.app" className="text-primary hover:underline">
                support@agathon.app
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
