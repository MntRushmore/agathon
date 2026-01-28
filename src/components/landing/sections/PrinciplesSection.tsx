'use client';

const principles = [
  {
    title: 'Never give answers directly',
    description: 'Every feature we build asks one question: does this help students actually understand? If it just makes homework faster, we don\'t ship it.',
  },
  {
    title: 'Private by default',
    description: 'Your work is yours. No feeds, no social comparison, no public profiles. Just you and your learning, free from the pressure to perform.',
  },
  {
    title: 'No gamification tricks',
    description: 'No streaks. No points. No leaderboards. We believe real learning is its own reward. Intrinsic motivation beats manufactured urgency.',
  },
  {
    title: 'Built for understanding',
    description: 'We measure success by whether you can solve similar problems on your own—not by how many problems you\'ve clicked through.',
  },
];

export function PrinciplesSection() {
  return (
    <section id="principles" className="py-32 px-6 lg:px-16 bg-[#f5f3f0]">
      <div className="max-w-[1200px] mx-auto">
        {/* Section Header */}
        <div className="grid lg:grid-cols-2 gap-16 mb-24">
          <div>
            <h2 className="text-[clamp(2.5rem,5vw,4rem)] font-light text-[#1a1a1a] leading-[1.05] tracking-[-0.03em]">
              What we believe
            </h2>
          </div>
          <div className="flex items-end">
            <p className="text-[17px] text-gray-500 leading-relaxed max-w-md">
              These aren't marketing copy. They're the rules we follow when
              building every feature. When in doubt, we choose learning over convenience.
            </p>
          </div>
        </div>

        {/* Principles */}
        <div className="space-y-0">
          {principles.map((principle, index) => (
            <div
              key={principle.title}
              className="grid lg:grid-cols-12 gap-8 py-12 border-t border-gray-300"
            >
              <div className="lg:col-span-1">
                <span className="text-[14px] text-gray-400 font-medium">
                  0{index + 1}
                </span>
              </div>
              <div className="lg:col-span-4">
                <h3 className="text-[24px] font-normal text-[#1a1a1a] tracking-[-0.02em]">
                  {principle.title}
                </h3>
              </div>
              <div className="lg:col-span-7">
                <p className="text-[17px] text-gray-500 leading-relaxed">
                  {principle.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
