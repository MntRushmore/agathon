'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClassCard } from '@/components/teacher/ClassCard';
import { CreateClassDialog } from '@/components/teacher/CreateClassDialog';
import { getTeacherClasses, getClassMemberCount } from '@/lib/api/classes';
import { Class } from '@/types/database';
import { Grid3x3, List, Search, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

type ViewMode = 'grid' | 'list';

interface ClassWithCount extends Class {
  memberCount?: number;
}

export default function TeacherClassesPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  const loadClasses = async () => {
    setLoading(true);
    try {
      const fetchedClasses = await getTeacherClasses();

      // Fetch member counts for each class
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

  useEffect(() => {
    loadClasses();
  }, []);

  const filteredClasses = classes.filter((classData) => {
    const query = searchQuery.toLowerCase();
    return (
      classData.name.toLowerCase().includes(query) ||
      classData.subject?.toLowerCase().includes(query) ||
      classData.grade_level?.toLowerCase().includes(query) ||
      classData.join_code.toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-background page-transition">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-semibold">My Classes</h1>
                <p className="text-muted-foreground mt-1">
                  Manage your classes and share join codes with students
                </p>
              </div>
            </div>
            <CreateClassDialog onClassCreated={loadClasses} />
          </div>

          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search classes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* View Mode Toggle */}
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <TabsList>
                <TabsTrigger value="grid">
                  <Grid3x3 className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="list">
                  <List className="h-4 w-4" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8' : 'space-y-4'}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="overflow-hidden bg-card rounded-xl border">
                <div className="p-6 space-y-3">
                  <div className="h-6 bg-muted rounded skeleton w-3/4" />
                  <div className="h-4 bg-muted rounded skeleton w-1/2" />
                  <div className="h-4 bg-muted rounded skeleton w-2/3" />
                  <div className="h-8 bg-muted rounded skeleton w-1/3 mt-4" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredClasses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            {searchQuery ? (
              <>
                <Search className="h-12 w-12 text-muted-foreground mb-4" />
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
                <div className="rounded-full bg-muted p-6 mb-4">
                  <Grid3x3 className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">No classes yet</h3>
                <p className="text-muted-foreground mb-6 max-w-md">
                  Create your first class to get started. Students can join using a unique join code.
                </p>
                <CreateClassDialog onClassCreated={loadClasses} />
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
                ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8'
                : 'space-y-4'
            }>
              {filteredClasses.map((classData) => (
                <ClassCard
                  key={classData.id}
                  classData={classData}
                  memberCount={classData.memberCount}
                  onUpdate={loadClasses}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
