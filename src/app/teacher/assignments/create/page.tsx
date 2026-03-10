'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase';
import { getTeacherClasses } from '@/lib/api/classes';
import { createAssignment, publishAssignment } from '@/lib/api/assignments';
import { Class, Whiteboard } from '@/types/database';
import {
  Check,
  BookOpen,
  UsersThree,
  CircleNotch,
  CalendarBlank,
  Sparkle,
} from '@phosphor-icons/react';
import { useToast } from '@/hooks/use-toast';
import { formatDistance } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

type Step = 'select-template' | 'configure' | 'publish';

const STEP_ORDER: Step[] = ['select-template', 'configure', 'publish'];

export default function CreateAssignmentPage() {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const [step, setStep] = useState<Step>('select-template');
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const [whiteboards, setWhiteboards] = useState<Whiteboard[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);

  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);

  const [allowAI, setAllowAI] = useState(true);
  const [allowedModes, setAllowedModes] = useState<string[]>(['feedback', 'suggest', 'answer']);
  const [hintLimit, setHintLimit] = useState<number | null>(null);
  const [hasHintLimit, setHasHintLimit] = useState(false);

  const [postToGC, setPostToGC] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: 'Not authenticated',
          description: 'Please sign in to create assignments',
          variant: 'destructive',
        });
        router.push('/');
        return;
      }

      const [boardsData, classesData] = await Promise.all([
        supabase
          .from('whiteboards')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false }),
        getTeacherClasses(),
      ]);

      if (boardsData.error) throw boardsData.error;

      setWhiteboards(boardsData.data || []);
      setClasses(classesData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load boards and classes',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBoard = (board: Whiteboard) => {
    setSelectedBoardId(board.id);
    setTitle(board.title || 'Untitled Assignment');
    setStep('configure');
  };

  const toggleClass = (classId: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(classId)
        ? prev.filter((id) => id !== classId)
        : [...prev, classId]
    );
  };

  const toggleMode = (mode: string) => {
    setAllowedModes((prev) =>
      prev.includes(mode)
        ? prev.filter((m) => m !== mode)
        : [...prev, mode]
    );
  };

  const handlePublish = async () => {
    if (!selectedBoardId || selectedClassIds.length === 0) {
      toast({
        title: 'Missing information',
        description: 'Please select a template and at least one class',
        variant: 'destructive',
      });
      return;
    }

    setPublishing(true);
    try {
      const assignmentPromises = selectedClassIds.map(async (classId) => {
        const assignment = await createAssignment({
          class_id: classId,
          template_board_id: selectedBoardId,
          title: title.trim(),
          instructions: instructions.trim() || null,
          due_date: dueDate ? new Date(dueDate).toISOString() : null,
          is_published: true,
          metadata: {
            allowAI,
            allowedModes,
            hintLimit: hasHintLimit ? hintLimit : null,
          },
        });

        const result = await publishAssignment(assignment.id);
        return { assignment, result };
      });

      const results = await Promise.all(assignmentPromises);

      const totalSuccess = results.reduce((sum, r) => sum + r.result.successful, 0);
      const totalFailed = results.reduce((sum, r) => sum + r.result.failed, 0);

      toast({
        title: 'Assignment published!',
        description: `Distributed to ${totalSuccess} students across ${selectedClassIds.length} ${
          selectedClassIds.length === 1 ? 'class' : 'classes'
        }${totalFailed > 0 ? `. ${totalFailed} failed.` : ''}`,
      });

      if (postToGC) {
        const gcLinkedResults = results.filter(({ assignment }) => {
          const cls = classes.find((c) => c.id === assignment.class_id);
          return cls?.gc_course_id;
        });

        if (gcLinkedResults.length === 0) {
          toast({
            title: 'Google Classroom',
            description: 'No selected classes are linked to Google Classroom. Import courses first from My Classes.',
            variant: 'destructive',
          });
        } else {
          const gcResults = await Promise.allSettled(
            gcLinkedResults.map(async ({ assignment }) => {
              const res = await fetch('/api/teacher/google-classroom/post-assignment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assignmentId: assignment.id }),
              });
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to post');
              }
              return res.json();
            })
          );

          let gcSuccesses = 0;
          let gcFailures = 0;
          for (const r of gcResults) {
            if (r.status === 'fulfilled') gcSuccesses++;
            else gcFailures++;
          }

          if (gcSuccesses > 0) {
            toast({
              title: 'Posted to Google Classroom',
              description: `Assignment posted to ${gcSuccesses} Google Classroom course${gcSuccesses > 1 ? 's' : ''}`,
            });
          }
          if (gcFailures > 0) {
            toast({
              title: 'Google Classroom issue',
              description: `Failed to post to ${gcFailures} course${gcFailures > 1 ? 's' : ''}. Check the console for details.`,
              variant: 'destructive',
            });
          }
        }
      }

      router.push('/teacher/classes');
    } catch (error) {
      console.error('Error publishing assignment:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to publish assignment',
        variant: 'destructive',
      });
    } finally {
      setPublishing(false);
    }
  };

  const selectedBoard = whiteboards.find((b) => b.id === selectedBoardId);
  const stepIndex = STEP_ORDER.indexOf(step);

  if (loading) {
    return (
      <div className="max-w-[1100px] mx-auto px-8 py-8">
        <div className="space-y-2 mb-8">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-5 w-1/2" />
        </div>
        <Skeleton className="h-10 w-full mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Create Assignment</h1>
        <p className="text-muted-foreground mt-1">
          Select a template board and distribute to your classes
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-3 mb-10">
        {[
          { key: 'select-template', label: 'Select Template' },
          { key: 'configure', label: 'Configure' },
          { key: 'publish', label: 'Publish' },
        ].map((s, i) => {
          const isCompleted = i < stepIndex;
          const isCurrent = s.key === step;
          return (
            <div key={s.key} className="flex items-center gap-3 flex-1">
              <div className={`flex items-center gap-2 ${isCurrent ? 'text-primary' : isCompleted ? 'text-primary' : 'text-muted-foreground'}`}>
                <motion.div
                  className={`flex items-center justify-center h-8 w-8 rounded-full border-2 text-sm font-medium transition-colors ${
                    isCompleted
                      ? 'bg-primary border-primary text-primary-foreground'
                      : isCurrent
                      ? 'border-primary text-primary'
                      : 'border-muted-foreground/40 text-muted-foreground'
                  }`}
                  animate={isCompleted ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  {isCompleted ? <Check weight="bold" className="h-4 w-4" /> : i + 1}
                </motion.div>
                <span className="text-sm font-medium hidden sm:inline">{s.label}</span>
              </div>
              {i < 2 && (
                <div className="flex-1 h-0.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: isCompleted ? '100%' : '0%' }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        {step === 'select-template' && (
          <motion.div
            key="select-template"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
          >
            <h2 className="text-xl font-semibold mb-4">Select Template Board</h2>
            {whiteboards.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <motion.div
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <BookOpen weight="duotone" className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  </motion.div>
                  <h3 className="text-lg font-medium mb-2">No boards yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Create a whiteboard first to use as a template
                  </p>
                  <Button onClick={() => router.push('/')}>Create Board</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {whiteboards.map((board, index) => (
                  <motion.div
                    key={board.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <Card
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedBoardId === board.id
                          ? 'ring-2 ring-primary'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => handleSelectBoard(board)}
                    >
                      <CardContent className="p-0">
                        {board.preview ? (
                          <img
                            src={board.preview}
                            alt={board.title}
                            className="w-full aspect-[16/10] object-cover rounded-t-lg"
                          />
                        ) : (
                          <div className="w-full aspect-[16/10] bg-muted rounded-t-lg flex items-center justify-center">
                            <BookOpen weight="duotone" className="h-12 w-12 text-muted-foreground" />
                          </div>
                        )}
                        <div className="p-4">
                          <h3 className="font-medium truncate">{board.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            Updated {formatDistance(new Date(board.updated_at), new Date(), { addSuffix: true })}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {step === 'configure' && selectedBoard && (
          <motion.div
            key="configure"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="space-y-6 max-w-2xl"
          >
            <div>
              <h2 className="text-xl font-semibold mb-4">Configure Assignment</h2>
              <div className="bg-muted/50 rounded-lg p-4 mb-6 flex items-center gap-3">
                <BookOpen weight="duotone" className="h-5 w-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Template</p>
                  <p className="font-medium">{selectedBoard.title}</p>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="title">Assignment Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Math Practice - Week 1"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructions">Instructions (optional)</Label>
                <Textarea
                  id="instructions"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Add instructions for students..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="due_date" className="flex items-center gap-2">
                  <CalendarBlank weight="duotone" className="h-4 w-4" />
                  Due Date (optional)
                </Label>
                <Input
                  id="due_date"
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>

              {/* AI Settings Card */}
              <Card>
                <CardContent className="pt-5 pb-4 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkle weight="duotone" className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <Label className="text-base">AI Assistance</Label>
                  </div>
                  <p className="text-xs text-muted-foreground -mt-2">
                    Control how students can use AI help on this assignment
                  </p>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="allow-ai" className="text-sm cursor-pointer">
                      Allow AI assistance
                    </Label>
                    <Switch
                      id="allow-ai"
                      checked={allowAI}
                      onCheckedChange={setAllowAI}
                    />
                  </div>

                  {allowAI && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3 border-t pt-4"
                    >
                      <p className="text-xs text-muted-foreground">Available modes:</p>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Feedback</span>
                            <p className="text-xs text-muted-foreground">Light hints pointing out where to look</p>
                          </div>
                          <Switch
                            checked={allowedModes.includes('feedback')}
                            onCheckedChange={() => toggleMode('feedback')}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm font-medium text-amber-600 dark:text-amber-400">Suggest</span>
                            <p className="text-xs text-muted-foreground">Guided hints for the next step</p>
                          </div>
                          <Switch
                            checked={allowedModes.includes('suggest')}
                            onCheckedChange={() => toggleMode('suggest')}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm font-medium text-green-600 dark:text-green-400">Solve</span>
                            <p className="text-xs text-muted-foreground">Full worked solution (use sparingly)</p>
                          </div>
                          <Switch
                            checked={allowedModes.includes('answer')}
                            onCheckedChange={() => toggleMode('answer')}
                          />
                        </div>
                      </div>

                      <div className="border-t pt-3">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="hint-limit" className="text-sm cursor-pointer">
                            Limit AI helps per student
                          </Label>
                          <Switch
                            id="hint-limit"
                            checked={hasHintLimit}
                            onCheckedChange={(checked) => {
                              setHasHintLimit(checked);
                              if (!checked) setHintLimit(null);
                            }}
                          />
                        </div>
                        {hasHintLimit && (
                          <div className="mt-2 flex items-center gap-2">
                            <Input
                              type="number"
                              min={1}
                              max={50}
                              value={hintLimit || ''}
                              onChange={(e) => setHintLimit(parseInt(e.target.value) || null)}
                              className="w-24"
                              placeholder="e.g., 5"
                            />
                            <span className="text-sm text-muted-foreground">hints maximum</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setStep('select-template')}>
                Back
              </Button>
              <Button onClick={() => setStep('publish')} disabled={!title.trim()}>
                Continue
              </Button>
            </div>
          </motion.div>
        )}

        {step === 'publish' && (
          <motion.div
            key="publish"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Summary Card */}
            <Card className="bg-muted/30">
              <CardContent className="pt-5 pb-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Assignment Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Title:</span>
                    <p className="font-medium">{title}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Template:</span>
                    <p className="font-medium">{selectedBoard?.title}</p>
                  </div>
                  {dueDate && (
                    <div>
                      <span className="text-muted-foreground">Due:</span>
                      <p className="font-medium">{new Date(dueDate).toLocaleDateString()}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">AI:</span>
                    <p className="font-medium">{allowAI ? `Enabled (${allowedModes.length} modes)` : 'Disabled'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div>
              <h2 className="text-xl font-semibold mb-4">Select Classes</h2>
            </div>

            {classes.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <UsersThree weight="duotone" className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No classes yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Create a class first to assign work to students
                  </p>
                  <Button onClick={() => router.push('/teacher/classes')}>Create Class</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {classes.map((classData, index) => (
                  <motion.div
                    key={classData.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <Card
                      className={`cursor-pointer transition-all ${
                        selectedClassIds.includes(classData.id)
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => toggleClass(classData.id)}
                    >
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-medium">{classData.name}</h3>
                            {classData.subject && (
                              <Badge variant="secondary">{classData.subject}</Badge>
                            )}
                            {classData.gc_course_id && (
                              <Badge variant="outline" className="text-green-600 border-green-300 dark:text-green-400 dark:border-green-700 text-xs">
                                GC
                              </Badge>
                            )}
                          </div>
                          {classData.grade_level && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {classData.grade_level}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <div className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                            selectedClassIds.includes(classData.id)
                              ? 'bg-primary border-primary'
                              : 'border-muted-foreground'
                          }`}>
                            {selectedClassIds.includes(classData.id) && (
                              <Check weight="bold" className="h-3 w-3 text-primary-foreground" />
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Google Classroom Integration */}
            {selectedClassIds.some((id) => classes.find((c) => c.id === id)?.gc_course_id) && (
              <Card className="bg-muted/30">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">Post to Google Classroom</span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        A link to this assignment will appear in your students&apos; Google Classroom
                      </p>
                    </div>
                    <Switch
                      checked={postToGC}
                      onCheckedChange={setPostToGC}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setStep('configure')}>
                Back
              </Button>
              <Button
                onClick={handlePublish}
                disabled={publishing || selectedClassIds.length === 0}
              >
                {publishing ? (
                  <>
                    <CircleNotch weight="bold" className="h-4 w-4 mr-2 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  `Publish to ${selectedClassIds.length} ${
                    selectedClassIds.length === 1 ? 'Class' : 'Classes'
                  }`
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
