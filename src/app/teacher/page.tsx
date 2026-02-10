'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StrugglingStudentsPanel } from '@/components/teacher/StrugglingStudentsPanel';
import { createClient } from '@/lib/supabase/client';
import {
  UsersThree,
  FileText,
  Clock,
  Plus,
  CaretRight,
  BookOpenText,
  WarningCircle,
  CheckCircle,
  ArrowLeft,
  Sparkle,
  CalendarBlank,
} from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistance, format, isToday, isTomorrow, isPast } from 'date-fns';
import Link from 'next/link';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface DashboardStats {
  totalStudents: number;
  totalClasses: number;
  activeAssignments: number;
  pendingSubmissions: number;
  strugglingStudents: number;
  aiAssistsToday: number;
}

interface RecentAssignment {
  id: string;
  title: string;
  due_date: string | null;
  class: { id: string; name: string };
  submissionStats: {
    total: number;
    submitted: number;
    inProgress: number;
  };
}

interface RecentActivity {
  id: string;
  type: 'submission' | 'join' | 'help_request';
  message: string;
  timestamp: string;
  studentName?: string;
  assignmentTitle?: string;
  className?: string;
}

interface SubmissionStatus {
  status: string;
}

interface AssignmentWithClass {
  id: string;
  title: string;
  due_date: string | null;
  is_published: boolean;
  class: { id: string; name: string };
}

interface RecentSubmission {
  id: string;
  status: string;
  submitted_at: string | null;
  updated_at: string;
  student: { full_name: string } | null;
  assignment: {
    title: string;
    class: { name: string } | null;
  } | null;
}

interface RecentJoin {
  id: string;
  joined_at: string;
  student: { full_name: string } | null;
  class: { name: string } | null;
}

export default function TeacherDashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalClasses: 0,
    activeAssignments: 0,
    pendingSubmissions: 0,
    strugglingStudents: 0,
    aiAssistsToday: 0,
  });
  const [recentAssignments, setRecentAssignments] = useState<RecentAssignment[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [teacherName, setTeacherName] = useState<string>('');

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      setTeacherName(profile?.full_name || 'Teacher');

      const { data: classes } = await supabase
        .from('classes')
        .select('id')
        .eq('teacher_id', user.id)
        .eq('is_active', true);

      const classIds = classes?.map(c => c.id) || [];

      let totalStudents = 0;
      if (classIds.length > 0) {
        const { count } = await supabase
          .from('class_members')
          .select('*', { count: 'exact', head: true })
          .in('class_id', classIds);
        totalStudents = count || 0;
      }

      let assignments: AssignmentWithClass[] = [];
      let allAssignments: { id: string }[] = [];
      if (classIds.length > 0) {
        const { data } = await supabase
          .from('assignments')
          .select(`
            id,
            title,
            due_date,
            is_published,
            class:classes(id, name)
          `)
          .in('class_id', classIds)
          .eq('is_published', true)
          .order('created_at', { ascending: false })
          .limit(5);
        assignments = (data || []) as unknown as AssignmentWithClass[];
      }

      const assignmentsWithStats = await Promise.all(
        assignments.map(async (a) => {
          const { data: submissions } = await supabase
            .from('submissions')
            .select('status')
            .eq('assignment_id', a.id);

          return {
            ...a,
            submissionStats: {
              total: submissions?.length || 0,
              submitted: submissions?.filter((s: SubmissionStatus) => s.status === 'submitted').length || 0,
              inProgress: submissions?.filter((s: SubmissionStatus) => s.status === 'in_progress').length || 0,
            },
          };
        })
      );

      let pendingSubmissions = 0;
      let activeAssignments = 0;
      if (classIds.length > 0) {
        const { data: fetchedAssignments } = await supabase
          .from('assignments')
          .select('id')
          .in('class_id', classIds)
          .eq('is_published', true);

        allAssignments = fetchedAssignments || [];
        activeAssignments = allAssignments.length;

        if (allAssignments.length > 0) {
          const { count } = await supabase
            .from('submissions')
            .select('*', { count: 'exact', head: true })
            .in('assignment_id', allAssignments.map(a => a.id))
            .neq('status', 'submitted');
          pendingSubmissions = count || 0;
        }
      }

      // Count AI assists for today across the teacher's assignments
      let aiAssistsToday = 0;
      if (allAssignments.length > 0) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const { count } = await supabase
          .from('ai_usage')
          .select('*', { count: 'exact', head: true })
          .in('assignment_id', allAssignments.map((a) => a.id))
          .gte('created_at', startOfDay.toISOString())
          .lte('created_at', endOfDay.toISOString());

        aiAssistsToday = count || 0;
      }

      let strugglingData: { id: string }[] | null = null;
      if (allAssignments.length > 0) {
        const { data } = await supabase
          .from('submissions')
          .select('id')
          .in('assignment_id', allAssignments.map(a => a.id))
          .eq('is_struggling', true);
        strugglingData = data;
      }

      const activity: RecentActivity[] = [];

      if (classIds.length > 0) {
        const { data: recentSubmissions } = await supabase
          .from('submissions')
          .select(`
            id,
            status,
            submitted_at,
            updated_at,
            student:profiles!student_id(full_name),
            assignment:assignments!assignment_id(title, class:classes!class_id(name))
          `)
          .eq('status', 'submitted')
          .order('submitted_at', { ascending: false })
          .limit(5);

        (recentSubmissions as RecentSubmission[] | null)?.forEach((s) => {
          if (s.submitted_at) {
            activity.push({
              id: s.id,
              type: 'submission',
              message: `submitted "${s.assignment?.title}"`,
              timestamp: s.submitted_at,
              studentName: s.student?.full_name || 'Student',
              assignmentTitle: s.assignment?.title,
              className: s.assignment?.class?.name,
            });
          }
        });

        const { data: recentJoins } = await supabase
          .from('class_members')
          .select(`
            id,
            joined_at,
            student:profiles!student_id(full_name),
            class:classes!class_id(name)
          `)
          .in('class_id', classIds)
          .order('joined_at', { ascending: false })
          .limit(5);

        (recentJoins as RecentJoin[] | null)?.forEach((j) => {
          activity.push({
            id: j.id,
            type: 'join',
            message: `joined ${j.class?.name}`,
            timestamp: j.joined_at,
            studentName: j.student?.full_name || 'Student',
            className: j.class?.name,
          });
        });
      }

      activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setStats({
        totalStudents,
        totalClasses: classIds.length,
        activeAssignments,
        pendingSubmissions,
        strugglingStudents: strugglingData?.length || 0,
        aiAssistsToday,
      });
      setRecentAssignments(assignmentsWithStats);
      setRecentActivity(activity.slice(0, 8));
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDueDateBadge = (dueDate: string | null) => {
    if (!dueDate) return null;
    const date = new Date(dueDate);
    if (isPast(date)) {
      return <Badge variant="destructive">Past due</Badge>;
    }
    if (isToday(date)) {
      return <Badge className="bg-amber-500">Due today</Badge>;
    }
    if (isTomorrow(date)) {
      return <Badge variant="secondary">Due tomorrow</Badge>;
    }
    return null;
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'submission':
        return <CheckCircle weight="duotone" className="h-4 w-4 text-green-500" />;
      case 'join':
        return <UsersThree weight="duotone" className="h-4 w-4 text-blue-500" />;
      case 'help_request':
        return <WarningCircle weight="duotone" className="h-4 w-4 text-amber-500" />;
      default:
        return <Clock weight="duotone" className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-md" />
              <div className="space-y-2">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-36" />
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-8 w-16" />
                    </div>
                    <Skeleton className="h-12 w-12 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-32 mt-3" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <Skeleton className="h-5 w-40" />
                </CardHeader>
                <CardContent className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-20 w-full rounded-lg" />
                  ))}
                </CardContent>
              </Card>
            </div>
            <div>
              <Card>
                <CardHeader>
                  <Skeleton className="h-5 w-32" />
                </CardHeader>
                <CardContent className="space-y-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="flex items-start gap-3">
                      <Skeleton className="h-4 w-4 mt-0.5 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
                <ArrowLeft weight="duotone" className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-semibold">
                  Welcome back, {teacherName.split(' ')[0]}!
                </h1>
                <p className="text-muted-foreground">
                  {format(new Date(), 'EEEE, MMMM d, yyyy')}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" asChild>
                <Link href="/teacher/classes">
                  <BookOpenText weight="duotone" className="h-4 w-4 mr-2" />
                  My Classes
                </Link>
              </Button>
              <Button asChild>
                <Link href="/teacher/assignments/create">
                  <Plus weight="duotone" className="h-4 w-4 mr-2" />
                  New Assignment
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <TooltipProvider>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                key: 'students',
                label: 'Total Students',
                value: stats.totalStudents,
                subtitle: `Across ${stats.totalClasses} classes`,
                icon: <UsersThree weight="duotone" className="h-6 w-6 text-blue-600" />,
                iconBg: 'bg-blue-100',
                tooltip: 'Students currently enrolled in your active classes.',
                onClick: () => router.push('/teacher/classes'),
                cardClassName: 'hover:shadow-md transition-shadow cursor-pointer',
              },
              {
                key: 'assignments',
                label: 'Active Assignments',
                value: stats.activeAssignments,
                subtitle: `${stats.pendingSubmissions} pending submissions`,
                icon: <FileText weight="duotone" className="h-6 w-6 text-green-600" />,
                iconBg: 'bg-green-100',
                tooltip: 'Published assignments that are still in progress.',
                onClick: () => router.push('/teacher/classes'),
                cardClassName: 'hover:shadow-md transition-shadow cursor-pointer',
              },
              {
                key: 'attention',
                label: 'Need Attention',
                value: stats.strugglingStudents,
                subtitle: 'Students showing struggle indicators',
                icon: <WarningCircle weight="duotone" className={`h-6 w-6 ${stats.strugglingStudents > 0 ? 'text-amber-600' : 'text-muted-foreground'}`} />,
                iconBg: stats.strugglingStudents > 0 ? 'bg-amber-100' : 'bg-muted',
                tooltip: 'Students flagged for repeated hints or long time-on-task.',
                onClick: undefined,
                cardClassName: `hover:shadow-md transition-shadow cursor-pointer ${stats.strugglingStudents > 0 ? 'border-amber-300' : ''}`,
              },
              {
                key: 'ai-assists',
                label: 'AI Assists Today',
                value: stats.aiAssistsToday,
                subtitle: 'Across all assignments today',
                icon: <Sparkle weight="duotone" className="h-6 w-6 text-purple-600" />,
                iconBg: 'bg-purple-100',
                tooltip: 'AI hints, guided steps, and quick solves requested in the last 24 hours.',
                onClick: undefined,
                cardClassName: 'hover:shadow-md transition-shadow',
              },
            ].map((stat, index) => (
              <motion.div
                key={stat.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.06 }}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Card className={stat.cardClassName} onClick={stat.onClick}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">{stat.label}</p>
                            <p className="text-3xl font-bold">{stat.value}</p>
                          </div>
                          <div className={`h-12 w-12 rounded-full flex items-center justify-center ${stat.iconBg}`}>
                            {stat.icon}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {stat.subtitle}
                        </p>
                      </CardContent>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{stat.tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </motion.div>
            ))}
          </div>
        </TooltipProvider>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarBlank weight="duotone" className="h-5 w-5" />
                  Recent Assignments
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/teacher/classes">
                    View all <CaretRight weight="duotone" className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {recentAssignments.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText weight="duotone" className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground mb-4">No assignments yet</p>
                    <Button asChild>
                      <Link href="/teacher/assignments/create">
                        <Plus weight="duotone" className="h-4 w-4 mr-2" />
                        Create your first assignment
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentAssignments.map((assignment, index) => (
                      <motion.div
                        key={assignment.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.06 }}
                      >
                        <div
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => router.push(`/teacher/classes/${assignment.class.id}/assignments/${assignment.id}`)}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{assignment.title}</span>
                              {getDueDateBadge(assignment.due_date)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {assignment.class.name}
                            </p>
                          </div>
                          <div className="text-right min-w-[80px]">
                            <div className="text-lg font-semibold">
                              {assignment.submissionStats.submitted}/{assignment.submissionStats.total}
                            </div>
                            <div className="mt-1 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 rounded-full transition-all duration-500"
                                style={{
                                  width: assignment.submissionStats.total > 0
                                    ? `${(assignment.submissionStats.submitted / assignment.submissionStats.total) * 100}%`
                                    : '0%',
                                }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">submitted</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <StrugglingStudentsPanel refreshInterval={60000} />
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock weight="duotone" className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentActivity.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock weight="duotone" className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No recent activity</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentActivity.map((activity, index) => (
                      <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.06 }}
                        className="flex items-start gap-3"
                      >
                        <div className="mt-0.5">{getActivityIcon(activity.type)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">
                            <span className="font-medium">{activity.studentName}</span>{' '}
                            {activity.message}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistance(new Date(activity.timestamp), new Date(), { addSuffix: true })}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href="/teacher/assignments/create">
                    <Plus weight="duotone" className="h-4 w-4 mr-2" />
                    Create Assignment
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href="/teacher/classes">
                    <UsersThree weight="duotone" className="h-4 w-4 mr-2" />
                    Manage Classes
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link href="/teacher/templates">
                    <BookOpenText weight="duotone" className="h-4 w-4 mr-2" />
                    Assignment Templates
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
