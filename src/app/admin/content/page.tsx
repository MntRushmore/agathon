'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  Search, MoreVertical, Eye, Trash2, BookOpen, FileText, Layout, Pen, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistance } from 'date-fns';

type ContentTab = 'classes' | 'assignments' | 'boards' | 'documents';

const TABS: { key: ContentTab; label: string; icon: typeof BookOpen }[] = [
  { key: 'classes', label: 'Classes', icon: BookOpen },
  { key: 'assignments', label: 'Assignments', icon: FileText },
  { key: 'boards', label: 'Boards', icon: Layout },
  { key: 'documents', label: 'Documents', icon: Pen },
];

export default function AdminContentPage() {
  const supabase = createClient();
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<ContentTab>('classes');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [boards, setBoards] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);

  const loadAllContent = useCallback(async () => {
    if (profile?.role !== 'admin') return;
    setLoading(true);
    try {
      const [classesRes, assignmentsRes, boardsRes, documentsRes] = await Promise.allSettled([
        supabase.from('classes').select('*, teacher:profiles!teacher_id(full_name, email)').order('created_at', { ascending: false }),
        supabase.from('assignments').select('*, class:classes!class_id(name)').order('created_at', { ascending: false }),
        supabase.from('whiteboards').select('*, owner:profiles!user_id(full_name, email)').order('created_at', { ascending: false }).limit(200),
        supabase.from('documents').select('*, owner:profiles!user_id(full_name, email)').order('created_at', { ascending: false }).limit(200),
      ]);

      if (classesRes.status === 'fulfilled' && !classesRes.value.error) setClasses(classesRes.value.data || []);
      if (assignmentsRes.status === 'fulfilled' && !assignmentsRes.value.error) setAssignments(assignmentsRes.value.data || []);
      if (boardsRes.status === 'fulfilled' && !boardsRes.value.error) setBoards(boardsRes.value.data || []);
      if (documentsRes.status === 'fulfilled' && !documentsRes.value.error) setDocuments(documentsRes.value.data || []);
    } catch {
      toast.error('Failed to load content');
    } finally {
      setLoading(false);
    }
  }, [profile, supabase]);

  useEffect(() => { loadAllContent(); }, [loadAllContent]);

  const handleDelete = async (type: string, id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      const table = type === 'class' ? 'classes' : type === 'assignment' ? 'assignments' : type === 'document' ? 'documents' : 'whiteboards';
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      await supabase.from('admin_audit_logs').insert({
        admin_id: user?.id, action_type: `${type}_delete` as any, target_type: type as any, target_id: id,
        target_details: { name },
      });
      toast.success(`Deleted ${type}`);
      loadAllContent();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const getCounts = () => ({
    classes: classes.length,
    assignments: assignments.length,
    boards: boards.length,
    documents: documents.length,
  });

  const counts = getCounts();

  const filteredClasses = classes.filter((c) => c.name?.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredAssignments = assignments.filter((a) => a.title?.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredBoards = boards.filter((b) => b.title?.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredDocuments = documents.filter((d) => d.title?.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Content</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Review and manage platform content</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAllContent} className="rounded-none h-8 text-xs">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Tab Bar */}
      <div className="border-b border-border flex gap-0">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSearchQuery(''); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            <span className="text-xs text-muted-foreground ml-1">{counts[tab.key]}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={`Search ${activeTab}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 rounded-none h-9"
        />
      </div>

      {/* Content Tables */}
      <div className="bg-card border border-border overflow-hidden">
        {activeTab === 'classes' && (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs uppercase tracking-wider font-semibold">Name</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-semibold">Teacher</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-semibold">Join Code</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-semibold">Status</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-semibold">Created</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12"><div className="h-5 w-5 border-2 border-foreground/20 border-t-foreground animate-spin mx-auto" /></TableCell></TableRow>
              ) : filteredClasses.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm">No classes found</TableCell></TableRow>
              ) : filteredClasses.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-sm">{item.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.teacher?.full_name || item.teacher?.email || '—'}</TableCell>
                  <TableCell><span className="font-mono text-xs px-1.5 py-0.5 bg-muted">{item.join_code}</span></TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium ${item.is_active ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                      {item.is_active ? 'Active' : 'Archived'}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDistance(new Date(item.created_at), new Date(), { addSuffix: true })}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 rounded-none"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-none">
                        <DropdownMenuItem onClick={() => handleDelete('class', item.id, item.name)} className="text-destructive focus:text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {activeTab === 'assignments' && (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs uppercase tracking-wider font-semibold">Title</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-semibold">Class</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-semibold">Published</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-semibold">Due Date</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-semibold">Created</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12"><div className="h-5 w-5 border-2 border-foreground/20 border-t-foreground animate-spin mx-auto" /></TableCell></TableRow>
              ) : filteredAssignments.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm">No assignments found</TableCell></TableRow>
              ) : filteredAssignments.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-sm">{item.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.class?.name || '—'}</TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium ${item.is_published ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                      {item.is_published ? 'Published' : 'Draft'}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.due_date ? new Date(item.due_date).toLocaleDateString() : '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDistance(new Date(item.created_at), new Date(), { addSuffix: true })}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 rounded-none"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-none">
                        <DropdownMenuItem onClick={() => handleDelete('assignment', item.id, item.title)} className="text-destructive focus:text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {activeTab === 'boards' && (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs uppercase tracking-wider font-semibold">Title</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-semibold">Owner</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-semibold">Created</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-semibold">Updated</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12"><div className="h-5 w-5 border-2 border-foreground/20 border-t-foreground animate-spin mx-auto" /></TableCell></TableRow>
              ) : filteredBoards.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground text-sm">No boards found</TableCell></TableRow>
              ) : filteredBoards.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-sm">{item.title || 'Untitled'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.owner?.full_name || item.owner?.email || 'Unknown'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDistance(new Date(item.created_at), new Date(), { addSuffix: true })}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDistance(new Date(item.updated_at), new Date(), { addSuffix: true })}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 rounded-none"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-none">
                        <DropdownMenuItem onClick={() => window.open(`/board/${item.id}`, '_blank')}>
                          <Eye className="mr-2 h-4 w-4" /> View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete('board', item.id, item.title || 'Untitled')} className="text-destructive focus:text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {activeTab === 'documents' && (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs uppercase tracking-wider font-semibold">Title</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-semibold">Owner</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-semibold">Created</TableHead>
                <TableHead className="text-xs uppercase tracking-wider font-semibold">Updated</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12"><div className="h-5 w-5 border-2 border-foreground/20 border-t-foreground animate-spin mx-auto" /></TableCell></TableRow>
              ) : filteredDocuments.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground text-sm">No documents found</TableCell></TableRow>
              ) : filteredDocuments.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-sm">{item.title || 'Untitled'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.owner?.full_name || item.owner?.email || 'Unknown'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDistance(new Date(item.created_at), new Date(), { addSuffix: true })}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDistance(new Date(item.updated_at), new Date(), { addSuffix: true })}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 rounded-none"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-none">
                        <DropdownMenuItem onClick={() => window.open(`/journal/${item.id}`, '_blank')}>
                          <Eye className="mr-2 h-4 w-4" /> View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete('document', item.id, item.title || 'Untitled')} className="text-destructive focus:text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {activeTab === 'classes' ? filteredClasses.length : activeTab === 'assignments' ? filteredAssignments.length : activeTab === 'boards' ? filteredBoards.length : filteredDocuments.length} items
      </p>
    </div>
  );
}
