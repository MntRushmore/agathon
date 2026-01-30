'use client';

import { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Class } from '@/types/database';
import { Users, Copy, MoreVertical, Eye, Edit, Archive, Trash, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { archiveClass, deleteClass, updateClass } from '@/lib/api/classes';

const SUBJECTS = [
  'Math',
  'Science',
  'English Language Arts',
  'Social Studies',
  'History',
  'Art',
  'Music',
  'Physical Education',
  'Computer Science',
  'Other',
];

interface ClassCardProps {
  classData: Class;
  memberCount?: number;
  onUpdate?: () => void;
}

export function ClassCard({ classData, memberCount = 0, onUpdate }: ClassCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: classData.name || '',
    description: classData.description || '',
    subject: classData.subject || '',
    grade_level: classData.grade_level || '',
  });

  const handleCopyJoinCode = async () => {
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

  const handleArchive = async () => {
    if (!confirm(`Archive "${classData.name}"? Students won't be able to join, but existing data will be preserved.`)) {
      return;
    }

    setLoading(true);
    try {
      await archiveClass(classData.id);
      toast({
        title: 'Class archived',
        description: `${classData.name} has been archived`,
      });
      onUpdate?.();
    } catch (error) {
      console.error('Error archiving class:', error);
      toast({
        title: 'Error',
        description: 'Failed to archive class',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Permanently delete "${classData.name}"? This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
    try {
      await deleteClass(classData.id);
      toast({
        title: 'Class deleted',
        description: `${classData.name} has been permanently deleted`,
      });
      onUpdate?.();
    } catch (error) {
      console.error('Error deleting class:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete class',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a class name',
        variant: 'destructive',
      });
      return;
    }

    setEditLoading(true);
    try {
      await updateClass(classData.id, {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        subject: formData.subject || null,
        grade_level: formData.grade_level.trim() || null,
      });
      toast({
        title: 'Class updated',
        description: 'Class details have been saved',
      });
      setEditOpen(false);
      onUpdate?.();
    } catch (error) {
      console.error('Error updating class:', error);
      toast({
        title: 'Error',
        description: 'Failed to update class',
        variant: 'destructive',
      });
    } finally {
      setEditLoading(false);
    }
  };

  const openEditDialog = () => {
    setFormData({
      name: classData.name || '',
      description: classData.description || '',
      subject: classData.subject || '',
      grade_level: classData.grade_level || '',
    });
    setEditOpen(true);
  };

  return (
    <>
      <Card className="board-card group cursor-pointer" onClick={() => router.push(`/teacher/classes/${classData.id}`)}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-medium truncate">{classData.name}</h3>
              {classData.grade_level && (
                <p className="text-sm text-muted-foreground mt-1">{classData.grade_level}</p>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={loading}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/teacher/classes/${classData.id}`); }}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditDialog(); }}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleArchive(); }}>
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="pb-3">
          {classData.subject && (
            <Badge variant="secondary" className="mb-3">
              {classData.subject}
            </Badge>
          )}

          {classData.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {classData.description}
            </p>
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{memberCount} {memberCount === 1 ? 'student' : 'students'}</span>
          </div>
        </CardContent>

        <CardFooter className="pt-3 border-t flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Join code:</span>
            <code className="text-sm font-mono font-bold px-2 py-1 bg-muted rounded">
              {classData.join_code}
            </code>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleCopyJoinCode();
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[500px]" onClick={(e) => e.stopPropagation()}>
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Class</DialogTitle>
              <DialogDescription>
                Update your class details.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-6 py-6">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Class Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  maxLength={100}
                  placeholder="e.g., Math 101"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-subject">Subject</Label>
                <Select
                  value={formData.subject}
                  onValueChange={(value) => setFormData({ ...formData, subject: value })}
                >
                  <SelectTrigger id="edit-subject">
                    <SelectValue placeholder="Select a subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECTS.map((subject) => (
                      <SelectItem key={subject} value={subject}>
                        {subject}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-grade">Grade Level</Label>
                <Input
                  id="edit-grade"
                  value={formData.grade_level}
                  onChange={(e) => setFormData({ ...formData, grade_level: e.target.value })}
                  placeholder="e.g., Grade 8, Algebra I"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Brief description of the class (optional)"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={editLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={editLoading}>
                {editLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
