'use client';

const features = [
  {
    title: 'Natural handwriting',
    description: 'Write math like you would on paper. Our AI understands your handwriting, however messy.',
  },
  {
    title: 'Guided thinking',
    description: 'Get nudges that move you forward without spoiling the answer. Just the right hint at the right time.',
  },
  {
    title: 'Real understanding',
    description: 'Build problem-solving skills that transfer to exams, not just answer-copying habits.',
  },
  {
    title: 'Conversational help',
    description: 'Ask follow-up questions. Get explanations at your level. Like a tutor who adapts to you.',
  },
  {
    title: 'Teacher visibility',
    description: 'Assign problems. Track progress. See exactly where students get stuck.',
  },
  {
    title: 'Adaptive difficulty',
    description: 'The AI learns how you think. Problems and hints adjust to challenge you appropriately.',
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-32 px-6 lg:px-16 bg-[#f5f3f0]">
      <div className="max-w-[1200px] mx-auto">
        {/* Section Header */}
        <div className="mb-20">
          <h2 className="text-[clamp(2.5rem,5vw,4rem)] font-light text-[#1a1a1a] leading-[1.05] tracking-[-0.03em] max-w-2xl">
            Everything you need to actually learn
          </h2>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-16 gap-y-16">
          {features.map((feature, index) => (
            <div key={feature.title} className="group">
              <div className="text-[13px] text-gray-400 font-medium mb-4 tracking-wider">
                {String(index + 1).padStart(2, '0')}
              </div>
              <h3 className="text-[20px] font-normal text-[#1a1a1a] mb-3 tracking-[-0.01em]">
                {feature.title}
              </h3>
              <p className="text-[16px] text-gray-500 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
