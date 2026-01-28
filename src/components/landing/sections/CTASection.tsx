'use client';

import { WaitlistForm } from '../WaitlistForm';

export function CTASection() {
  return (
    <section id="cta" className="py-32 px-6 lg:px-16 bg-[#f5f3f0]">
      <div className="max-w-[1200px] mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-32">
          <div>
            <h2 className="text-[clamp(2.5rem,5vw,4rem)] font-light text-[#1a1a1a] leading-[1.05] tracking-[-0.03em]">
              Ready to think<br />clearly?
            </h2>
          </div>

          <div className="flex flex-col justify-center">
            <p className="text-[17px] text-gray-500 leading-relaxed mb-10 max-w-md">
              Join the waitlist for early access. We're opening spots gradually
              to ensure everyone gets the attention they deserve.
            </p>

            {/* Waitlist Form */}
            <div className="mb-8">
              <WaitlistForm
                variant="inline"
                buttonText="Get Early Access"
              />
            </div>

            {/* Trust points */}
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-[14px] text-gray-400">
              <span>No credit card</span>
              <span>Free tier forever</span>
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
