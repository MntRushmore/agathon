'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
} from '@/lib/api/assignments';
import { ArrowLeft, Trash2, Eye, Clock, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistance, format } from 'date-fns';

interface SubmissionWithDetails {
  id: string;
  status: 'not_started' | 'in_progress' | 'submitted';
  submitted_at: string | null;
  created_at: string;
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

  const loadData = async () => {
    setLoading(true);
    try {
      const [assignmentData, submissionsData] = await Promise.all([
        getAssignment(assignmentId),
        getAssignmentSubmissions(assignmentId),
      ]);

      setAssignment(assignmentData as AssignmentDetails);
      setSubmissions(submissionsData as SubmissionWithDetails[]);
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

  const stats = {
    total: submissions.length,
    submitted: submissions.filter((s) => s.status === 'submitted').length,
    inProgress: submissions.filter((s) => s.status === 'in_progress').length,
    notStarted: submissions.filter((s) => s.status === 'not_started').length,
  };

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
      {/* Header */}
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
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-semibold">{assignment.title}</h1>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-muted-foreground">{assignment.class.name}</span>
                {assignment.class.subject && (
                  <Badge variant="secondary">{assignment.class.subject}</Badge>
                )}
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
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
          </div>

          {/* Assignment Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Due Date</div>
              <div className="font-medium">
                {assignment.due_date
                  ? format(new Date(assignment.due_date), 'PPP')
                  : 'No due date'}
              </div>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Created</div>
              <div className="font-medium">
                {formatDistance(new Date(assignment.created_at), new Date(), { addSuffix: true })}
              </div>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Template Board</div>
              {assignment.template_board ? (
                <Button
                  variant="link"
                  className="p-0 h-auto font-medium"
                  onClick={() => router.push(`/board/${assignment.template_board!.id}`)}
                >
                  View Template
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              ) : (
                <span className="text-muted-foreground">Not available</span>
              )}
            </div>
          </div>

          {assignment.instructions && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Instructions</div>
              <p className="whitespace-pre-wrap">{assignment.instructions}</p>
            </div>
          )}
        </div>
      </div>

      {/* Submission Stats */}
      <div className="border-b bg-card/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">{stats.submitted}/{stats.total}</div>
              <div className="text-sm text-muted-foreground">submitted</div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>{stats.submitted} Submitted</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span>{stats.inProgress} In Progress</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400" />
                <span>{stats.notStarted} Not Started</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Submissions Grid */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <h2 className="text-xl font-semibold mb-6">Student Submissions</h2>

        {submissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Eye className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No submissions yet</h3>
            <p className="text-muted-foreground max-w-md">
              Students will appear here once they receive this assignment.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {submissions.map((submission) => (
              <div
                key={submission.id}
                className="border rounded-lg overflow-hidden hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => {
                  if (submission.student_board) {
                    router.push(`/board/${submission.student_board.id}`);
                  }
                }}
              >
                {/* Preview Image */}
                <div className="aspect-video bg-muted relative">
                  {submission.student_board?.preview ? (
                    <img
                      src={submission.student_board.preview}
                      alt="Board preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      No preview available
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    {getStatusBadge(submission.status)}
                  </div>
                </div>

                {/* Student Info */}
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-2">
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
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {submission.student.full_name || 'Unknown Student'}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {submission.student.email}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {submission.status === 'submitted' && submission.submitted_at ? (
                      <>Submitted {formatDistance(new Date(submission.submitted_at), new Date(), { addSuffix: true })}</>
                    ) : submission.student_board ? (
                      <>Last updated {formatDistance(new Date(submission.student_board.updated_at), new Date(), { addSuffix: true })}</>
                    ) : (
                      <>Created {formatDistance(new Date(submission.created_at), new Date(), { addSuffix: true })}</>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
