'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ClassRoster } from '@/components/teacher/ClassRoster';
import { getClass, getClassMembers } from '@/lib/api/classes';
import { getClassAssignments, getAssignmentStats } from '@/lib/api/assignments';
import { Class } from '@/types/database';
import {
  Copy,
  UsersThree,
  BookOpen,
  PencilSimple,
  Check,
  FileText,
  ChartBar,
} from '@phosphor-icons/react';
import { useToast } from '@/hooks/use-toast';
import { formatDistance } from 'date-fns';
import { EditClassDialog } from '@/components/teacher/EditClassDialog';
import { motion } from 'motion/react';

interface ClassMemberWithStudent {
  id: string;
  student_id: string;
  joined_at: string;
  student: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

interface FetchedAssignment {
  id: string;
  title: string;
  due_date: string | null;
  created_at: string;
}

interface AssignmentWithStats {
  id: string;
  title: string;
  due_date: string | null;
  created_at: string;
  stats?: {
    total: number;
    submitted: number;
  };
}

export default function ClassDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const classId = params.id as string;

  const [classData, setClassData] = useState<Class | null>(null);
  const [members, setMembers] = useState<ClassMemberWithStudent[]>([]);
  const [assignments, setAssignments] = useState<AssignmentWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('students');
  const [copied, setCopied] = useState(false);

  const loadClassData = async () => {
    setLoading(true);
    try {
      const [fetchedClass, fetchedMembers, fetchedAssignments] = await Promise.all([
        getClass(classId),
        getClassMembers(classId),
        getClassAssignments(classId),
      ]);

      setClassData(fetchedClass);
      setMembers(fetchedMembers as ClassMemberWithStudent[]);

      const assignmentsWithStats = await Promise.all(
        (fetchedAssignments as FetchedAssignment[]).map(async (assignment) => {
          try {
            const stats = await getAssignmentStats(assignment.id);
            return {
              id: assignment.id,
              title: assignment.title,
              due_date: assignment.due_date,
              created_at: assignment.created_at,
              stats: {
                total: stats.total,
                submitted: stats.submitted,
              },
            };
          } catch (error) {
            console.error('Error loading assignment stats:', error);
            return {
              id: assignment.id,
              title: assignment.title,
              due_date: assignment.due_date,
              created_at: assignment.created_at,
            };
          }
        })
      );

      setAssignments(assignmentsWithStats);
    } catch (error) {
      console.error('Error loading class data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load class details',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClassData();
  }, [classId]);

  const handleCopyJoinCode = async () => {
    if (!classData) return;

    try {
      await navigator.clipboard.writeText(classData.join_code);
      setCopied(true);
      toast({
        title: 'Copied!',
        description: `Join code ${classData.join_code} copied to clipboard`,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: 'Failed to copy',
        description: 'Could not copy join code to clipboard',
        variant: 'destructive',
      });
    }
  };

  const completionRate = (() => {
    if (assignments.length === 0) return 0;
    const withStats = assignments.filter((a) => a.stats);
    if (withStats.length === 0) return 0;
    const totalSubmitted = withStats.reduce((sum, a) => sum + (a.stats?.submitted || 0), 0);
    const totalPossible = withStats.reduce((sum, a) => sum + (a.stats?.total || 0), 0);
    if (totalPossible === 0) return 0;
    return Math.round((totalSubmitted / totalPossible) * 100);
  })();

  if (loading || !classData) {
    return (
      <div className="max-w-[1100px] mx-auto px-8 py-8">
        <div className="space-y-2 mb-8">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-5 w-1/4" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-10 w-1/2 mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const statsCards = [
    {
      label: 'Students',
      value: members.length,
      icon: <UsersThree weight="duotone" className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      label: 'Assignments',
      value: assignments.length,
      icon: <FileText weight="duotone" className="h-5 w-5 text-green-600 dark:text-green-400" />,
      iconBg: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      label: 'Completion Rate',
      value: `${completionRate}%`,
      icon: <ChartBar weight="duotone" className="h-5 w-5 text-purple-600 dark:text-purple-400" />,
      iconBg: 'bg-purple-100 dark:bg-purple-900/30',
    },
  ];

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-semibold">{classData.name}</h1>
              <EditClassDialog
                classData={classData}
                onClassUpdated={(updated) => {
                  setClassData(updated);
                  void loadClassData();
                }}
                trigger={(
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                    <PencilSimple weight="duotone" className="h-4 w-4" />
                  </Button>
                )}
              />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {classData.grade_level && (
                <span className="text-muted-foreground">{classData.grade_level}</span>
              )}
              {classData.subject && <Badge variant="secondary">{classData.subject}</Badge>}
            </div>
            {classData.description && (
              <p className="text-muted-foreground mt-2">{classData.description}</p>
            )}
          </div>

          {/* Join Code */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-dashed border-border">
            <div>
              <span className="text-xs text-muted-foreground block mb-0.5">Join Code</span>
              <code className="text-xl font-mono font-bold tracking-wider">
                {classData.join_code}
              </code>
            </div>
            <Button variant="outline" size="sm" onClick={handleCopyJoinCode} className="h-9">
              {copied ? (
                <Check weight="bold" className="h-4 w-4 text-green-600" />
              ) : (
                <Copy weight="duotone" className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {statsCards.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.06 }}
          >
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${stat.iconBg}`}>
                    {stat.icon}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="students" className="gap-2">
            <UsersThree weight="duotone" className="h-4 w-4" />
            Students ({members.length})
          </TabsTrigger>
          <TabsTrigger value="assignments" className="gap-2">
            <BookOpen weight="duotone" className="h-4 w-4" />
            Assignments ({assignments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="students">
          <ClassRoster classId={classId} members={members} onUpdate={loadClassData} />
        </TabsContent>

        <TabsContent value="assignments">
          {assignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg">
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="rounded-full bg-muted p-4 mb-4"
              >
                <BookOpen weight="duotone" className="h-8 w-8 text-muted-foreground" />
              </motion.div>
              <h3 className="text-lg font-medium mb-2">No assignments yet</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                Create your first assignment to distribute work to your students.
              </p>
              <Button onClick={() => router.push('/teacher/assignments/create')}>
                Create Assignment
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment, index) => (
                <motion.div
                  key={assignment.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <div
                    className="border rounded-lg p-5 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/teacher/classes/${classId}/assignments/${assignment.id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-medium mb-1">{assignment.title}</h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {assignment.due_date && (
                            <span>
                              Due {formatDistance(new Date(assignment.due_date), new Date(), { addSuffix: true })}
                            </span>
                          )}
                          <span>
                            Created {formatDistance(new Date(assignment.created_at), new Date(), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      {assignment.stats && (
                        <div className="text-right">
                          <div className="text-2xl font-bold">
                            {assignment.stats.submitted}/{assignment.stats.total}
                          </div>
                          <div className="mt-1 h-1.5 w-20 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full transition-all duration-500"
                              style={{
                                width: assignment.stats.total > 0
                                  ? `${(assignment.stats.submitted / assignment.stats.total) * 100}%`
                                  : '0%',
                              }}
                            />
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">submitted</div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
