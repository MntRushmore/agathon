'use client';

const testimonials = [
  {
    quote: "I used to just copy answers from Photomath. Now I actually understand why the steps work. My test scores went up 15 points.",
    author: "Sarah K.",
    context: "Junior, AP Calculus",
  },
  {
    quote: "I can finally see where my students are struggling before the test. It's changed how I use class time.",
    author: "Mr. Rodriguez",
    context: "AP Calculus Teacher, 12 years",
  },
  {
    quote: "My daughter used to cry during math homework. Now she asks me to leave her alone so she can figure it out herself.",
    author: "Jennifer T.",
    context: "Parent",
  },
];

export function TestimonialsSection() {
  return (
    <section id="testimonials" className="py-32 px-6 lg:px-16 bg-white">
      <div className="max-w-[1200px] mx-auto">
        {/* Large quote */}
        <div className="mb-32">
          <blockquote className="text-[clamp(1.75rem,4vw,3rem)] font-light text-[#1a1a1a] leading-[1.25] tracking-[-0.02em] max-w-4xl">
            "The difference is my students come to class with questions about
            <em className="italic"> why</em> something works, not just asking for the answer."
          </blockquote>
          <div className="mt-10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#1a1a1a] flex items-center justify-center text-white text-[14px] font-medium">
              DR
            </div>
            <div>
              <p className="text-[15px] text-[#1a1a1a] font-medium">Dr. Rebecca Chen</p>
              <p className="text-[14px] text-gray-400">Math Department Chair, Lincoln High School</p>
            </div>
          </div>
        </div>

        {/* Testimonials grid */}
        <div className="grid md:grid-cols-3 gap-12 pt-20 border-t border-gray-200">
          {testimonials.map((testimonial) => (
            <div key={testimonial.author}>
              <p className="text-[17px] text-[#1a1a1a] leading-relaxed mb-8">
                "{testimonial.quote}"
              </p>
              <div>
                <p className="text-[15px] text-[#1a1a1a] font-medium">
                  {testimonial.author}
                </p>
                <p className="text-[14px] text-gray-400">
                  {testimonial.context}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="mt-32 grid grid-cols-3 gap-8">
          <div>
            <p className="text-[clamp(3rem,6vw,5rem)] font-light text-[#1a1a1a] tracking-[-0.03em]">
              2,500+
            </p>
            <p className="text-[15px] text-gray-400 mt-2">
              Students in beta
            </p>
          </div>
          <div>
            <p className="text-[clamp(3rem,6vw,5rem)] font-light text-[#1a1a1a] tracking-[-0.03em]">
              50+
            </p>
            <p className="text-[15px] text-gray-400 mt-2">
              Schools piloting
            </p>
          </div>
          <div>
            <p className="text-[clamp(3rem,6vw,5rem)] font-light text-[#1a1a1a] tracking-[-0.03em]">
              94%
            </p>
            <p className="text-[15px] text-gray-400 mt-2">
              Report better understanding
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
