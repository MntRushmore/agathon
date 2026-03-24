'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClassCard } from '@/components/teacher/ClassCard';
import { CreateClassDialog } from '@/components/teacher/CreateClassDialog';
import { getTeacherClasses, getClassMemberCount } from '@/lib/api/classes';
import { Class } from '@/types/database';
import {
  GridFour,
  ListBullets,
  MagnifyingGlass,
  DownloadSimple,
  Check,
  CircleNotch,
  BookOpenText,
} from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { sileo } from 'sileo';
import type { GCCourse } from '@/types/google-classroom';

type ViewMode = 'grid' | 'list';

interface ClassWithCount extends Class {
  memberCount?: number;
}

export default function TeacherClassesPage() {
  const [classes, setClasses] = useState<ClassWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [gcConnected, setGcConnected] = useState(false);
  const [gcCourses, setGcCourses] = useState<GCCourse[]>([]);
  const [gcLoading, setGcLoading] = useState(true);
  const [showGcImport, setShowGcImport] = useState(false);
  const [selectedGcIds, setSelectedGcIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  const loadClasses = async () => {
    setLoading(true);
    try {
      const fetchedClasses = await getTeacherClasses();

      const classesWithCounts = await Promise.all(
        fetchedClasses.map(async (classData) => {
          const count = await getClassMemberCount(classData.id);
          return { ...classData, memberCount: count };
        })
      );

      setClasses(classesWithCounts);
    } catch (error) {
      console.error('Error loading classes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGcCourses = async () => {
    setGcLoading(true);
    try {
      const res = await fetch('/api/teacher/google-classroom/courses');
      if (res.ok) {
        const data = await res.json();
        setGcConnected(data.connected);
        setGcCourses((data.courses || []).filter((c: GCCourse) => !c.importedClassId));
      }
    } catch {
      // GC not available, that's fine
    } finally {
      setGcLoading(false);
    }
  };

  useEffect(() => {
    loadClasses();
    loadGcCourses();
  }, []);

  const handleImportCourses = async () => {
    if (selectedGcIds.size === 0) return;
    setImporting(true);
    try {
      const res = await fetch('/api/teacher/google-classroom/import-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseIds: Array.from(selectedGcIds) }),
      });
      const data = await res.json();

      if (data.imported > 0) {
        sileo.success({ title: `Imported ${data.imported} course${data.imported > 1 ? 's' : ''} from Google Classroom` });
      }
      if (data.skipped > 0) {
        sileo.info({ title: `${data.skipped} course${data.skipped > 1 ? 's were' : ' was'} already imported` });
      }

      setSelectedGcIds(new Set());
      setShowGcImport(false);
      await Promise.all([loadClasses(), loadGcCourses()]);
    } catch {
      sileo.error({ title: 'Failed to import courses' });
    } finally {
      setImporting(false);
    }
  };

  const toggleGcCourse = (id: string) => {
    setSelectedGcIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredClasses = classes.filter((classData) => {
    const query = searchQuery.toLowerCase();
    return (
      classData.name.toLowerCase().includes(query) ||
      classData.subject?.toLowerCase().includes(query) ||
      classData.grade_level?.toLowerCase().includes(query) ||
      classData.join_code?.toLowerCase().includes(query)
    );
  });

  const unimportedGcCourses = gcCourses;

  return (
 <div className="max-w-[1100px] mx-auto px-8 py-8">
      {/* Header */}
 <div className="flex items-center justify-between mb-6">
        <div>
 <h1 className="text-2xl font-semibold">My Classes</h1>
 <p className="text-muted-foreground mt-1">
            Manage your classes and share join codes with students
          </p>
        </div>
 <div className="flex items-center gap-2">
          {gcConnected && unimportedGcCourses.length > 0 && (
            <Button
              variant="outline"
              onClick={() => setShowGcImport(!showGcImport)}
 className="gap-2"
            >
 <DownloadSimple weight="duotone" className="h-4 w-4" />
              Import from Google Classroom
 <span className="bg-green-100 text-green-700 text-xs font-medium px-1.5 py-0.5 rounded-full">
                {unimportedGcCourses.length}
              </span>
            </Button>
          )}
          <CreateClassDialog onClassCreated={loadClasses} />
        </div>
      </div>

      {/* Search & View Toggle */}
 <div className="flex items-center gap-4 mb-6">
 <div className="relative flex-1 max-w-md">
 <MagnifyingGlass weight="duotone" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search classes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
 className="pl-9"
          />
        </div>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
          <TabsList>
            <TabsTrigger value="grid">
 <GridFour weight="duotone" className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="list">
 <ListBullets weight="duotone" className="h-4 w-4" />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Google Classroom Import Panel */}
      {showGcImport && gcConnected && (
 <div className="border rounded-lg bg-green-50/50 p-4 mb-6">
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2">
 <svg viewBox="0 0 24 24" className="h-5 w-5 text-green-600" fill="currentColor">
                <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c1.66 0 3.22-.45 4.56-1.24l.44.44c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41l-.44-.44A8.96 8.96 0 0 0 21 12c0-4.97-4.03-9-9-9zm0 16c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7zm-1-11h2v3h3v2h-3v3h-2v-3H8v-2h3V8z" />
              </svg>
 <h3 className="font-medium text-sm">
                Select Google Classroom courses to import
              </h3>
            </div>
 <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleImportCourses}
                disabled={importing || selectedGcIds.size === 0}
              >
                {importing ? (
                  <>
 <CircleNotch weight="bold" className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
 <DownloadSimple weight="bold" className="h-3.5 w-3.5 mr-1.5" />
                    Import {selectedGcIds.size > 0 ? `(${selectedGcIds.size})` : ''}
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowGcImport(false); setSelectedGcIds(new Set()); }}
              >
                Cancel
              </Button>
            </div>
          </div>
 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {unimportedGcCourses.map((course) => (
              <button
                key={course.id}
                onClick={() => toggleGcCourse(course.id)}
 className={`text-left p-3 rounded-lg border transition-colors ${
                  selectedGcIds.has(course.id)
                    ? 'border-green-500 bg-green-100/50 '
                    : 'border-border bg-background hover:bg-muted/50'
                }`}
              >
 <div className="flex items-center justify-between">
 <div className="min-w-0 flex-1">
 <p className="font-medium text-sm truncate">{course.name}</p>
                    {course.section && (
 <p className="text-xs text-muted-foreground truncate">{course.section}</p>
                    )}
                  </div>
                  <div
 className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 ml-2 ${
                      selectedGcIds.has(course.id)
                        ? 'bg-green-600 border-green-600'
                        : 'border-muted-foreground'
                    }`}
                  >
                    {selectedGcIds.has(course.id) && (
 <Check weight="bold" className="h-3 w-3 text-white" />
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
 <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6' : 'space-y-4'}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
 <div key={i} className="overflow-hidden bg-card rounded-xl border border-t-[3px] border-t-muted">
 <div className="p-6 space-y-3">
 <div className="h-6 bg-muted rounded animate-pulse w-3/4" />
 <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
 <div className="h-4 bg-muted rounded animate-pulse w-2/3" />
 <div className="h-8 bg-muted rounded animate-pulse w-1/3 mt-4" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredClasses.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-16 text-center">
          {searchQuery ? (
            <>
 <MagnifyingGlass weight="duotone" className="h-12 w-12 text-muted-foreground mb-4" />
 <h3 className="text-lg font-medium mb-2">No classes found</h3>
 <p className="text-muted-foreground mb-6">
                Try a different search term
              </p>
              <Button variant="outline" onClick={() => setSearchQuery('')}>
                Clear Search
              </Button>
            </>
          ) : (
            <>
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
 className="rounded-full bg-muted p-6 mb-4"
              >
 <BookOpenText weight="duotone" className="h-12 w-12 text-muted-foreground" />
              </motion.div>
 <h3 className="text-lg font-medium mb-2">No classes yet</h3>
 <p className="text-muted-foreground mb-6 max-w-md">
                Create your first class to get started. Students can join using a unique join code.
              </p>
 <div className="flex items-center gap-3">
                <CreateClassDialog onClassCreated={loadClasses} />
                {gcConnected && unimportedGcCourses.length > 0 && (
 <Button variant="outline" onClick={() => setShowGcImport(true)} className="gap-2">
 <DownloadSimple weight="duotone" className="h-4 w-4" />
                    Import from Google Classroom
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <>
 <div className="flex items-center justify-between mb-6">
 <p className="text-sm text-muted-foreground">
              {filteredClasses.length} {filteredClasses.length === 1 ? 'class' : 'classes'}
            </p>
          </div>

 <div className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6'
              : 'space-y-4'
          }>
            {filteredClasses.map((classData, index) => (
              <motion.div
                key={classData.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <ClassCard
                  classData={classData}
                  memberCount={classData.memberCount}
                  onUpdate={loadClasses}
                />
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
