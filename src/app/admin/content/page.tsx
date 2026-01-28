'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/auth-provider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Search, MoreVertical, Eye, Trash2, BookOpen, FileText, Layout, Pen } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistance } from 'date-fns';

export default function AdminContentPage() {
  const supabase = createClient();
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState('classes');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [boards, setBoards] = useState<any[]>([]);
  const [journals, setJournals] = useState<any[]>([]);

  useEffect(() => {
    // Only load if user is admin
    if (profile?.role === 'admin') {
      loadAllContent();
    }
  }, [profile]);

  useEffect(() => {
    // Reload when tab changes
    if (profile?.role === 'admin') {
      loadContent();
    }
  }, [activeTab]);

  const loadAllContent = async () => {
    // Load all tabs at once for initial load
    setLoading(true);
    try {
      const [classesResult, assignmentsResult, boardsResult, journalsResult] = await Promise.allSettled([
        supabase
          .from('classes')
          .select(`*, teacher:profiles!teacher_id(full_name, email)`)
          .order('created_at', { ascending: false }),
        supabase
          .from('assignments')
          .select(`*, class:classes!class_id(name)`)
          .order('created_at', { ascending: false }),
        supabase
          .from('whiteboards')
          .select(`*, owner:profiles!user_id(full_name, email)`)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('journals')
          .select(`*`)
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      if (classesResult.status === 'fulfilled') {
        if (classesResult.value.error) {
          console.error('Classes query error:', classesResult.value.error);
          toast.error(`Classes: ${classesResult.value.error.message}`);
        }
        setClasses(classesResult.value.data || []);
      } else {
        console.error('Classes query rejected:', classesResult.reason);
      }

      if (assignmentsResult.status === 'fulfilled') {
        if (assignmentsResult.value.error) {
          console.error('Assignments query error:', assignmentsResult.value.error);
          toast.error(`Assignments: ${assignmentsResult.value.error.message}`);
        }
        setAssignments(assignmentsResult.value.data || []);
      } else {
        console.error('Assignments query rejected:', assignmentsResult.reason);
      }

      if (boardsResult.status === 'fulfilled') {
        if (boardsResult.value.error) {
          console.error('Boards query error:', boardsResult.value.error);
          toast.error(`Boards: ${boardsResult.value.error.message}`);
        }
        setBoards(boardsResult.value.data || []);
      } else {
        console.error('Boards query rejected:', boardsResult.reason);
      }

      if (journalsResult.status === 'fulfilled') {
        if (journalsResult.value.error) {
          console.error('Journals query error:', journalsResult.value.error);
          toast.error(`Journals: ${journalsResult.value.error.message}`);
        }
        setJournals(journalsResult.value.data || []);
      } else {
        console.error('Journals query rejected:', journalsResult.reason);
      }
    } catch (error) {
      console.error('Error loading all content:', error);
      toast.error('Some data failed to load. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const loadContent = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'classes':
          const { data: classData, error: classError } = await supabase
            .from('classes')
            .select(`*, teacher:profiles!teacher_id(full_name, email)`)
            .order('created_at', { ascending: false });

          if (classError) {
            console.error('Classes error:', classError);
            toast.error(`Failed to load classes: ${classError.message}`);
          }
          setClasses(classData || []);
          break;

        case 'assignments':
          const { data: assignmentData, error: assignmentError } = await supabase
            .from('assignments')
            .select(`*, class:classes!class_id(name)`)
            .order('created_at', { ascending: false });

          if (assignmentError) {
            console.error('Assignments error:', assignmentError);
            toast.error(`Failed to load assignments: ${assignmentError.message}`);
          }
          setAssignments(assignmentData || []);
          break;

        case 'boards':
          const { data: boardData, error: boardError } = await supabase
            .from('whiteboards')
            .select(`*, owner:profiles!user_id(full_name, email)`)
            .order('created_at', { ascending: false })
            .limit(100);

          if (boardError) {
            console.error('Boards error:', boardError);
            toast.error(`Failed to load boards: ${boardError.message}`);
          }
          setBoards(boardData || []);
          break;

        case 'journals':
          const { data: journalData, error: journalError } = await supabase
            .from('journals')
            .select(`*`)
            .order('created_at', { ascending: false })
            .limit(100);

          if (journalError) {
            console.error('Journals error:', journalError);
            toast.error(`Failed to load journals: ${journalError.message}`);
          }
          setJournals(journalData || []);
          break;
      }
    } catch (error) {
      console.error('Error loading content:', error);
      toast.error(`Failed to load content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (type: string, id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const table =
        type === 'class' ? 'classes' : type === 'assignment' ? 'assignments' : type === 'journal' ? 'journals' : 'whiteboards';
      const { error } = await supabase.from(table).delete().eq('id', id);

      if (error) throw error;

      // Log the action
      await supabase.from('admin_audit_logs').insert({
        admin_id: user?.id,
        action_type: `${type}_delete`,
        target_type: type,
        target_id: id,
        target_details: { name },
      });

      toast.success(`${type} deleted successfully`);
      loadContent();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Failed to delete');
    }
  };

  const filteredClasses = classes.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAssignments = assignments.filter((a) =>
    a.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredBoards = boards.filter((b) =>
    b.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredJournals = journals.filter((j) =>
    j.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Content</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage platform content</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted p-1 rounded-lg h-auto gap-1">
          <TabsTrigger
            value="classes"
            className="rounded-md px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2 text-sm"
          >
            <BookOpen className="h-4 w-4" />
            Classes ({classes.length})
          </TabsTrigger>
          <TabsTrigger
            value="assignments"
            className="rounded-md px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2 text-sm"
          >
            <FileText className="h-4 w-4" />
            Assignments ({assignments.length})
          </TabsTrigger>
          <TabsTrigger
            value="boards"
            className="rounded-md px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2 text-sm"
          >
            <Layout className="h-4 w-4" />
            Boards ({boards.length})
          </TabsTrigger>
          <TabsTrigger
            value="journals"
            className="rounded-md px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2 text-sm"
          >
            <Pen className="h-4 w-4" />
            Journals ({journals.length})
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <div className="relative max-w-sm mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <TabsContent value="classes">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Join Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : filteredClasses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No classes found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredClasses.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.teacher?.full_name || item.teacher?.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.join_code}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.is_active ? 'default' : 'secondary'}>
                            {item.is_active ? 'Active' : 'Archived'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDistance(new Date(item.created_at), new Date(), {
                            addSuffix: true,
                          })}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleDelete('class', item.id, item.name)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="assignments">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Published</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : filteredAssignments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No assignments found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAssignments.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.title}</TableCell>
                        <TableCell>{item.class?.name || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={item.is_published ? 'default' : 'secondary'}>
                            {item.is_published ? 'Published' : 'Draft'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.due_date ? new Date(item.due_date).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDistance(new Date(item.created_at), new Date(), {
                            addSuffix: true,
                          })}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleDelete('assignment', item.id, item.title)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="boards">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : filteredBoards.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No boards found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBoards.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.title || 'Untitled'}</TableCell>
                        <TableCell>
                          {item.owner?.full_name || item.owner?.email || 'Unknown'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDistance(new Date(item.created_at), new Date(), {
                            addSuffix: true,
                          })}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDistance(new Date(item.updated_at), new Date(), {
                            addSuffix: true,
                          })}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => window.open(`/board/${item.id}`, '_blank')}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete('board', item.id, item.title || 'Untitled')}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="journals">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>User ID</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : filteredJournals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No journals found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredJournals.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.title || 'Untitled'}</TableCell>
                        <TableCell className="text-muted-foreground text-xs font-mono">
                          {item.user_id?.slice(0, 8)}...
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDistance(new Date(item.created_at), new Date(), {
                            addSuffix: true,
                          })}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDistance(new Date(item.updated_at), new Date(), {
                            addSuffix: true,
                          })}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => window.open(`/journal/${item.id}`, '_blank')}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete('journal', item.id, item.title || 'Untitled')}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
