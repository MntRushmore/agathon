'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Footer } from '@/components/layout/Footer';

export default function PrivacyPolicyPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#E8E4DC] bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm text-[#666] hover:text-[#1a1a1a] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <Link href="/" className="inline-flex items-center gap-2">
            <Image
              src="/logo/agathon.png"
              alt="Agathon"
              width={24}
              height={24}
              className="rounded-md"
            />
            <span className="font-medium text-[#1a1a1a] text-sm">Agathon</span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <h1 className="text-3xl font-semibold text-[#1a1a1a] mb-2">Privacy Policy</h1>
          <p className="text-[#666] mb-10">Last updated: January 24, 2025</p>

          <div className="space-y-8">
            <section>
              <h2 className="text-lg font-semibold text-[#1a1a1a] mb-3">1. Introduction</h2>
              <p className="text-[#444] leading-relaxed">
                Welcome to Agathon. We respect your privacy and are committed to protecting your personal data.
                This privacy policy explains how we collect, use, and safeguard your information when you use our
                educational platform.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#1a1a1a] mb-3">2. Information We Collect</h2>
              <p className="text-[#444] leading-relaxed mb-3">We collect information you provide directly to us, including:</p>
              <ul className="list-disc list-inside text-[#444] space-y-2 ml-4">
                <li>Account information (name, email address, password)</li>
                <li>Profile information (avatar, display name)</li>
                <li>Content you create (whiteboards, journals, notes)</li>
                <li>Usage data (how you interact with our platform)</li>
                <li>Device information (browser type, operating system)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#1a1a1a] mb-3">3. How We Use Your Information</h2>
              <p className="text-[#444] leading-relaxed mb-3">We use the information we collect to:</p>
              <ul className="list-disc list-inside text-[#444] space-y-2 ml-4">
                <li>Provide, maintain, and improve our services</li>
                <li>Process and complete transactions</li>
                <li>Send you technical notices and support messages</li>
                <li>Respond to your comments and questions</li>
                <li>Analyze usage patterns to improve user experience</li>
                <li>Protect against fraudulent or illegal activity</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#1a1a1a] mb-3">4. AI Features and Data Processing</h2>
              <p className="text-[#444] leading-relaxed">
                Agathon uses artificial intelligence to provide educational assistance. When you use AI features,
                your content may be processed by our AI systems to generate responses, feedback, and suggestions.
                We do not use your personal content to train AI models. AI-generated content is provided for
                educational purposes only.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#1a1a1a] mb-3">5. Data Sharing</h2>
              <p className="text-[#444] leading-relaxed mb-3">We do not sell your personal information. We may share your information with:</p>
              <ul className="list-disc list-inside text-[#444] space-y-2 ml-4">
                <li>Service providers who assist in operating our platform</li>
                <li>Teachers or administrators within your educational institution (if applicable)</li>
                <li>Law enforcement when required by law</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#1a1a1a] mb-3">6. Data Security</h2>
              <p className="text-[#444] leading-relaxed">
                We implement appropriate technical and organizational measures to protect your personal data against
                unauthorized access, alteration, disclosure, or destruction. This includes encryption, secure servers,
                and regular security assessments.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#1a1a1a] mb-3">7. Your Rights</h2>
              <p className="text-[#444] leading-relaxed mb-3">You have the right to:</p>
              <ul className="list-disc list-inside text-[#444] space-y-2 ml-4">
                <li>Access your personal data</li>
                <li>Correct inaccurate data</li>
                <li>Delete your account and associated data</li>
                <li>Export your data</li>
                <li>Opt out of marketing communications</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#1a1a1a] mb-3">8. Children&apos;s Privacy</h2>
              <p className="text-[#444] leading-relaxed">
                Agathon is designed for educational use and may be used by students of various ages. We comply with
                applicable laws regarding children&apos;s privacy, including COPPA. If you are under 13, please have a
                parent or guardian review this policy and assist with account creation.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#1a1a1a] mb-3">9. Cookies</h2>
              <p className="text-[#444] leading-relaxed">
                We use cookies and similar technologies to maintain your session, remember your preferences, and
                analyze how our platform is used. You can control cookies through your browser settings.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#1a1a1a] mb-3">10. Changes to This Policy</h2>
              <p className="text-[#444] leading-relaxed">
                We may update this privacy policy from time to time. We will notify you of any changes by posting
                the new policy on this page and updating the &quot;Last updated&quot; date.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[#1a1a1a] mb-3">11. Contact Us</h2>
              <p className="text-[#444] leading-relaxed">
                If you have any questions about this Privacy Policy, please contact us at{' '}
                <a href="mailto:support@agathon.app" className="text-[#1a1a1a] font-medium hover:underline">
                  support@agathon.app
                </a>
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
