'use client';

import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

interface UseCasesSectionProps {
  onJoinWaitlist: (role: string) => void;
}

export function UseCasesSection({ onJoinWaitlist }: UseCasesSectionProps) {
  return (
    <section id="use-cases" className="py-32 px-6 lg:px-16 bg-white">
      <div className="max-w-[1200px] mx-auto">
        {/* Section Header */}
        <div className="mb-24">
          <h2 className="text-[clamp(2.5rem,5vw,4rem)] font-light text-[#1a1a1a] leading-[1.05] tracking-[-0.03em]">
            Built for everyone who<br />cares about learning
          </h2>
        </div>

        {/* Use Cases */}
        <div className="space-y-0">
          {/* Students */}
          <div className="grid lg:grid-cols-12 gap-8 py-20 border-t border-gray-200">
            <div className="lg:col-span-4">
              <h3 className="text-[32px] font-light text-[#1a1a1a] tracking-[-0.02em]">
                Students
              </h3>
            </div>
            <div className="lg:col-span-5">
              <p className="text-[17px] text-gray-500 leading-relaxed mb-6">
                Homework help that actually teaches. Get unstuck at 2am without copying answers.
                Build the understanding that shows up on test day.
              </p>
              <ul className="space-y-3 text-[15px] text-gray-500">
                <li>— Homework help that teaches, not tells</li>
                <li>— Available 24/7 when you're stuck</li>
                <li>— Exam prep without shortcuts</li>
              </ul>
            </div>
            <div className="lg:col-span-3 flex lg:justify-end items-start">
              <button
                onClick={() => onJoinWaitlist('student')}
                className="text-[14px] font-medium text-[#1a1a1a] flex items-center gap-2 hover:gap-3 transition-all group"
              >
                Join as student
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Teachers */}
          <div className="grid lg:grid-cols-12 gap-8 py-20 border-t border-gray-200">
            <div className="lg:col-span-4">
              <h3 className="text-[32px] font-light text-[#1a1a1a] tracking-[-0.02em]">
                Teachers
              </h3>
            </div>
            <div className="lg:col-span-5">
              <p className="text-[17px] text-gray-500 leading-relaxed mb-6">
                See inside the learning process. Know which concepts are landing and which
                need more class time. Assign work that generates real understanding.
              </p>
              <ul className="space-y-3 text-[15px] text-gray-500">
                <li>— Create Socratic assignments</li>
                <li>— Track progress in real-time</li>
                <li>— See exactly where students struggle</li>
              </ul>
            </div>
            <div className="lg:col-span-3 flex lg:justify-end items-start">
              <button
                onClick={() => onJoinWaitlist('teacher')}
                className="text-[14px] font-medium text-[#1a1a1a] flex items-center gap-2 hover:gap-3 transition-all group"
              >
                Join as teacher
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Parents */}
          <div className="grid lg:grid-cols-12 gap-8 py-20 border-t border-gray-200">
            <div className="lg:col-span-4">
              <h3 className="text-[32px] font-light text-[#1a1a1a] tracking-[-0.02em]">
                Parents
              </h3>
            </div>
            <div className="lg:col-span-5">
              <p className="text-[17px] text-gray-500 leading-relaxed mb-6">
                Screen time that's actually worth it. Know your kids are learning, not
                just getting answers handed to them. Peace of mind during homework time.
              </p>
              <ul className="space-y-3 text-[15px] text-gray-500">
                <li>— Know they're learning, not cheating</li>
                <li>— Progress updates without nagging</li>
                <li>— Confidence they're building real skills</li>
              </ul>
            </div>
            <div className="lg:col-span-3 flex lg:justify-end items-start">
              <button
                onClick={() => onJoinWaitlist('parent')}
                className="text-[14px] font-medium text-[#1a1a1a] flex items-center gap-2 hover:gap-3 transition-all group"
              >
                Join as parent
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
