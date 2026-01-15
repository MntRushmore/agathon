'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  getAssignment,
  getAssignmentSubmissions,
  deleteAssignment,
  updateAssignment,
} from '@/lib/api/assignments';
import {
  ArrowLeft,
  Trash2,
  Eye,
  Clock,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Settings,
  BarChart3,
  Users,
  FileText,
  Save,
  Loader2,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistance, format, isPast, isToday, isTomorrow } from 'date-fns';
import { StrugglingStudentsPanel } from '@/components/teacher/StrugglingStudentsPanel';
import { ConceptMasteryHeatmap } from '@/components/teacher/ConceptMasteryHeatmap';
import { AIFeedbackPanel } from '@/components/teacher/AIFeedbackPanel';

interface SubmissionWithDetails {
  id: string;
  status: 'not_started' | 'in_progress' | 'submitted';
  submitted_at: string | null;
  created_at: string;
  ai_help_count?: number;
  solve_mode_count?: number;
  time_spent_seconds?: number;
  is_struggling?: boolean;
  student: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
  student_board: {
    id: string;
    title: string;
    updated_at: string;
    preview: string | null;
  } | null;
}

interface AssignmentDetails {
  id: string;
  title: string;
  instructions: string | null;
  due_date: string | null;
  is_published: boolean;
  created_at: string;
  metadata?: {
    allowAI?: boolean;
    allowedModes?: string[];
    hintLimit?: number | null;
  };
  class: {
    id: string;
    name: string;
    subject: string | null;
  };
  template_board: {
    id: string;
    title: string;
    preview: string | null;
  } | null;
}

export default function AssignmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const classId = params.id as string;
  const assignmentId = params.assignmentId as string;

  const [assignment, setAssignment] = useState<AssignmentDetails | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [editedTitle, setEditedTitle] = useState('');
  const [editedInstructions, setEditedInstructions] = useState('');
  const [editedDueDate, setEditedDueDate] = useState('');
  const [allowAI, setAllowAI] = useState(true);
  const [allowedModes, setAllowedModes] = useState<string[]>(['feedback', 'suggest', 'answer']);
  const [hintLimit, setHintLimit] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [assignmentData, submissionsData] = await Promise.all([
        getAssignment(assignmentId),
        getAssignmentSubmissions(assignmentId),
      ]);

      const a = assignmentData as AssignmentDetails;
      setAssignment(a);
      setSubmissions(submissionsData as SubmissionWithDetails[]);

      setEditedTitle(a.title);
      setEditedInstructions(a.instructions || '');
      setEditedDueDate(a.due_date ? a.due_date.split('T')[0] : '');
      setAllowAI(a.metadata?.allowAI !== false);
      setAllowedModes(a.metadata?.allowedModes || ['feedback', 'suggest', 'answer']);
      setHintLimit(a.metadata?.hintLimit || null);
    } catch (error) {
      console.error('Error loading assignment data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load assignment details',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [assignmentId]);

  const handleSaveSettings = async () => {
    if (!assignment) return;
    setSaving(true);
    try {
      await updateAssignment(assignmentId, {
        title: editedTitle,
        instructions: editedInstructions || null,
        due_date: editedDueDate ? new Date(editedDueDate).toISOString() : null,
        metadata: {
          allowAI,
          allowedModes,
          hintLimit,
        },
      });
      toast({
        title: 'Settings Saved',
        description: 'Assignment settings have been updated',
      });
      loadData();
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAssignment(assignmentId);
      toast({
        title: 'Assignment Deleted',
        description: 'The assignment has been permanently deleted',
      });
      router.push(`/teacher/classes/${classId}`);
    } catch (error) {
      console.error('Error deleting assignment:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete assignment',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const toggleMode = (mode: string) => {
    setAllowedModes(prev =>
      prev.includes(mode)
        ? prev.filter(m => m !== mode)
        : [...prev, mode]
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Submitted
          </Badge>
        );
      case 'in_progress':
        return (
          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
            <Clock className="h-3 w-3 mr-1" />
            In Progress
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-500/10 text-gray-600 border-gray-500/20">
            <AlertCircle className="h-3 w-3 mr-1" />
            Not Started
          </Badge>
        );
    }
  };

  const getDueBadge = () => {
    if (!assignment?.due_date) return null;
    const date = new Date(assignment.due_date);
    if (isPast(date)) return <Badge variant="destructive">Past Due</Badge>;
    if (isToday(date)) return <Badge className="bg-amber-500">Due Today</Badge>;
    if (isTomorrow(date)) return <Badge variant="secondary">Due Tomorrow</Badge>;
    return null;
  };

  const stats = {
    total: submissions.length,
    submitted: submissions.filter((s) => s.status === 'submitted').length,
    inProgress: submissions.filter((s) => s.status === 'in_progress').length,
    notStarted: submissions.filter((s) => s.status === 'not_started').length,
    struggling: submissions.filter((s) => s.is_struggling).length,
  };

  const filteredSubmissions = submissions.filter(s => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'struggling') return s.is_struggling;
    return s.status === filterStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="h-8 bg-muted rounded skeleton w-1/3 mb-4" />
            <div className="h-6 bg-muted rounded skeleton w-1/4" />
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 bg-muted rounded-lg skeleton" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Assignment not found</h2>
          <p className="text-muted-foreground mb-4">This assignment may have been deleted.</p>
          <Button onClick={() => router.push(`/teacher/classes/${classId}`)}>
            Back to Class
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background page-transition">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push(`/teacher/classes/${classId}`)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-semibold">{assignment.title}</h1>
                {getDueBadge()}
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>{assignment.class.name}</span>
                {assignment.class.subject && (
                  <>
                    <span>•</span>
                    <span>{assignment.class.subject}</span>
                  </>
                )}
                {assignment.due_date && (
                  <>
                    <span>•</span>
                    <span>Due {format(new Date(assignment.due_date), 'PPP')}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
            <Card className="bg-muted/50 border-0">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold">{stats.total}</div>
                <div className="text-xs text-muted-foreground">Total Students</div>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-green-600">{stats.submitted}</div>
                <div className="text-xs text-green-600">Submitted</div>
              </CardContent>
            </Card>
            <Card className="bg-yellow-50 border-yellow-200">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-yellow-600">{stats.inProgress}</div>
                <div className="text-xs text-yellow-600">In Progress</div>
              </CardContent>
            </Card>
            <Card className="bg-gray-50 border-gray-200">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-gray-600">{stats.notStarted}</div>
                <div className="text-xs text-gray-600">Not Started</div>
              </CardContent>
            </Card>
            <Card className={stats.struggling > 0 ? 'bg-red-50 border-red-200' : 'bg-muted/50 border-0'}>
              <CardContent className="p-4 text-center">
                <div className={`text-3xl font-bold ${stats.struggling > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                  {stats.struggling}
                </div>
                <div className={`text-xs ${stats.struggling > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                  Need Help
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview" className="gap-2">
              <FileText className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="submissions" className="gap-2">
              <Users className="h-4 w-4" />
              Submissions
              {stats.submitted > 0 && (
                <Badge variant="secondary" className="ml-1">{stats.submitted}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Assignment Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {assignment.instructions && (
                      <div>
                        <Label className="text-muted-foreground">Instructions</Label>
                        <p className="mt-1 whitespace-pre-wrap">{assignment.instructions}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Created</Label>
                        <p className="mt-1">{format(new Date(assignment.created_at), 'PPP')}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Due Date</Label>
                        <p className="mt-1">
                          {assignment.due_date
                            ? format(new Date(assignment.due_date), 'PPP')
                            : 'No due date'}
                        </p>
                      </div>
                    </div>
                    {assignment.template_board && (
                      <div>
                        <Label className="text-muted-foreground">Template Board</Label>
                        <Button
                          variant="outline"
                          className="mt-2"
                          onClick={() => router.push(`/board/${assignment.template_board!.id}`)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Template
                          <ExternalLink className="h-3 w-3 ml-2" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Recent Submissions</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setActiveTab('submissions')}>
                      View All
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {submissions.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No submissions yet
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {submissions
                          .filter(s => s.status === 'submitted')
                          .slice(0, 5)
                          .map((submission) => (
                            <div
                              key={submission.id}
                              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                              onClick={() => submission.student_board && router.push(`/board/${submission.student_board.id}`)}
                            >
                              <div className="flex items-center gap-3">
                                {submission.student.avatar_url ? (
                                  <img
                                    src={submission.student.avatar_url}
                                    alt=""
                                    className="w-8 h-8 rounded-full"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                                    {(submission.student.full_name || submission.student.email)[0].toUpperCase()}
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium">{submission.student.full_name || 'Student'}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {submission.submitted_at && formatDistance(new Date(submission.submitted_at), new Date(), { addSuffix: true })}
                                  </p>
                                </div>
                              </div>
                              {getStatusBadge(submission.status)}
                            </div>
                          ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div>
                <StrugglingStudentsPanel assignmentId={assignmentId} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="submissions" className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Button
                  variant={filterStatus === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus('all')}
                >
                  All ({stats.total})
                </Button>
                <Button
                  variant={filterStatus === 'submitted' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus('submitted')}
                >
                  Submitted ({stats.submitted})
                </Button>
                <Button
                  variant={filterStatus === 'in_progress' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus('in_progress')}
                >
                  In Progress ({stats.inProgress})
                </Button>
                <Button
                  variant={filterStatus === 'not_started' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterStatus('not_started')}
                >
                  Not Started ({stats.notStarted})
                </Button>
                {stats.struggling > 0 && (
                  <Button
                    variant={filterStatus === 'struggling' ? 'destructive' : 'outline'}
                    size="sm"
                    onClick={() => setFilterStatus('struggling')}
                  >
                    Need Help ({stats.struggling})
                  </Button>
                )}
              </div>
            </div>

            {filteredSubmissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <Eye className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">No submissions found</h3>
                <p className="text-muted-foreground max-w-md">
                  {filterStatus === 'all'
                    ? 'Students will appear here once they receive this assignment.'
                    : 'No students match this filter.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSubmissions.map((submission) => (
                  <Card
                    key={submission.id}
                    className={`overflow-hidden hover:shadow-md transition-shadow ${submission.is_struggling ? 'border-red-300' : ''}`}
                  >
                    <div
                      className="aspect-video bg-muted relative cursor-pointer"
                      onClick={() => submission.student_board && router.push(`/board/${submission.student_board.id}`)}
                    >
                      {submission.student_board?.preview ? (
                        <img
                          src={submission.student_board.preview}
                          alt="Board preview"
                          className="w-full h-full object-cover"
                        />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-muted text-muted-foreground gap-2">
                            <FileText className="h-10 w-10 opacity-20" />
                            <span className="text-xs font-medium opacity-50">No preview available</span>
                          </div>
                        )}
                      <div className="absolute top-2 right-2">
                        {getStatusBadge(submission.status)}
                      </div>
                      {submission.is_struggling && (
                        <div className="absolute top-2 left-2">
                          <Badge variant="destructive">Needs Help</Badge>
                        </div>
                      )}
                    </div>

                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        {submission.student.avatar_url ? (
                          <img
                            src={submission.student.avatar_url}
                            alt=""
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-medium">
                            {(submission.student.full_name || submission.student.email)[0].toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {submission.student.full_name || 'Unknown Student'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {submission.student.email}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-3">
                        {submission.ai_help_count !== undefined && submission.ai_help_count > 0 && (
                          <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded">
                            <Sparkles className="h-3 w-3" />
                            {submission.ai_help_count} AI helps
                          </span>
                        )}
                        {submission.time_spent_seconds !== undefined && submission.time_spent_seconds > 0 && (
                          <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded">
                            <Clock className="h-3 w-3" />
                            {Math.round(submission.time_spent_seconds / 60)}m spent
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground mb-3">
                        {submission.status === 'submitted' && submission.submitted_at ? (
                          <>Submitted {formatDistance(new Date(submission.submitted_at), new Date(), { addSuffix: true })}</>
                        ) : submission.student_board ? (
                          <>Updated {formatDistance(new Date(submission.student_board.updated_at), new Date(), { addSuffix: true })}</>
                        ) : (
                          <>Created {formatDistance(new Date(submission.created_at), new Date(), { addSuffix: true })}</>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => submission.student_board && router.push(`/board/${submission.student_board.id}`)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <AIFeedbackPanel
                          submissionId={submission.id}
                          studentName={submission.student.full_name || 'Student'}
                          boardPreview={submission.student_board?.preview}
                          onFeedbackSent={loadData}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ConceptMasteryHeatmap assignmentId={assignmentId} />
              <StrugglingStudentsPanel assignmentId={assignmentId} />
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Assignment Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="instructions">Instructions</Label>
                  <Textarea
                    id="instructions"
                    value={editedInstructions}
                    onChange={(e) => setEditedInstructions(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={editedDueDate}
                    onChange={(e) => setEditedDueDate(e.target.value)}
                  />
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-medium mb-4">AI Assistance Settings</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Allow AI Assistance</Label>
                        <p className="text-sm text-muted-foreground">Students can use AI help on this assignment</p>
                      </div>
                      <Switch checked={allowAI} onCheckedChange={setAllowAI} />
                    </div>

                    {allowAI && (
                      <div className="ml-4 pl-4 border-l space-y-4">
                        <div>
                          <Label className="mb-2 block">Allowed AI Modes</Label>
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={allowedModes.includes('feedback')}
                                onChange={() => toggleMode('feedback')}
                                className="h-4 w-4 rounded"
                              />
                              <span className="text-sm">
                                <span className="font-medium text-blue-600">Feedback</span> - Light hints
                              </span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={allowedModes.includes('suggest')}
                                onChange={() => toggleMode('suggest')}
                                className="h-4 w-4 rounded"
                              />
                              <span className="text-sm">
                                <span className="font-medium text-amber-600">Suggest</span> - Guided hints
                              </span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={allowedModes.includes('answer')}
                                onChange={() => toggleMode('answer')}
                                className="h-4 w-4 rounded"
                              />
                              <span className="text-sm">
                                <span className="font-medium text-green-600">Solve</span> - Full solution
                              </span>
                            </label>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Hint Limit</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={0}
                              max={50}
                              value={hintLimit || ''}
                              onChange={(e) => setHintLimit(e.target.value ? parseInt(e.target.value) : null)}
                              className="w-24"
                              placeholder="None"
                            />
                            <span className="text-sm text-muted-foreground">
                              {hintLimit ? `${hintLimit} hints maximum` : 'Unlimited'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between pt-4 border-t">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Assignment
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Assignment?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete this assignment and all student submissions.
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          disabled={deleting}
                        >
                          {deleting ? 'Deleting...' : 'Delete Assignment'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <Button onClick={handleSaveSettings} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Settings
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
