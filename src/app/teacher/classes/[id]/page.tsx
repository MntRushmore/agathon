'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ClassRoster } from '@/components/teacher/ClassRoster';
import { getClass, getClassMembers } from '@/lib/api/classes';
import { getClassAssignments, getAssignmentStats } from '@/lib/api/assignments';
import { Class } from '@/types/database';
import { ArrowLeft, Copy, Users, BookOpen, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistance } from 'date-fns';

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

      // Fetch stats for each assignment
      const assignmentsWithStats = await Promise.all(
        fetchedAssignments.map(async (assignment: any) => {
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
      toast({
        title: 'Copied!',
        description: `Join code ${classData.join_code} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: 'Failed to copy',
        description: 'Could not copy join code to clipboard',
        variant: 'destructive',
      });
    }
  };

  if (loading || !classData) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="h-8 bg-muted rounded skeleton w-1/3 mb-4" />
            <div className="h-6 bg-muted rounded skeleton w-1/4" />
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="h-10 bg-muted rounded skeleton w-1/2 mb-6" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted rounded skeleton" />
            ))}
          </div>
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
            <Button variant="ghost" size="icon" onClick={() => router.push('/teacher/classes')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-semibold">{classData.name}</h1>
                <Button variant="ghost" size="icon" onClick={() => {/* TODO: Edit dialog */}}>
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {classData.grade_level && (
                  <span className="text-muted-foreground">{classData.grade_level}</span>
                )}
                {classData.subject && <Badge variant="secondary">{classData.subject}</Badge>}
              </div>
            </div>
          </div>

          {classData.description && (
            <p className="text-muted-foreground mb-4">{classData.description}</p>
          )}

          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Join Code:</span>
              <code className="text-lg font-mono font-bold px-3 py-1 bg-card rounded border">
                {classData.join_code}
              </code>
            </div>
            <Button variant="outline" size="sm" onClick={handleCopyJoinCode}>
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="students" className="gap-2">
              <Users className="h-4 w-4" />
              Students ({members.length})
            </TabsTrigger>
            <TabsTrigger value="assignments" className="gap-2">
              <BookOpen className="h-4 w-4" />
              Assignments ({assignments.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="students">
            <ClassRoster classId={classId} members={members} onUpdate={loadClassData} />
          </TabsContent>

          <TabsContent value="assignments">
            {assignments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <BookOpen className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">No assignments yet</h3>
                <p className="text-muted-foreground mb-6 max-w-md">
                  Create your first assignment to distribute work to your students.
                </p>
                <Button onClick={() => router.push('/teacher/assignments/create')}>
                  Create Assignment
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {assignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="border rounded-lg p-6 hover:bg-muted/50 transition-colors cursor-pointer"
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
                          <div className="text-xs text-muted-foreground">submitted</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
