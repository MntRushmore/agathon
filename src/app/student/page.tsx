'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'motion/react';
import { formatDistance, format, isPast, isToday, isTomorrow } from 'date-fns';
import Link from 'next/link';
import {
  GraduationCap,
  BookOpenText,
  Clock,
  CheckCircle,
  Plus,
  Sparkle,
  ArrowRight,
  CalendarBlank,
  Warning,
  Hourglass,
  ListChecks,
  Star,
} from '@phosphor-icons/react';

interface EnrolledClass {
  id: string;
  class_id: string;
  student_id: string;
  joined_at: string;
  class: {
    id: string;
    name: string;
    subject: string | null;
    grade_level: string | null;
    teacher_id: string;
  };
}

type SubmissionStatus = 'not_started' | 'in_progress' | 'submitted';

interface Submission {
  id: string;
  status: SubmissionStatus;
  student_board_id: string | null;
  ai_help_count: number;
  submitted_at: string | null;
}

interface Assignment {
  id: string;
  title: string;
  instructions: string | null;
  due_date: string | null;
  is_published: boolean;
  allow_ai: boolean;
  class: { id: string; name: string };
  submission: Submission | null;
}

interface Stats {
  enrolled: number;
  totalAssignments: number;
  submitted: number;
  inProgress: number;
  overdue: number;
}

function getDueLabel(dueDate: string | null): { label: string; color: string } {
  if (!dueDate) return { label: 'No due date', color: 'text-muted-foreground' };
  const d = new Date(dueDate);
  if (isPast(d)) return { label: `Overdue · ${format(d, 'MMM d')}`, color: 'text-red-500' };
  if (isToday(d)) return { label: 'Due today', color: 'text-orange-500' };
  if (isTomorrow(d)) return { label: 'Due tomorrow', color: 'text-orange-400' };
  return { label: `Due ${format(d, 'MMM d')}`, color: 'text-muted-foreground' };
}

function StatusBadge({ status }: { status: SubmissionStatus | undefined }) {
  if (!status || status === 'not_started') {
    return <Badge variant="secondary" className="text-xs">Not started</Badge>;
  }
  if (status === 'in_progress') {
    return <Badge variant="outline" className="text-xs text-blue-600 border-blue-200 bg-blue-50">In progress</Badge>;
  }
  return <Badge variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50">Submitted</Badge>;
}

export default function StudentDashboard() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState('');
  const [classes, setClasses] = useState<EnrolledClass[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [stats, setStats] = useState<Stats>({ enrolled: 0, totalAssignments: 0, submitted: 0, inProgress: 0, overdue: 0 });
  const [selectedClass, setSelectedClass] = useState<string>('all');

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      setStudentName(profile?.full_name || 'Student');

      // Load enrolled classes
      const { data: enrollments } = await supabase
        .from('class_members')
        .select(`
          id, class_id, student_id, joined_at,
          class:classes(id, name, subject, grade_level, teacher_id)
        `)
        .eq('student_id', user.id)
        .order('joined_at', { ascending: false });

      const enrolledClasses = (enrollments || []) as unknown as EnrolledClass[];
      setClasses(enrolledClasses);

      if (enrolledClasses.length === 0) {
        setLoading(false);
        return;
      }

      const classIds = enrolledClasses.map(e => e.class_id);

      // Load assignments for all enrolled classes
      const { data: assignmentData } = await supabase
        .from('assignments')
        .select(`
          id, title, instructions, due_date, is_published, allow_ai,
          class:classes!class_id(id, name)
        `)
        .in('class_id', classIds)
        .eq('is_published', true)
        .order('due_date', { ascending: true, nullsFirst: false });

      const rawAssignments = (assignmentData || []) as unknown as Omit<Assignment, 'submission'>[];

      // Load student's submissions for these assignments
      const assignmentIds = rawAssignments.map(a => a.id);
      let submissionsMap: Record<string, Assignment['submission']> = {};

      if (assignmentIds.length > 0) {
        const { data: subs } = await supabase
          .from('submissions')
          .select('id, assignment_id, status, student_board_id, ai_help_count, submitted_at')
          .eq('student_id', user.id)
          .in('assignment_id', assignmentIds);

        (subs || []).forEach((s: { id: string; assignment_id: string; status: string; student_board_id: string | null; ai_help_count: number; submitted_at: string | null }) => {
          submissionsMap[s.assignment_id] = {
            id: s.id,
            status: s.status as SubmissionStatus,
            student_board_id: s.student_board_id,
            ai_help_count: s.ai_help_count,
            submitted_at: s.submitted_at,
          };
        });
      }

      const fullAssignments: Assignment[] = rawAssignments.map(a => ({
        ...a,
        submission: submissionsMap[a.id] ?? null,
      }));

      setAssignments(fullAssignments);

      // Compute stats
      const submitted = fullAssignments.filter(a => a.submission?.status === 'submitted').length;
      const inProgress = fullAssignments.filter(a => a.submission?.status === 'in_progress').length;
      const overdue = fullAssignments.filter(a =>
        a.due_date && isPast(new Date(a.due_date)) && a.submission?.status !== 'submitted'
      ).length;

      setStats({
        enrolled: enrolledClasses.length,
        totalAssignments: fullAssignments.length,
        submitted,
        inProgress,
        overdue,
      });
    } catch (err) {
      console.error('[student/dashboard] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredAssignments = selectedClass === 'all'
    ? assignments
    : assignments.filter(a => a.class.id === selectedClass);

  const upcomingFirst = [...filteredAssignments].sort((a, b) => {
    // Submitted go to bottom, overdue to top, then by due date
    if (a.submission?.status === 'submitted' && b.submission?.status !== 'submitted') return 1;
    if (b.submission?.status === 'submitted' && a.submission?.status !== 'submitted') return -1;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            {loading ? (
              <Skeleton className="h-8 w-48 mb-2" />
            ) : (
              <h1 className="text-2xl font-semibold text-foreground">
                {studentName ? `Hey, ${studentName.split(' ')[0]}` : 'Your Dashboard'}
              </h1>
            )}
            <p className="text-sm text-muted-foreground mt-0.5">Here&apos;s where you stand today</p>
          </div>
          <Link href="/student/join">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Join a class
            </Button>
          </Link>
        </div>

        {/* Stats row */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {[
              { label: 'Classes', value: stats.enrolled, icon: GraduationCap, color: 'text-blue-500' },
              { label: 'Assignments', value: stats.totalAssignments, icon: BookOpenText, color: 'text-purple-500' },
              { label: 'Submitted', value: stats.submitted, icon: CheckCircle, color: 'text-green-500' },
              { label: 'Overdue', value: stats.overdue, icon: Warning, color: stats.overdue > 0 ? 'text-red-500' : 'text-muted-foreground' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className="bg-white rounded-xl p-4 flex flex-col gap-2"
                style={{ border: 'var(--affine-border)', boxShadow: 'var(--affine-shadow-card)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-medium">{label}</span>
                  <Icon className={`h-4 w-4 ${color}`} weight="duotone" />
                </div>
                <span className="text-2xl font-semibold tabular-nums">{value}</span>
              </div>
            ))}
          </motion.div>
        )}

        {/* Empty state */}
        {!loading && classes.length === 0 && (
          <div className="text-center py-20">
            <div className="rounded-full bg-muted p-5 mx-auto w-fit mb-4">
              <GraduationCap className="h-10 w-10 text-muted-foreground" weight="duotone" />
            </div>
            <h2 className="text-xl font-medium mb-2">No classes yet</h2>
            <p className="text-muted-foreground mb-6">Ask your teacher for a join code to get started.</p>
            <Link href="/student/join">
              <Button className="gap-1.5">
                <Plus className="h-4 w-4" />
                Join a class
              </Button>
            </Link>
          </div>
        )}

        {!loading && classes.length > 0 && (
          <div className="grid md:grid-cols-[240px_1fr] gap-6">
            {/* Sidebar: Classes */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1 mb-3">Classes</p>
              <button
                onClick={() => setSelectedClass('all')}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center justify-between group ${
                  selectedClass === 'all'
                    ? 'bg-white font-medium shadow-sm'
                    : 'hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                }`}
                style={selectedClass === 'all' ? { border: 'var(--affine-border)' } : {}}
              >
                <span>All classes</span>
                <span className="text-xs text-muted-foreground tabular-nums">{assignments.length}</span>
              </button>
              {classes.map(enrollment => {
                const count = assignments.filter(a => a.class.id === enrollment.class_id).length;
                const active = selectedClass === enrollment.class_id;
                return (
                  <button
                    key={enrollment.id}
                    onClick={() => setSelectedClass(enrollment.class_id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center justify-between ${
                      active
                        ? 'bg-white font-medium shadow-sm'
                        : 'hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                    }`}
                    style={active ? { border: 'var(--affine-border)' } : {}}
                  >
                    <span className="truncate mr-2">{enrollment.class.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">{count}</span>
                  </button>
                );
              })}
              <div className="pt-2">
                <Link href="/student/join" className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <Plus className="h-3.5 w-3.5" />
                  Join another class
                </Link>
              </div>
            </div>

            {/* Main: Assignments */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {selectedClass === 'all' ? 'All assignments' : classes.find(c => c.class_id === selectedClass)?.class.name}
                </p>
                <span className="text-xs text-muted-foreground">{upcomingFirst.length} total</span>
              </div>

              {upcomingFirst.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ListChecks className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No assignments yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {upcomingFirst.map((assignment, i) => {
                    const due = getDueLabel(assignment.due_date);
                    const isOverdue = assignment.due_date && isPast(new Date(assignment.due_date)) && assignment.submission?.status !== 'submitted';
                    return (
                      <motion.div
                        key={assignment.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="bg-white rounded-xl p-4 flex items-center gap-4 group cursor-pointer hover:shadow-md transition-shadow"
                        style={{ border: isOverdue ? '0.5px solid #fca5a5' : 'var(--affine-border)', boxShadow: 'var(--affine-shadow-card)' }}
                        onClick={() => {
                          if (assignment.submission?.student_board_id) {
                            router.push(`/board/${assignment.submission.student_board_id}`);
                          }
                        }}
                      >
                        {/* Status icon */}
                        <div className="shrink-0">
                          {assignment.submission?.status === 'submitted' ? (
                            <CheckCircle className="h-5 w-5 text-green-500" weight="duotone" />
                          ) : assignment.submission?.status === 'in_progress' ? (
                            <Hourglass className="h-5 w-5 text-blue-500" weight="duotone" />
                          ) : isOverdue ? (
                            <Warning className="h-5 w-5 text-red-400" weight="duotone" />
                          ) : (
                            <BookOpenText className="h-5 w-5 text-muted-foreground" weight="duotone" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-medium text-sm truncate">{assignment.title}</span>
                            {assignment.allow_ai && (
                              <Sparkle className="h-3.5 w-3.5 text-purple-400 shrink-0" weight="duotone" />
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-xs text-muted-foreground">{assignment.class.name}</span>
                            <span className={`text-xs flex items-center gap-1 ${due.color}`}>
                              <CalendarBlank className="h-3 w-3" />
                              {due.label}
                            </span>
                          </div>
                        </div>

                        {/* Right side */}
                        <div className="flex items-center gap-3 shrink-0">
                          <StatusBadge status={assignment.submission?.status} />
                          {assignment.submission?.ai_help_count ? (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Sparkle className="h-3 w-3" />
                              {assignment.submission.ai_help_count}
                            </span>
                          ) : null}
                          {assignment.submission?.student_board_id && (
                            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
