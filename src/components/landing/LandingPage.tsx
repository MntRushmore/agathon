'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import {
  Pencil,
  Sparkles,
  BookOpen,
  CheckCircle2,
  ArrowRight,
  Play,
  GraduationCap,
  Brain,
  Lightbulb,
  MessageSquare,
  Users,
  Zap,
  Star,
  ChevronRight,
  MousePointer2,
  PenTool,
  Wand2,
} from 'lucide-react';

export function LandingPage() {
  const router = useRouter();
  const [videoPlaying, setVideoPlaying] = useState(false);

  const features = [
    {
      icon: <PenTool className="w-5 h-5" />,
      title: 'Draw Naturally',
      description: 'Write math problems with your finger, stylus, or mouse. Our AI understands your handwriting.',
      color: 'bg-blue-500',
    },
    {
      icon: <Lightbulb className="w-5 h-5" />,
      title: 'Get Smart Hints',
      description: "Stuck? Get nudges that guide your thinking without spoiling the answer.",
      color: 'bg-amber-500',
    },
    {
      icon: <Brain className="w-5 h-5" />,
      title: 'Actually Learn',
      description: 'Understand the why, not just the what. Build real problem-solving skills.',
      color: 'bg-purple-500',
    },
    {
      icon: <MessageSquare className="w-5 h-5" />,
      title: 'Chat Anytime',
      description: 'Ask questions about your work and get explanations at your level.',
      color: 'bg-green-500',
    },
  ];

  const stats = [
    { value: '10k+', label: 'Problems Solved' },
    { value: '98%', label: 'Say They Learned' },
    { value: '24/7', label: 'AI Tutor Available' },
  ];

  const testimonials = [
    {
      quote: "Finally, an app that helps me understand math instead of just giving me answers.",
      author: "Sarah K.",
      role: "High School Student",
    },
    {
      quote: "My students are actually excited about problem-solving now.",
      author: "Mr. Rodriguez",
      role: "Math Teacher",
    },
    {
      quote: "The hints feature is genius. It's like having a patient tutor available 24/7.",
      author: "Alex T.",
      role: "College Freshman",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo size="md" showText />
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => router.push('/login')}>
              Sign In
            </Button>
            <Button onClick={() => router.push('/login')} className="rounded-full">
              Get Started Free
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-28 pb-8 px-6">
        <div className="max-w-5xl mx-auto">
          {/* Badge */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-100">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">AI-Powered Learning That Actually Works</span>
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-bold text-center text-gray-900 tracking-tight mb-6 leading-[1.1]">
            Stop copying answers.
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Start understanding.
            </span>
          </h1>

          <p className="text-xl text-gray-600 text-center max-w-2xl mx-auto mb-10">
            Agathon is your AI whiteboard that teaches you how to solve problems—not just what the answer is.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
            <Button
              size="lg"
              className="text-lg px-8 h-14 rounded-full bg-gray-900 hover:bg-gray-800"
              onClick={() => router.push('/login')}
            >
              Try Free — No Card Needed
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>

          {/* Trust indicators */}
          <div className="flex items-center justify-center gap-6 text-sm text-gray-500 mb-16">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Free forever plan
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Works on any device
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              K-12 to College
            </span>
          </div>
        </div>
      </section>

      {/* Video Demo Section */}
      <section className="px-6 pb-24">
        <div className="max-w-5xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-gray-200 bg-gray-900">
            {/* Video */}
            <video
              className="w-full aspect-video"
              controls
              poster="/logo/agathonwide.png"
              playsInline
              onPlay={() => setVideoPlaying(true)}
            >
              <source src="/videos/demo.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>

            {/* Play overlay - only show when not playing */}
            {!videoPlaying && (
              <div
                className="absolute inset-0 flex items-center justify-center bg-gray-900/20 cursor-pointer group"
                onClick={() => {
                  const video = document.querySelector('video');
                  if (video) {
                    video.play();
                    setVideoPlaying(true);
                  }
                }}
              >
                <div className="w-20 h-20 rounded-full bg-white shadow-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Play className="w-8 h-8 text-gray-900 ml-1" fill="currentColor" />
                </div>
              </div>
            )}
          </div>
          <p className="text-center text-sm text-gray-500 mt-4">
            See Agathon in action — 60 second demo
          </p>
        </div>
      </section>

      {/* How It Works - Visual Steps */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Learning math shouldn't feel like torture
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Three steps to actually understanding your homework
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                icon: <MousePointer2 className="w-6 h-6" />,
                title: 'Draw your problem',
                description: 'Scribble it out like you would on paper. Messy handwriting? No problem.',
                color: 'bg-blue-500',
              },
              {
                step: '02',
                icon: <Wand2 className="w-6 h-6" />,
                title: 'Get guided hints',
                description: "Our AI sees where you're stuck and gives you just enough help to keep going.",
                color: 'bg-purple-500',
              },
              {
                step: '03',
                icon: <Star className="w-6 h-6" />,
                title: 'Actually learn it',
                description: "You solve it yourself. That's the only way to remember it for the test.",
                color: 'bg-amber-500',
              },
            ].map((item, index) => (
              <div key={index} className="relative">
                <div className="bg-white rounded-2xl p-8 h-full border border-gray-100 hover:shadow-lg transition-shadow">
                  <div className={`w-12 h-12 ${item.color} rounded-xl flex items-center justify-center text-white mb-6`}>
                    {item.icon}
                  </div>
                  <div className="text-sm font-mono text-gray-400 mb-2">STEP {item.step}</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    {item.title}
                  </h3>
                  <p className="text-gray-600">
                    {item.description}
                  </p>
                </div>
                {index < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-10">
                    <ChevronRight className="w-8 h-8 text-gray-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Built different (for real this time)
            </h2>
            <p className="text-lg text-gray-600">
              Not another answer-copying app
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group p-6 rounded-2xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 ${feature.color} rounded-xl flex items-center justify-center text-white flex-shrink-0`}>
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-6 bg-gray-900">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-3 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-white mb-2">
                  {stat.value}
                </div>
                <div className="text-gray-400 text-sm">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Students & teachers love it
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="p-6 rounded-2xl bg-gray-50 border border-gray-100"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-amber-400" fill="currentColor" />
                  ))}
                </div>
                <p className="text-gray-700 mb-4 italic">
                  "{testimonial.quote}"
                </p>
                <div>
                  <div className="font-semibold text-gray-900">{testimonial.author}</div>
                  <div className="text-sm text-gray-500">{testimonial.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who It's For */}
      <section className="py-24 px-6 bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Perfect for...
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: <GraduationCap className="w-8 h-8" />,
                title: 'Students',
                points: ['Homework help that teaches', 'Exam prep without cheating', 'Available at 2am'],
              },
              {
                icon: <Users className="w-8 h-8" />,
                title: 'Teachers',
                points: ['Assign interactive problems', 'See where students struggle', 'Save hours on grading'],
              },
              {
                icon: <BookOpen className="w-8 h-8" />,
                title: 'Parents',
                points: ['Know they\'re learning', 'No more answer-copying', 'Worth the screen time'],
              },
            ].map((persona, index) => (
              <div key={index} className="bg-white rounded-2xl p-8 border border-gray-100">
                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 mb-6">
                  {persona.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">{persona.title}</h3>
                <ul className="space-y-3">
                  {persona.points.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-gray-600">
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 border border-green-100 text-green-700 text-sm font-medium mb-8">
            <Zap className="w-4 h-4" />
            Ready in 30 seconds
          </div>

          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Stop struggling.
            <br />
            Start understanding.
          </h2>

          <p className="text-xl text-gray-600 mb-10">
            Join thousands of students who finally get math.
            <br />
            Free forever. No credit card.
          </p>

          <Button
            size="lg"
            className="text-lg px-10 h-14 rounded-full bg-gray-900 hover:bg-gray-800"
            onClick={() => router.push('/login')}
          >
            Get Started Free
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-gray-100">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <Logo size="sm" showText />

          <div className="flex items-center gap-8 text-sm text-gray-500">
            <a href="/privacy" className="hover:text-gray-900 transition-colors">
              Privacy
            </a>
            <a href="/terms" className="hover:text-gray-900 transition-colors">
              Terms
            </a>
            <a href="mailto:hello@agathon.app" className="hover:text-gray-900 transition-colors">
              Contact
            </a>
          </div>

          <p className="text-sm text-gray-400">
            © 2025 Agathon
          </p>
        </div>
      </footer>
    </div>
  );
}
