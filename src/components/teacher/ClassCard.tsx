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
import { Class } from '@/types/database';
import { Users, Copy, MoreVertical, Eye, Edit, Archive, Trash } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { archiveClass, deleteClass } from '@/lib/api/classes';

interface ClassCardProps {
  classData: Class;
  memberCount?: number;
  onUpdate?: () => void;
}

export function ClassCard({ classData, memberCount = 0, onUpdate }: ClassCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

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

  return (
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
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); /* TODO: Edit dialog */ }}>
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
  );
}
