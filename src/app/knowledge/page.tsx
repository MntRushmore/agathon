'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { sileo } from 'sileo';
import { createClient } from '@/lib/supabase';
import {
  ArrowLeft,
  CircleNotch,
  GoogleDriveLogo,
  GraduationCap,
  MagnifyingGlass,
  ArrowsClockwise,
  Plugs,
  Trash,
  Books,
  File,
  PencilLine,
  BookOpenText,
  CaretRight,
  CaretDown,
  Clock,
  CheckCircle,
  Warning,
} from '@phosphor-icons/react';

interface Connection {
  id: string;
  provider: string;
  status: string;
  display_name: string;
  connected_at: string;
  last_synced_at: string | null;
}

interface KBDocument {
  id: string;
  source: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  synced_at: string;
}

interface Course {
  id: string;
  name: string;
  assignmentCount: number;
  url?: string;
}

interface Assignment {
  id: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  synced_at: string;
}

const PROVIDER_CONFIG = {
  google_drive: {
    label: 'Google Drive',
    description: 'Sync documents and files from your Drive',
    icon: GoogleDriveLogo,
  },
  google_classroom: {
    label: 'Google Classroom',
    description: 'Sync courses, assignments, and materials',
    icon: GraduationCap,
  },
} as const;

type Provider = keyof typeof PROVIDER_CONFIG;

export default function KnowledgePage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [connections, setConnections] = useState<Connection[]>([]);
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [totalDocs, setTotalDocs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  // Classroom state
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [classroomConnected, setClassroomConnected] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KBDocument[]>([]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/knowledge/status');
      if (!res.ok) return;
      const data = await res.json();
      setConnections(data.connections || []);
      setDocuments(data.documents || []);
      setTotalDocs(data.totalDocuments || 0);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchClassroomData = useCallback(async (courseId?: string | null) => {
    try {
      const params = new URLSearchParams();
      if (courseId) params.set('course', courseId);
      const res = await fetch(`/api/knowledge/assignments?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      setClassroomConnected(data.connected);
      setCourses(data.courses || []);
      setAssignments(data.assignments || []);
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    if (!user) {
      router.push('/?auth=required');
      return;
    }
    fetchStatus();
    fetchClassroomData();
  }, [user, router, fetchStatus, fetchClassroomData]);

  // Handle callback params
  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');

    if (connected) {
      sileo.success({ title: `${PROVIDER_CONFIG[connected as Provider]?.label || connected} connected! Syncing content...` });
      handleSync(connected as Provider);
      router.replace('/knowledge');
    }
    if (error) {
      sileo.error({ title: 'Connection failed. Please try again.' });
      router.replace('/knowledge');
    }
  }, [searchParams, router]);

  const getConnection = (provider: Provider) =>
    connections.find(c => c.provider === provider && (c.status === 'active' || c.status === 'expired'));

  const isExpired = (provider: Provider) =>
    connections.find(c => c.provider === provider)?.status === 'expired';

  const handleConnect = async (provider: Provider) => {
    setConnecting(provider);
    try {
      const res = await fetch('/api/knowledge/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json();
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        sileo.error({ title: 'Failed to start connection' });
      }
    } catch {
      sileo.error({ title: 'Failed to connect' });
    } finally {
      setConnecting(null);
    }
  };

  const handleSync = async (provider?: Provider) => {
    setSyncing(provider || 'all');
    try {
      const res = await fetch('/api/knowledge/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json();
      if (data.success) {
        sileo.success({ title: `Synced ${data.synced} documents` });
        fetchStatus();
        fetchClassroomData();
      } else {
        sileo.error({ title: data.error || 'Sync failed' });
      }
    } catch {
      sileo.error({ title: 'Sync failed' });
    } finally {
      setSyncing(null);
    }
  };

  const handleDisconnect = async (provider: Provider) => {
    setDisconnecting(provider);
    try {
      const res = await fetch('/api/knowledge/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json();
      if (data.success) {
        sileo.success({ title: `${PROVIDER_CONFIG[provider].label} disconnected` });
        fetchStatus();
        if (provider === 'google_classroom') {
          setCourses([]);
          setAssignments([]);
          setClassroomConnected(false);
        }
      } else {
        sileo.error({ title: 'Failed to disconnect' });
      }
    } catch {
      sileo.error({ title: 'Failed to disconnect' });
    } finally {
      setDisconnecting(null);
    }
  };

  const handleSearch = () => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) { setSearchResults([]); return; }
    const results = documents.filter(
      (doc) =>
        doc.title?.toLowerCase().includes(q) ||
        doc.content?.toLowerCase().includes(q)
    );
    setSearchResults(results.slice(0, 10).map(doc => ({ ...doc, content: doc.content?.slice(0, 500) || '' })));
  };

  const openInBoard = async (doc: { title: string; content?: string; metadata?: Record<string, unknown> }) => {
    if (!user) return;
    try {
      const courseworkId = doc.metadata?.coursework_id as string | undefined;

      // If this is a GC assignment, check if a board already exists for it
      if (courseworkId) {
        const { data: existing } = await supabase
          .from('whiteboards')
          .select('id')
          .eq('user_id', user.id)
          .filter('metadata->>gcCourseworkId', 'eq', courseworkId)
          .limit(1)
          .maybeSingle();

        if (existing) {
          router.push(`/board/${existing.id}`);
          return;
        }
      }

      const docUrl = doc.metadata?.url as string | undefined;
      const { data, error } = await supabase
        .from('whiteboards')
        .insert([{
          name: doc.title || 'Untitled',
          title: doc.title || 'Untitled',
          user_id: user.id,
          data: {},
          metadata: {
            templateId: 'blank',
            subject: (doc.metadata?.course_name as string) || 'General',
            instructions: doc.content || '',
            ...(docUrl ? { documentUrl: toEmbedUrl(docUrl), documentTitle: doc.title || 'Document' } : {}),
            ...(doc.metadata?.course_id ? { gcCourseId: doc.metadata.course_id as string } : {}),
            ...(courseworkId ? { gcCourseworkId: courseworkId } : {}),
          },
        }])
        .select()
        .single();
      if (error) throw error;
      sileo.success({ title: 'Board created' });
      router.push(`/board/${data.id}`);
    } catch {
      sileo.error({ title: 'Failed to create board' });
    }
  };

  const openInJournal = async (doc: { title: string; content?: string }) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('journals')
        .insert([{
          user_id: user.id,
          title: doc.title || 'Untitled',
          content: [
            { type: 'heading', content: doc.title || 'Untitled' },
            { type: 'paragraph', content: doc.content || '' },
          ],
        }])
        .select()
        .single();
      if (error) throw error;
      sileo.success({ title: 'Journal created' });
      router.push(`/journal/${data.id}`);
    } catch {
      sileo.error({ title: 'Failed to create journal' });
    }
  };

  const toggleCourse = (courseId: string) => {
    if (expandedCourse === courseId) {
      setExpandedCourse(null);
    } else {
      setExpandedCourse(courseId);
      fetchClassroomData(courseId);
    }
  };

  // Derived data
  const driveConnection = getConnection('google_drive');
  const classroomConnection = getConnection('google_classroom');
  const driveDocs = documents.filter(d => d.source === 'google_drive');
  const classroomDocs = documents.filter(d => d.source === 'google_classroom');
  const activeConnections = connections.filter(c => c.status === 'active' || c.status === 'expired');
  const courseAssignments = expandedCourse
    ? assignments.filter((a: any) => a.metadata?.course_id === expandedCourse)
    : assignments;

  if (!user) return null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <CircleNotch className="h-6 w-6 animate-spin text-muted-foreground" weight="duotone" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 pt-8 pb-16">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-8">
          <button
            onClick={() => router.back()}
            className="p-1.5 -ml-1.5 rounded-md hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" weight="duotone" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-foreground">Knowledge Base</h1>
            <p className="text-xs text-muted-foreground">Connect your accounts so Agathon can reference your work</p>
          </div>
          {activeConnections.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSync()}
              disabled={syncing !== null}
              className="gap-1.5"
            >
              {syncing === 'all' ? (
                <CircleNotch className="h-3.5 w-3.5 animate-spin" weight="duotone" />
              ) : (
                <ArrowsClockwise className="h-3.5 w-3.5" weight="duotone" />
              )}
              Sync All
            </Button>
          )}
        </div>

        {/* Stats Banner */}
        {totalDocs > 0 && (
          <div className="mb-8 p-4 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-3">
              <Books className="h-5 w-5 text-muted-foreground" weight="duotone" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {totalDocs} document{totalDocs !== 1 ? 's' : ''} in your knowledge base
                </p>
                <p className="text-xs text-muted-foreground">
                  Agathon will automatically reference these when helping you
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ──────────────── GOOGLE CLASSROOM SECTION ──────────────── */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <GraduationCap className="h-3.5 w-3.5" weight="duotone" />
              Google Classroom
            </h2>
            {classroomConnection && (
              <div className="flex items-center gap-1">
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => handleSync('google_classroom')}
                  disabled={syncing === 'google_classroom' || syncing === 'all'}
                  title="Sync"
                >
                  {syncing === 'google_classroom' ? (
                    <CircleNotch className="h-3.5 w-3.5 animate-spin" weight="duotone" />
                  ) : (
                    <ArrowsClockwise className="h-3.5 w-3.5 text-muted-foreground" weight="duotone" />
                  )}
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => handleDisconnect('google_classroom')}
                  disabled={disconnecting === 'google_classroom'}
                  title="Disconnect"
                >
                  {disconnecting === 'google_classroom' ? (
                    <CircleNotch className="h-3.5 w-3.5 animate-spin" weight="duotone" />
                  ) : (
                    <Trash className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" weight="duotone" />
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Expired warning */}
          {isExpired('google_classroom') && (
            <div className="mb-3 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20 flex items-center gap-3">
              <Warning className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" weight="duotone" />
              <p className="text-xs text-amber-700 dark:text-amber-400 flex-1">Connection expired. Reconnect to keep syncing.</p>
              <Button size="sm" variant="outline" className="shrink-0 h-7 text-xs" onClick={() => handleConnect('google_classroom')}>
                Reconnect
              </Button>
            </div>
          )}

          {classroomConnection ? (
            <div className="border border-border rounded-lg bg-card overflow-hidden">
              {/* Connection info bar */}
              <div className="px-4 py-2.5 bg-muted/30 border-b border-border flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-muted-foreground" weight="duotone" />
                <span className="text-xs text-muted-foreground flex-1">
                  {classroomDocs.length} items synced
                  {classroomConnection.last_synced_at && ` · Last synced ${formatRelativeTime(classroomConnection.last_synced_at)}`}
                </span>
                <span className="text-[10px] font-medium text-muted-foreground">
                  {isExpired('google_classroom') ? 'Expired' : 'Connected'}
                </span>
              </div>

              {/* Course list */}
              {courses.length > 0 ? (
                <div className="divide-y divide-border">
                  {courses.map(course => {
                    const isOpen = expandedCourse === course.id;
                    const thisCourseAssignments = isOpen ? courseAssignments : [];

                    return (
                      <div key={course.id}>
                        {/* Course row */}
                        <button
                          onClick={() => toggleCourse(course.id)}
                          className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors"
                        >
                          {isOpen ? (
                            <CaretDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" weight="bold" />
                          ) : (
                            <CaretRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" weight="bold" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{course.name}</p>
                          </div>
                          <Badge variant="secondary" className="text-[10px] shrink-0">
                            {course.assignmentCount} assignment{course.assignmentCount !== 1 ? 's' : ''}
                          </Badge>
                        </button>

                        {/* Expanded assignment list */}
                        {isOpen && (
                          <div className="bg-muted/20 border-t border-border">
                            {thisCourseAssignments.length > 0 ? (
                              <div className="divide-y divide-border/50">
                                {thisCourseAssignments.map((item: any) => {
                                  const subState = item.metadata?.submission_state;
                                  const isTurnedIn = subState === 'TURNED_IN';
                                  const isReturned = subState === 'RETURNED';
                                  const grade = item.metadata?.assigned_grade;
                                  const maxPts = item.metadata?.max_points;
                                  const dueDate = item.metadata?.due_date;
                                  let dueDateStr = '';
                                  let isOverdue = false;
                                  if (dueDate) {
                                    const d = typeof dueDate === 'string' ? new Date(dueDate) : new Date(dueDate.year, dueDate.month - 1, dueDate.day);
                                    dueDateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                                    isOverdue = d < new Date() && !isTurnedIn && !isReturned;
                                  }

                                  return (
                                    <div key={item.id} className="pl-10 pr-4 py-2.5 flex items-center gap-3">
                                      {/* Status icon */}
                                      {isReturned ? (
                                        <CheckCircle className="w-4 h-4 text-purple-500 shrink-0" weight="duotone" />
                                      ) : isTurnedIn ? (
                                        <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" weight="duotone" />
                                      ) : isOverdue ? (
                                        <Warning className="w-4 h-4 text-red-500 shrink-0" weight="duotone" />
                                      ) : (
                                        <Clock className="w-4 h-4 text-muted-foreground shrink-0" weight="duotone" />
                                      )}

                                      {/* Title + due date */}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm text-foreground truncate">{item.title}</p>
                                        {dueDateStr && (
                                          <p className={`text-[11px] ${isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                                            {isOverdue ? 'Was due' : 'Due'} {dueDateStr}
                                            {isReturned && grade != null && maxPts ? ` · ${grade}/${maxPts}` : ''}
                                          </p>
                                        )}
                                      </div>

                                      {/* Status badge */}
                                      {isReturned ? (
                                        <Badge className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-0 shrink-0">
                                          {grade != null && maxPts ? `${grade}/${maxPts}` : 'Returned'}
                                        </Badge>
                                      ) : isTurnedIn ? (
                                        <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 shrink-0">
                                          Done
                                        </Badge>
                                      ) : isOverdue ? (
                                        <Badge className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 shrink-0">
                                          Missing
                                        </Badge>
                                      ) : null}

                                      {/* Actions */}
                                      <div className="flex items-center gap-1 shrink-0">
                                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1 text-muted-foreground" onClick={() => openInBoard(item)}>
                                          <PencilLine className="w-3 h-3" weight="duotone" />
                                          Board
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1 text-muted-foreground" onClick={() => openInJournal(item)}>
                                          <BookOpenText className="w-3 h-3" weight="duotone" />
                                          Journal
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="pl-10 pr-4 py-4 text-xs text-muted-foreground">
                                No assignments found for this course.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="px-4 py-6 text-center">
                  <p className="text-sm text-muted-foreground">No courses found. Try syncing.</p>
                </div>
              )}
            </div>
          ) : (
            <div
              className="border border-dashed border-border rounded-lg p-5 flex items-center gap-4 cursor-pointer hover:border-primary/40 transition-colors bg-card"
              onClick={() => handleConnect('google_classroom')}
            >
              <GraduationCap className="w-6 h-6 text-muted-foreground shrink-0" weight="duotone" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Connect Google Classroom</p>
                <p className="text-xs text-muted-foreground">Sync courses, assignments, and materials</p>
              </div>
              {connecting === 'google_classroom' ? (
                <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" weight="duotone" />
              ) : (
                <Plugs className="h-4 w-4 text-muted-foreground" weight="duotone" />
              )}
            </div>
          )}
        </section>

        {/* ──────────────── GOOGLE DRIVE SECTION ──────────────── */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <GoogleDriveLogo className="h-3.5 w-3.5" weight="duotone" />
              Google Drive
            </h2>
            {driveConnection && (
              <div className="flex items-center gap-1">
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => handleSync('google_drive')}
                  disabled={syncing === 'google_drive' || syncing === 'all'}
                  title="Sync"
                >
                  {syncing === 'google_drive' ? (
                    <CircleNotch className="h-3.5 w-3.5 animate-spin" weight="duotone" />
                  ) : (
                    <ArrowsClockwise className="h-3.5 w-3.5 text-muted-foreground" weight="duotone" />
                  )}
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => handleDisconnect('google_drive')}
                  disabled={disconnecting === 'google_drive'}
                  title="Disconnect"
                >
                  {disconnecting === 'google_drive' ? (
                    <CircleNotch className="h-3.5 w-3.5 animate-spin" weight="duotone" />
                  ) : (
                    <Trash className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" weight="duotone" />
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Expired warning */}
          {isExpired('google_drive') && (
            <div className="mb-3 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20 flex items-center gap-3">
              <Warning className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" weight="duotone" />
              <p className="text-xs text-amber-700 dark:text-amber-400 flex-1">Connection expired. Reconnect to keep syncing.</p>
              <Button size="sm" variant="outline" className="shrink-0 h-7 text-xs" onClick={() => handleConnect('google_drive')}>
                Reconnect
              </Button>
            </div>
          )}

          {driveConnection ? (
            <div className="border border-border rounded-lg bg-card overflow-hidden">
              {/* Connection info bar */}
              <div className="px-4 py-2.5 bg-muted/30 border-b border-border flex items-center gap-2">
                <GoogleDriveLogo className="h-4 w-4 text-muted-foreground" weight="duotone" />
                <span className="text-xs text-muted-foreground flex-1">
                  {driveDocs.length} document{driveDocs.length !== 1 ? 's' : ''} synced
                  {driveConnection.last_synced_at && ` · Last synced ${formatRelativeTime(driveConnection.last_synced_at)}`}
                </span>
                <span className="text-[10px] font-medium text-muted-foreground">
                  {isExpired('google_drive') ? 'Expired' : 'Connected'}
                </span>
              </div>

              {/* Document list */}
              {driveDocs.length > 0 ? (
                <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
                  {driveDocs.map(doc => (
                    <div key={doc.id} className="px-4 py-2.5 flex items-center gap-3">
                      <File className="h-4 w-4 flex-shrink-0 text-muted-foreground" weight="duotone" />
                      <span className="text-sm text-foreground truncate flex-1">{doc.title || 'Untitled'}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1 text-muted-foreground" onClick={() => openInBoard(doc)}>
                          <PencilLine className="w-3 h-3" weight="duotone" />
                          Board
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1 text-muted-foreground" onClick={() => openInJournal(doc)}>
                          <BookOpenText className="w-3 h-3" weight="duotone" />
                          Journal
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-6 text-center">
                  <p className="text-sm text-muted-foreground">No documents found. Try syncing.</p>
                </div>
              )}
            </div>
          ) : (
            <div
              className="border border-dashed border-border rounded-lg p-5 flex items-center gap-4 cursor-pointer hover:border-primary/40 transition-colors bg-card"
              onClick={() => handleConnect('google_drive')}
            >
              <GoogleDriveLogo className="w-6 h-6 text-muted-foreground shrink-0" weight="duotone" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Connect Google Drive</p>
                <p className="text-xs text-muted-foreground">Sync documents and files from your Drive</p>
              </div>
              {connecting === 'google_drive' ? (
                <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" weight="duotone" />
              ) : (
                <Plugs className="h-4 w-4 text-muted-foreground" weight="duotone" />
              )}
            </div>
          )}
        </section>

        {/* ──────────────── SEARCH ──────────────── */}
        {totalDocs > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
              Search Your Knowledge
            </h2>
            <div className="border border-border rounded-lg bg-card p-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" weight="duotone" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search your connected notes and assignments..."
                    className="h-9 pl-9 text-sm bg-transparent border-border"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleSearch}
                  disabled={!searchQuery.trim()}
                  className="h-9 gap-1.5"
                >
                  <MagnifyingGlass className="h-3.5 w-3.5" weight="duotone" />
                  Search
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="mt-3 space-y-2">
                  {searchResults.map((result) => {
                    const isClassroom = result.source === 'google_classroom';
                    const SourceIcon = isClassroom ? GraduationCap : GoogleDriveLogo;
                    return (
                      <div key={result.id} className="p-3 rounded-md border border-border bg-background">
                        <div className="flex items-center gap-2 mb-1">
                          <SourceIcon className="h-3.5 w-3.5 text-muted-foreground" weight="duotone" />
                          <span className="text-xs font-medium text-foreground truncate">{result.title}</span>
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {isClassroom ? 'Classroom' : 'Drive'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{result.content}</p>
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openInBoard(result)}>
                            <PencilLine className="w-3 h-3" weight="duotone" />
                            Board
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openInJournal(result)}>
                            <BookOpenText className="w-3 h-3" weight="duotone" />
                            Journal
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {searchResults.length === 0 && searchQuery && (
                <p className="mt-3 text-xs text-muted-foreground text-center py-2">
                  No results found. Try different keywords.
                </p>
              )}
            </div>
          </section>
        )}

        {/* Empty State */}
        {activeConnections.length === 0 && (
          <div className="text-center py-12">
            <Books className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" weight="duotone" />
            <p className="text-sm font-medium text-foreground mb-1">No sources connected yet</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Connect Google Drive or Google Classroom above so Agathon can reference your notes and assignments
            </p>
          </div>
        )}

        {/* How it works */}
        <section>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">How it works</h2>
          <div className="border border-border rounded-lg bg-card divide-y divide-border">
            {[
              { step: '1', text: 'Connect your Google Drive or Google Classroom above' },
              { step: '2', text: 'Your documents, courses, and assignments are synced securely' },
              { step: '3', text: 'When you ask Agathon for help, it searches your content for relevant context' },
              { step: '4', text: 'Get personalized answers based on your actual study materials' },
            ].map((item) => (
              <div key={item.step} className="px-4 py-2.5 flex items-center gap-3">
                <span className="text-xs font-medium text-muted-foreground flex-shrink-0">
                  {item.step}.
                </span>
                <span className="text-sm text-foreground">{item.text}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function toEmbedUrl(url: string): string {
  if (url.includes('docs.google.com/document')) {
    return url.replace(/\/edit.*$/, '/preview');
  }
  const driveMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch && url.includes('drive.google.com')) {
    return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  }
  if (url.includes('docs.google.com/')) {
    return url.replace(/\/edit.*$/, '/preview');
  }
  return url;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
