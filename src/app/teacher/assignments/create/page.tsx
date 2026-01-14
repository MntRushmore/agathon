'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createClient } from '@/lib/supabase';
import { getTeacherClasses } from '@/lib/api/classes';
import { createAssignment, publishAssignment } from '@/lib/api/assignments';
import { Class, Whiteboard } from '@/types/database';
import { ArrowLeft, Check, Calendar, BookOpen, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistance } from 'date-fns';

type Step = 'select-template' | 'configure' | 'publish';

export default function CreateAssignmentPage() {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const [step, setStep] = useState<Step>('select-template');
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  // Data
  const [whiteboards, setWhiteboards] = useState<Whiteboard[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);

  // Form state
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);

  // AI controls
  const [allowAI, setAllowAI] = useState(true);
  const [allowedModes, setAllowedModes] = useState<string[]>(['feedback', 'suggest', 'answer']);

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

      // Load teacher's whiteboards and classes in parallel
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
      // Create assignment for each selected class
      const assignmentPromises = selectedClassIds.map(async (classId) => {
        // Create assignment record
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
          },
        });

        // Publish to all students (copy boards and create submissions)
        const result = await publishAssignment(assignment.id);
        return { assignment, result };
      });

      const results = await Promise.all(assignmentPromises);

      // Count total successful distributions
      const totalSuccess = results.reduce((sum, r) => sum + r.result.successful, 0);
      const totalFailed = results.reduce((sum, r) => sum + r.result.failed, 0);

      toast({
        title: 'Assignment published!',
        description: `Distributed to ${totalSuccess} students across ${selectedClassIds.length} ${
          selectedClassIds.length === 1 ? 'class' : 'classes'
        }${totalFailed > 0 ? `. ${totalFailed} failed.` : ''}`,
      });

      router.push('/teacher/classes');
    } catch (error: any) {
      console.error('Error publishing assignment:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to publish assignment',
        variant: 'destructive',
      });
    } finally {
      setPublishing(false);
    }
  };

  const selectedBoard = whiteboards.find((b) => b.id === selectedBoardId);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="h-8 bg-muted rounded skeleton w-1/3 mb-6" />
          <div className="grid grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 bg-muted rounded-lg skeleton" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background page-transition">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => router.push('/teacher/classes')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-semibold">Create Assignment</h1>
            <p className="text-muted-foreground mt-1">
              Select a template board and distribute to your classes
            </p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-4 mb-12">
          <div className={`flex items-center gap-2 ${step === 'select-template' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`flex items-center justify-center h-8 w-8 rounded-full border-2 ${step !== 'select-template' ? 'bg-primary border-primary text-primary-foreground' : 'border-current'}`}>
              {step !== 'select-template' ? <Check className="h-4 w-4" /> : '1'}
            </div>
            <span className="text-sm font-medium">Select Template</span>
          </div>
          <div className="flex-1 h-0.5 bg-muted" />
          <div className={`flex items-center gap-2 ${step === 'configure' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`flex items-center justify-center h-8 w-8 rounded-full border-2 ${step === 'publish' ? 'bg-primary border-primary text-primary-foreground' : 'border-current'}`}>
              {step === 'publish' ? <Check className="h-4 w-4" /> : '2'}
            </div>
            <span className="text-sm font-medium">Configure</span>
          </div>
          <div className="flex-1 h-0.5 bg-muted" />
          <div className={`flex items-center gap-2 ${step === 'publish' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className="flex items-center justify-center h-8 w-8 rounded-full border-2 border-current">
              3
            </div>
            <span className="text-sm font-medium">Publish</span>
          </div>
        </div>

        {/* Step Content */}
        {step === 'select-template' && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Select Template Board</h2>
            {whiteboards.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No boards yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Create a whiteboard first to use as a template
                  </p>
                  <Button onClick={() => router.push('/')}>Create Board</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {whiteboards.map((board) => (
                  <Card
                    key={board.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
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
                          <BookOpen className="h-12 w-12 text-muted-foreground" />
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
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'configure' && selectedBoard && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Configure Assignment</h2>
              <div className="bg-muted/50 rounded-lg p-4 mb-6">
                <p className="text-sm text-muted-foreground mb-2">Template:</p>
                <p className="font-medium">{selectedBoard.title}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Assignment Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Math Practice - Week 1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="instructions">Instructions (optional)</Label>
                <Textarea
                  id="instructions"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Add instructions for students..."
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor="due_date">Due Date (optional)</Label>
                <Input
                  id="due_date"
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <div className="border-t pt-4">
                <Label>AI Assistance</Label>
                <div className="space-y-3 mt-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowAI}
                      onChange={(e) => setAllowAI(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm">Allow AI assistance for this assignment</span>
                  </label>

                  {allowAI && (
                    <div className="ml-6 space-y-2 border-l-2 pl-4">
                      <p className="text-xs text-muted-foreground mb-2">Select which AI modes students can use:</p>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allowedModes.includes('feedback')}
                          onChange={() => toggleMode('feedback')}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-sm">Feedback mode - AI provides hints and guidance</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allowedModes.includes('suggest')}
                          onChange={() => toggleMode('suggest')}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-sm">Suggest mode - AI suggests next steps</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allowedModes.includes('answer')}
                          onChange={() => toggleMode('answer')}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-sm">Solve mode - AI can solve the problem</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setStep('select-template')}>
                Back
              </Button>
              <Button onClick={() => setStep('publish')} disabled={!title.trim()}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 'publish' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Select Classes</h2>
              <div className="bg-muted/50 rounded-lg p-4 mb-6">
                <p className="text-sm text-muted-foreground mb-1">Assignment:</p>
                <p className="font-medium">{title}</p>
              </div>
            </div>

            {classes.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No classes yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Create a class first to assign work to students
                  </p>
                  <Button onClick={() => router.push('/teacher/classes')}>Create Class</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {classes.map((classData) => (
                  <Card
                    key={classData.id}
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
                        </div>
                        {classData.grade_level && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {classData.grade_level}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className={`h-5 w-5 rounded border-2 flex items-center justify-center ${
                          selectedClassIds.includes(classData.id)
                            ? 'bg-primary border-primary'
                            : 'border-muted-foreground'
                        }`}>
                          {selectedClassIds.includes(classData.id) && (
                            <Check className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setStep('configure')}>
                Back
              </Button>
              <Button
                onClick={handlePublish}
                disabled={publishing || selectedClassIds.length === 0}
              >
                {publishing
                  ? 'Publishing...'
                  : `Publish to ${selectedClassIds.length} ${
                      selectedClassIds.length === 1 ? 'Class' : 'Classes'
                    }`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
