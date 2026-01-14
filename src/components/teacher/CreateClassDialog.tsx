'use client';

import { useState } from 'react';
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
import { createClass } from '@/lib/api/classes';
import { createClient } from '@/lib/supabase';
import { Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

interface CreateClassDialogProps {
  onClassCreated?: () => void;
}

export function CreateClassDialog({ onClassCreated }: CreateClassDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    subject: '',
    grade_level: '',
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a class name',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Get current user from Supabase auth
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast({
          title: 'Not authenticated',
          description: 'Please sign in to create a class',
          variant: 'destructive',
        });
        return;
      }

      const newClass = await createClass({
        teacher_id: user.id,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        subject: formData.subject || null,
        grade_level: formData.grade_level.trim() || null,
        is_active: true,
      });

      toast({
        title: 'Class created!',
        description: `Join code: ${newClass.join_code}`,
      });

      // Reset form
      setFormData({
        name: '',
        description: '',
        subject: '',
        grade_level: '',
      });

      setOpen(false);
      onClassCreated?.();
    } catch (error) {
      console.error('Error creating class:', error);
      toast({
        title: 'Error',
        description: 'Failed to create class. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Class
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Class</DialogTitle>
            <DialogDescription>
              Create a new class and get a join code to share with your students.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-6">
            <div className="grid gap-2">
              <Label htmlFor="name">Class Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Math 101"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                maxLength={100}
                required
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
                placeholder="e.g., Grade 8, Algebra I"
                value={formData.grade_level}
                onChange={(e) => setFormData({ ...formData, grade_level: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of the class (optional)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Class'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
