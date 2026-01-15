'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { createClient } from '@/lib/supabase/client';
import {
  ArrowLeft,
  Plus,
  Search,
  BookOpen,
  Copy,
  Trash2,
  Edit2,
  Sparkles,
  Clock,
  Eye,
  FileText,
  Loader2,
  FolderOpen,
} from 'lucide-react';
import { formatDistance } from 'date-fns';
import { toast } from 'sonner';

interface AssignmentTemplate {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  ai_settings: {
    allowAI: boolean;
    allowedModes: string[];
    hintLimit: number | null;
  };
  subject_tags: string[];
  grade_level: string | null;
  created_at: string;
  updated_at: string;
  use_count: number;
}

export default function TemplatesPage() {
  const router = useRouter();
  const supabase = createClient();
  const [templates, setTemplates] = useState<AssignmentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<AssignmentTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formInstructions, setFormInstructions] = useState('');
  const [formAllowAI, setFormAllowAI] = useState(true);
  const [formAllowedModes, setFormAllowedModes] = useState<string[]>(['feedback', 'suggest', 'answer']);
  const [formHintLimit, setFormHintLimit] = useState<number | null>(null);
  const [formTags, setFormTags] = useState('');
  const [formGradeLevel, setFormGradeLevel] = useState('');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('assignment_templates')
        .select('*')
        .eq('teacher_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormInstructions('');
    setFormAllowAI(true);
    setFormAllowedModes(['feedback', 'suggest', 'answer']);
    setFormHintLimit(null);
    setFormTags('');
    setFormGradeLevel('');
    setEditingTemplate(null);
  };

  const openEditDialog = (template: AssignmentTemplate) => {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormDescription(template.description || '');
    setFormInstructions(template.instructions || '');
    setFormAllowAI(template.ai_settings?.allowAI !== false);
    setFormAllowedModes(template.ai_settings?.allowedModes || ['feedback', 'suggest', 'answer']);
    setFormHintLimit(template.ai_settings?.hintLimit || null);
    setFormTags(template.subject_tags?.join(', ') || '');
    setFormGradeLevel(template.grade_level || '');
    setIsCreateOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('Template name is required');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const templateData = {
        teacher_id: user.id,
        name: formName.trim(),
        description: formDescription.trim() || null,
        instructions: formInstructions.trim() || null,
        ai_settings: {
          allowAI: formAllowAI,
          allowedModes: formAllowedModes,
          hintLimit: formHintLimit,
        },
        subject_tags: formTags.split(',').map(t => t.trim()).filter(Boolean),
        grade_level: formGradeLevel.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editingTemplate) {
        const { error } = await supabase
          .from('assignment_templates')
          .update(templateData)
          .eq('id', editingTemplate.id);

        if (error) throw error;
        toast.success('Template updated');
      } else {
        const { error } = await supabase
          .from('assignment_templates')
          .insert({
            ...templateData,
            use_count: 0,
          });

        if (error) throw error;
        toast.success('Template created');
      }

      setIsCreateOpen(false);
      resetForm();
      loadTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('assignment_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
      toast.success('Template deleted');
      loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  const handleUseTemplate = (template: AssignmentTemplate) => {
    const params = new URLSearchParams({
      templateId: template.id,
      name: template.name,
      instructions: template.instructions || '',
      allowAI: String(template.ai_settings?.allowAI !== false),
      allowedModes: (template.ai_settings?.allowedModes || []).join(','),
      hintLimit: String(template.ai_settings?.hintLimit || ''),
    });
    router.push(`/teacher/assignments/create?${params.toString()}`);
  };

  const handleDuplicate = async (template: AssignmentTemplate) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('assignment_templates')
        .insert({
          teacher_id: user.id,
          name: `${template.name} (Copy)`,
          description: template.description,
          instructions: template.instructions,
          ai_settings: template.ai_settings,
          subject_tags: template.subject_tags,
          grade_level: template.grade_level,
          use_count: 0,
        });

      if (error) throw error;
      toast.success('Template duplicated');
      loadTemplates();
    } catch (error) {
      console.error('Error duplicating template:', error);
      toast.error('Failed to duplicate template');
    }
  };

  const toggleMode = (mode: string) => {
    setFormAllowedModes(prev =>
      prev.includes(mode)
        ? prev.filter(m => m !== mode)
        : [...prev, mode]
    );
  };

  const filteredTemplates = templates.filter(t => {
    const query = searchQuery.toLowerCase();
    return (
      t.name.toLowerCase().includes(query) ||
      t.description?.toLowerCase().includes(query) ||
      t.subject_tags?.some(tag => tag.toLowerCase().includes(query)) ||
      t.grade_level?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-10 bg-muted rounded w-1/3" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-48 bg-muted rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.push('/teacher')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-semibold">Assignment Templates</h1>
                <p className="text-muted-foreground">
                  Save and reuse assignment configurations
                </p>
              </div>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={(open) => {
              setIsCreateOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingTemplate ? 'Edit Template' : 'Create Template'}
                  </DialogTitle>
                  <DialogDescription>
                    Save assignment settings to reuse later.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Template Name *</Label>
                    <Input
                      id="name"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g., Math Problem Set"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Brief description of this template..."
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="instructions">Default Instructions</Label>
                    <Textarea
                      id="instructions"
                      value={formInstructions}
                      onChange={(e) => setFormInstructions(e.target.value)}
                      placeholder="Instructions to include with assignments..."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="tags">Subject Tags</Label>
                      <Input
                        id="tags"
                        value={formTags}
                        onChange={(e) => setFormTags(e.target.value)}
                        placeholder="Math, Algebra"
                      />
                      <p className="text-xs text-muted-foreground">Comma separated</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="grade">Grade Level</Label>
                      <Input
                        id="grade"
                        value={formGradeLevel}
                        onChange={(e) => setFormGradeLevel(e.target.value)}
                        placeholder="e.g., 9th Grade"
                      />
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3">AI Settings</h4>
                    <div className="space-y-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formAllowAI}
                          onChange={(e) => setFormAllowAI(e.target.checked)}
                          className="h-4 w-4 rounded"
                        />
                        <span className="text-sm">Allow AI assistance</span>
                      </label>

                      {formAllowAI && (
                        <div className="ml-6 space-y-3">
                          <div className="space-y-2">
                            <Label className="text-xs">Allowed Modes</Label>
                            <div className="flex gap-2">
                              <Badge
                                variant={formAllowedModes.includes('feedback') ? 'default' : 'outline'}
                                className="cursor-pointer"
                                onClick={() => toggleMode('feedback')}
                              >
                                Feedback
                              </Badge>
                              <Badge
                                variant={formAllowedModes.includes('suggest') ? 'default' : 'outline'}
                                className="cursor-pointer"
                                onClick={() => toggleMode('suggest')}
                              >
                                Suggest
                              </Badge>
                              <Badge
                                variant={formAllowedModes.includes('answer') ? 'default' : 'outline'}
                                className="cursor-pointer"
                                onClick={() => toggleMode('answer')}
                              >
                                Solve
                              </Badge>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs">Hint Limit</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={0}
                                max={50}
                                value={formHintLimit || ''}
                                onChange={(e) => setFormHintLimit(e.target.value ? parseInt(e.target.value) : null)}
                                className="w-20"
                                placeholder="None"
                              />
                              <span className="text-xs text-muted-foreground">
                                {formHintLimit ? 'hints max' : 'Unlimited'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      editingTemplate ? 'Update Template' : 'Create Template'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="mt-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-6 mb-4">
              <FolderOpen className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">
              {searchQuery ? 'No templates found' : 'No templates yet'}
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              {searchQuery
                ? 'Try a different search term'
                : 'Create templates to save assignment configurations for quick reuse.'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Template
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => (
              <Card key={template.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{template.name}</CardTitle>
                      {template.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {template.description}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-1.5">
                    {template.subject_tags?.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {template.grade_level && (
                      <Badge variant="outline" className="text-xs">
                        {template.grade_level}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      {template.ai_settings?.allowAI !== false ? 'AI enabled' : 'AI disabled'}
                    </span>
                    {template.ai_settings?.hintLimit && (
                      <span>{template.ai_settings.hintLimit} hint limit</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Used {template.use_count || 0} times</span>
                    <span>{formatDistance(new Date(template.updated_at), new Date(), { addSuffix: true })}</span>
                  </div>

                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleUseTemplate(template)}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      Use
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(template)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDuplicate(template)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Template?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete "{template.name}". This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(template.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
