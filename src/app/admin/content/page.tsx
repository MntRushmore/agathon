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
import { Search, MoreVertical, Eye, Trash2, BookOpen, FileText, Layout } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistance } from 'date-fns';

export default function AdminContentPage() {
  const supabase = createClient();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('classes');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [boards, setBoards] = useState<any[]>([]);

  useEffect(() => {
    loadContent();
  }, [activeTab]);

  const loadContent = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'classes':
          const { data: classData } = await supabase
            .from('classes')
            .select(`*, teacher:profiles!teacher_id(full_name, email)`)
            .order('created_at', { ascending: false });
          setClasses(classData || []);
          break;

        case 'assignments':
          const { data: assignmentData } = await supabase
            .from('assignments')
            .select(`*, class:classes!class_id(name)`)
            .order('created_at', { ascending: false });
          setAssignments(assignmentData || []);
          break;

        case 'boards':
          const { data: boardData } = await supabase
            .from('whiteboards')
            .select(`*, owner:profiles!user_id(full_name, email)`)
            .order('created_at', { ascending: false })
            .limit(100);
          setBoards(boardData || []);
          break;
      }
    } catch (error) {
      console.error('Error loading content:', error);
      toast.error('Failed to load content');
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
        type === 'class' ? 'classes' : type === 'assignment' ? 'assignments' : 'whiteboards';
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Content Moderation</h1>
        <p className="text-muted-foreground">View and manage all platform content</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="classes" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Classes ({classes.length})
          </TabsTrigger>
          <TabsTrigger value="assignments" className="gap-2">
            <FileText className="h-4 w-4" />
            Assignments ({assignments.length})
          </TabsTrigger>
          <TabsTrigger value="boards" className="gap-2">
            <Layout className="h-4 w-4" />
            Boards ({boards.length})
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <div className="relative max-w-sm mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <TabsContent value="classes">
            <div className="border rounded-lg">
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
            <div className="border rounded-lg">
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
            <div className="border rounded-lg">
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
        </div>
      </Tabs>
    </div>
  );
}
