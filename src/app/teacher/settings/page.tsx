'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/components/auth/auth-provider';
import { ArrowLeft, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import { Check, ExternalLink, Loader2 } from 'lucide-react';
import { sileo } from 'sileo';
import Link from 'next/link';
import type { GCCourse } from '@/types/google-classroom';

export default function TeacherSettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [courses, setCourses] = useState<GCCourse[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    // Show success toast if redirected after OAuth
    const connectedParam = searchParams.get('connected');
    if (connectedParam === 'google_classroom') {
      sileo.success({ title: 'Google Classroom connected successfully' });
    }
    const errorParam = searchParams.get('error');
    if (errorParam) {
      sileo.error({ title: 'Failed to connect Google Classroom' });
    }
  }, [searchParams]);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/teacher/google-classroom/courses');
      const data = await res.json();
      setConnected(data.connected);
      setCourses(data.courses || []);
    } catch {
      sileo.error({ title: 'Failed to load Google Classroom data' });
    } finally {
      setLoading(false);
    }
  };

  const toggleCourse = (courseId: string) => {
    setSelectedCourseIds((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) {
        next.delete(courseId);
      } else {
        next.add(courseId);
      }
      return next;
    });
  };

  const handleImport = async () => {
    if (selectedCourseIds.size === 0) return;

    setImporting(true);
    try {
      const res = await fetch('/api/teacher/google-classroom/import-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseIds: Array.from(selectedCourseIds) }),
      });
      const data = await res.json();

      if (data.imported > 0) {
        sileo.success({ title: `Imported ${data.imported} course${data.imported > 1 ? 's' : ''} as Agathon classes` });
      }
      if (data.skipped > 0) {
        sileo.info({ title: `${data.skipped} course${data.skipped > 1 ? 's were' : ' was'} already imported` });
      }

      setSelectedCourseIds(new Set());
      await fetchCourses();
    } catch {
      sileo.error({ title: 'Failed to import courses' });
    } finally {
      setImporting(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await fetch('/api/knowledge/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'google_classroom',
          redirect: '/teacher/settings',
        }),
      });
      const data = await res.json();
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        sileo.error({ title: 'Failed to start connection flow' });
        setConnecting(false);
      }
    } catch {
      sileo.error({ title: 'Failed to connect to Google Classroom' });
      setConnecting(false);
    }
  };

  const importableCourses = courses.filter((c) => !c.importedClassId);
  const importedCourses = courses.filter((c) => c.importedClassId);

  return (
    <div className="min-h-screen bg-background page-transition">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => router.push('/teacher')}>
            <ArrowLeft className="h-5 w-5" weight="bold" />
          </Button>
          <div>
            <h1 className="text-3xl font-semibold">Integrations</h1>
            <p className="text-muted-foreground mt-1">
              Connect external services to your teacher account
            </p>
          </div>
        </div>

        {/* Google Classroom Connection Status */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="h-6 w-6 text-green-600" fill="currentColor">
                    <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c1.66 0 3.22-.45 4.56-1.24l.44.44c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41l-.44-.44A8.96 8.96 0 0 0 21 12c0-4.97-4.03-9-9-9zm0 16c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7zm-1-11h2v3h3v2h-3v3h-2v-3H8v-2h3V8z" />
                  </svg>
                </div>
                <div>
                  <CardTitle className="text-lg">Google Classroom</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Import courses and post assignments
                  </p>
                </div>
              </div>
              {loading ? (
                <Skeleton className="h-6 w-24" />
              ) : connected ? (
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle weight="bold" className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="secondary">Not connected</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-10 w-40" />
            ) : !connected ? (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <WarningCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" weight="bold" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Google Classroom is not connected
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    Connect your Google account to import courses and post assignments directly from Agathon.
                  </p>
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={handleConnect}
                    disabled={connecting}
                  >
                    {connecting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      'Connect Google Classroom'
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Google Classroom is connected and syncing your courses.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Course Import Section */}
        {connected && !loading && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Import Courses</CardTitle>
              <p className="text-sm text-muted-foreground">
                Select Google Classroom courses to import as Agathon classes
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {courses.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No courses found in your Google Classroom account.
                </p>
              ) : (
                <>
                  {/* Importable courses */}
                  {importableCourses.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Available to import
                      </p>
                      {importableCourses.map((course) => (
                        <div
                          key={course.id}
                          className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedCourseIds.has(course.id)
                              ? 'border-primary bg-primary/5'
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => toggleCourse(course.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{course.name}</p>
                            {course.section && (
                              <p className="text-sm text-muted-foreground">{course.section}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {course.alternateLink && (
                              <a
                                href={course.alternateLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )}
                            <div
                              className={`h-5 w-5 rounded border-2 flex items-center justify-center ${
                                selectedCourseIds.has(course.id)
                                  ? 'bg-primary border-primary'
                                  : 'border-muted-foreground'
                              }`}
                            >
                              {selectedCourseIds.has(course.id) && (
                                <Check className="h-3 w-3 text-primary-foreground" />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      <Button
                        className="w-full mt-3"
                        onClick={handleImport}
                        disabled={importing || selectedCourseIds.size === 0}
                      >
                        {importing ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          `Import ${selectedCourseIds.size} Course${selectedCourseIds.size !== 1 ? 's' : ''}`
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Already imported courses */}
                  {importedCourses.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Already imported
                      </p>
                      {importedCourses.map((course) => (
                        <div
                          key={course.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{course.name}</p>
                            {course.section && (
                              <p className="text-sm text-muted-foreground">{course.section}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              <Check className="h-3 w-3 mr-1" />
                              Imported
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                            >
                              <Link href={`/teacher/classes/${course.importedClassId}`}>
                                View Class
                              </Link>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
