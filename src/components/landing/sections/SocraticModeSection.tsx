'use client';

export function SocraticModeSection() {
  return (
    <section id="socratic" className="py-32 px-6 lg:px-16 bg-[#1a1a1a]">
      <div className="max-w-[1200px] mx-auto">
        {/* Section Header */}
        <div className="mb-20">
          <p className="text-[13px] text-white/40 font-medium mb-6 tracking-wider uppercase">
            The Socratic Method
          </p>
          <h2 className="text-[clamp(2.5rem,5vw,4rem)] font-light text-white leading-[1.05] tracking-[-0.03em] max-w-3xl">
            Teaching through questions, not answers
          </h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-20 lg:gap-32">
          {/* Left - Philosophy */}
          <div className="space-y-12">
            <div>
              <h3 className="text-[20px] font-normal text-white mb-4">
                2,400 years old. Still works.
              </h3>
              <p className="text-[17px] text-white/60 leading-relaxed">
                Socrates never lectured. He asked questions that forced his students to
                examine their own thinking. They discovered knowledge themselves—and
                that knowledge stuck.
              </p>
            </div>

            <div>
              <h3 className="text-[20px] font-normal text-white mb-4">
                Why it works
              </h3>
              <p className="text-[17px] text-white/60 leading-relaxed">
                When you discover an answer yourself, you understand it deeply.
                It becomes part of how you think, not just something you memorized
                for the test.
              </p>
            </div>

            <div>
              <h3 className="text-[20px] font-normal text-white mb-4">
                How Agathon applies it
              </h3>
              <p className="text-[17px] text-white/60 leading-relaxed">
                Our AI recognizes where you're stuck and asks the right question
                to unstick you. Not too easy, not too hard—just the right nudge
                to keep you moving forward.
              </p>
            </div>
          </div>

          {/* Right - Demo conversation */}
          <div className="space-y-4">
            {/* Student */}
            <div className="flex justify-end">
              <div className="max-w-[300px]">
                <p className="text-[12px] text-white/40 mb-2 text-right tracking-wider uppercase">You</p>
                <div className="bg-white/10 rounded-2xl rounded-br-sm px-5 py-4">
                  <p className="text-[15px] text-white">I'm stuck on: 3x + 7 = 22</p>
                </div>
              </div>
            </div>

            {/* AI */}
            <div className="flex justify-start">
              <div className="max-w-[320px]">
                <p className="text-[12px] text-white/40 mb-2 tracking-wider uppercase">Agathon</p>
                <div className="bg-white rounded-2xl rounded-bl-sm px-5 py-4">
                  <p className="text-[15px] text-[#1a1a1a]">What do you think the first step should be to isolate x?</p>
                </div>
              </div>
            </div>

            {/* Student */}
            <div className="flex justify-end">
              <div className="max-w-[300px]">
                <div className="bg-white/10 rounded-2xl rounded-br-sm px-5 py-4">
                  <p className="text-[15px] text-white">Subtract 7 from both sides?</p>
                </div>
              </div>
            </div>

            {/* AI */}
            <div className="flex justify-start">
              <div className="max-w-[320px]">
                <div className="bg-white rounded-2xl rounded-bl-sm px-5 py-4">
                  <p className="text-[15px] text-[#1a1a1a]">Exactly. What do you get when you do that?</p>
                </div>
              </div>
            </div>

            {/* Student success */}
            <div className="flex justify-end">
              <div className="max-w-[300px]">
                <div className="bg-white rounded-2xl rounded-br-sm px-5 py-4">
                  <p className="text-[15px] text-[#1a1a1a] font-medium">3x = 15, so x = 5!</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quote */}
        <div className="mt-32 pt-20 border-t border-white/10">
          <blockquote className="text-[clamp(1.75rem,3.5vw,2.5rem)] font-light text-white leading-[1.3] tracking-[-0.02em] max-w-3xl">
            "I cannot teach anybody anything.<br />
            I can only make them think."
          </blockquote>
          <p className="text-[14px] text-white/40 mt-8">— Socrates</p>
        </div>
      </div>
    </section>
  );
}
