'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Sparkles,
  PencilLine,
  MessageCircle,
  Mic,
  BookOpen,
  Layout,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface WelcomeDialogProps {
  open: boolean;
  onComplete: () => void;
  onSkip: () => void;
  userName?: string;
  userRole?: string;
}

const TOTAL_STEPS = 4;

export function WelcomeDialog({
  open,
  onComplete,
  onSkip,
  userName = 'there',
  userRole = 'student',
}: WelcomeDialogProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState(userRole);
  const router = useRouter();
  const supabase = createClient();

  const progress = (currentStep / TOTAL_STEPS) * 100;

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleRoleUpdate = async (role: string) => {
    setSelectedRole(role);
    // Update role in database if different
    if (role !== userRole) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('profiles')
            .update({ role })
            .eq('id', user.id);
          toast.success(`Role updated to ${role}`);
        }
      } catch (error) {
        console.error('Error updating role:', error);
        toast.error('Failed to update role');
      }
    }
    handleNext();
  };

  const handleJoinClass = () => {
    onComplete();
    router.push('/student/join');
  };

  const handleCreateBoard = async () => {
    onComplete();
    // Create a practice board
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please sign in to create a board');
        return;
      }

      const { data: newBoard, error } = await supabase
        .from('whiteboards')
        .insert({
          user_id: user.id,
          title: 'My First Practice Board',
          data: {},
        })
        .select()
        .single();

      if (error) throw error;

      if (newBoard) {
        toast.success('Practice board created! 🎨');
        router.push(`/board/${newBoard.id}`);
      }
    } catch (error) {
      console.error('Error creating board:', error);
      toast.error('Failed to create board');
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="h-10 w-10 text-white" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <DialogTitle className="text-2xl">Welcome to AI Whiteboard, {userName}! 👋</DialogTitle>
              <DialogDescription className="text-base">
                An AI-powered canvas where you can solve problems, get hints, and learn by doing.
                Let's take a quick tour to get you started!
              </DialogDescription>
            </div>
            <div className="flex justify-center gap-3">
              <Button onClick={handleNext} size="lg" className="gap-2">
                Get Started
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button onClick={onSkip} variant="ghost" size="lg">
                Skip Tour
              </Button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <DialogTitle className="text-2xl">Quick role check</DialogTitle>
              <DialogDescription>
                We detected you're a {userRole}. Is that correct?
              </DialogDescription>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={() => handleRoleUpdate('student')}
                variant={selectedRole === 'student' ? 'default' : 'outline'}
                size="lg"
                className="h-24 flex-col gap-2"
              >
                <BookOpen className="h-8 w-8" />
                <span>Student</span>
              </Button>
              <Button
                onClick={() => handleRoleUpdate('teacher')}
                variant={selectedRole === 'teacher' ? 'default' : 'outline'}
                size="lg"
                className="h-24 flex-col gap-2"
              >
                <Layout className="h-8 w-8" />
                <span>Teacher</span>
              </Button>
            </div>
            <div className="flex justify-between">
              <Button onClick={handleBack} variant="ghost" className="gap-2">
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleNext} variant="outline">
                Skip
              </Button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <DialogTitle className="text-2xl">Powerful Features</DialogTitle>
              <DialogDescription>
                Here's what you can do with AI Whiteboard:
              </DialogDescription>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FeatureCard
                icon={<PencilLine className="h-6 w-6 text-blue-600" />}
                title="Draw & Work"
                description="Infinite canvas for problem solving"
              />
              <FeatureCard
                icon={<Sparkles className="h-6 w-6 text-purple-600" />}
                title="AI Tutoring"
                description="Get hints, feedback, or full solutions"
              />
              <FeatureCard
                icon={<MessageCircle className="h-6 w-6 text-green-600" />}
                title="Chat Tutor"
                description="Ask questions anytime"
              />
              <FeatureCard
                icon={<Mic className="h-6 w-6 text-orange-600" />}
                title="Voice Assistant"
                description="Hands-free help while you work"
              />
            </div>
            <div className="flex justify-between">
              <Button onClick={handleBack} variant="ghost" className="gap-2">
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleNext} className="gap-2">
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <DialogTitle className="text-2xl">Ready to get started?</DialogTitle>
              <DialogDescription>
                Choose your first step to begin your learning journey:
              </DialogDescription>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <Button
                onClick={handleJoinClass}
                size="lg"
                className="h-auto py-6 flex-col gap-2 bg-green-600 hover:bg-green-700"
              >
                <BookOpen className="h-8 w-8" />
                <span className="text-lg font-semibold">Join a Class</span>
                <span className="text-sm font-normal opacity-90">
                  Enter your teacher's code to see assignments
                </span>
              </Button>
              <Button
                onClick={handleCreateBoard}
                size="lg"
                variant="outline"
                className="h-auto py-6 flex-col gap-2"
              >
                <Layout className="h-8 w-8" />
                <span className="text-lg font-semibold">Create Practice Board</span>
                <span className="text-sm font-normal text-muted-foreground">
                  Try out the canvas and AI tutoring yourself
                </span>
              </Button>
            </div>
            <div className="flex justify-center">
              <Button onClick={handleBack} variant="ghost" className="gap-2">
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onSkip()}>
      <DialogContent className="sm:max-w-[600px]">
        <div className="space-y-6">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Step {currentStep} of {TOTAL_STEPS}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Step content */}
          {renderStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border p-4 space-y-2 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div className="space-y-1">
          <h4 className="font-semibold">{title}</h4>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}
