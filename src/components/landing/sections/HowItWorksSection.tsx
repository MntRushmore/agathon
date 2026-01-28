'use client';

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-32 px-6 lg:px-16 bg-white">
      <div className="max-w-[1200px] mx-auto">
        {/* Section Header */}
        <div className="mb-24">
          <h2 className="text-[clamp(2.5rem,5vw,4rem)] font-light text-[#1a1a1a] leading-[1.05] tracking-[-0.03em]">
            How it works
          </h2>
        </div>

        {/* Steps */}
        <div className="space-y-0">
          {/* Step 1 */}
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-20 py-16 border-t border-gray-200">
            <div>
              <span className="text-[13px] text-gray-400 font-medium tracking-wider">01</span>
            </div>
            <div>
              <h3 className="text-[28px] font-normal text-[#1a1a1a] mb-4 tracking-[-0.02em]">
                Write your problem
              </h3>
              <p className="text-[17px] text-gray-500 leading-relaxed max-w-md">
                Draw math problems naturally with your finger, stylus, or mouse.
                Messy handwriting works. We built it that way.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-20 py-16 border-t border-gray-200">
            <div>
              <span className="text-[13px] text-gray-400 font-medium tracking-wider">02</span>
            </div>
            <div>
              <h3 className="text-[28px] font-normal text-[#1a1a1a] mb-4 tracking-[-0.02em]">
                Get the right question
              </h3>
              <p className="text-[17px] text-gray-500 leading-relaxed max-w-md">
                Instead of giving you the answer, Agathon asks a question that
                guides your thinking. The question you needed but didn't know to ask.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-20 py-16 border-t border-gray-200">
            <div>
              <span className="text-[13px] text-gray-400 font-medium tracking-wider">03</span>
            </div>
            <div>
              <h3 className="text-[28px] font-normal text-[#1a1a1a] mb-4 tracking-[-0.02em]">
                Discover the answer yourself
              </h3>
              <p className="text-[17px] text-gray-500 leading-relaxed max-w-md">
                The "aha!" moment is yours. That's real understanding.
                That's what you'll remember on the test.
              </p>
            </div>
          </div>
        </div>

        {/* The difference */}
        <div className="mt-32 pt-20 border-t border-gray-200">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-32">
            <div>
              <p className="text-[13px] text-gray-400 font-medium mb-6 tracking-wider uppercase">Other AI</p>
              <p className="text-[32px] font-light text-gray-300 leading-[1.2] tracking-[-0.02em]">
                "The answer is x = 5"
              </p>
              <p className="text-[15px] text-gray-400 mt-6">
                You copy. You forget. You fail the test.
              </p>
            </div>
            <div>
              <p className="text-[13px] text-[#1a1a1a] font-medium mb-6 tracking-wider uppercase">Agathon</p>
              <p className="text-[32px] font-light text-[#1a1a1a] leading-[1.2] tracking-[-0.02em]">
                "What's the first step to isolate x?"
              </p>
              <p className="text-[15px] text-gray-500 mt-6">
                You think. You understand. You remember.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
