'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { useToast } from '@/hooks/use-toast';
import { updateClass } from '@/lib/api/classes';
import type { Class } from '@/types/database';
import { Loader2, Edit3 } from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface EditClassDialogProps {
  classData: Class;
  onClassUpdated?: (updated: Class) => void;
  trigger?: React.ReactNode;
  triggerClassName?: string;
}

export function EditClassDialog({
  classData,
  onClassUpdated,
  trigger,
  triggerClassName,
}: EditClassDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: classData.name || '',
    description: classData.description || '',
    subject: classData.subject || '',
    grade_level: classData.grade_level || '',
  });
  const { toast } = useToast();

  useEffect(() => {
    setFormData({
      name: classData.name || '',
      description: classData.description || '',
      subject: classData.subject || '',
      grade_level: classData.grade_level || '',
    });
  }, [classData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        title: 'Name required',
        description: 'Add a clear name so students recognize this class.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const updated = await updateClass(classData.id, {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        subject: formData.subject || null,
        grade_level: formData.grade_level.trim() || null,
      });

      onClassUpdated?.(updated);
      setOpen(false);
      toast({
        title: 'Class updated',
        description: 'Details saved and shared with your roster.',
      });
    } catch (error) {
      console.error('Error updating class:', error);
      toast({
        title: 'Update failed',
        description: 'Could not save changes. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className={cn('gap-2', triggerClassName)}>
            <Edit3 className="h-4 w-4" />
            Edit Class
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Class Details</DialogTitle>
            <DialogDescription>
              Keep the title, subject, and description aligned with how you introduce this class.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-6">
            <div className="grid gap-2">
              <Label htmlFor="name">Class Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                maxLength={100}
                placeholder="e.g., Algebra II Honors"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="subject">Subject</Label>
              <Select
                value={formData.subject}
                onValueChange={(value) => setFormData({ ...formData, subject: value })}
              >
                <SelectTrigger id="subject">
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
              <Label htmlFor="grade_level">Grade Level</Label>
              <Input
                id="grade_level"
                value={formData.grade_level || ''}
                onChange={(e) => setFormData({ ...formData, grade_level: e.target.value })}
                placeholder="e.g., Grade 9, AP, IB"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Share how you run this class or what students can expect."
              />
            </div>
          </div>

          <DialogFooter className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
