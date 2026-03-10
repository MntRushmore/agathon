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
import { EditClassDialog } from '@/components/teacher/EditClassDialog';
import { Class } from '@/types/database';
import {
  UsersThree,
  Copy,
  DotsThreeVertical,
  Eye,
  PencilSimple,
  Archive,
  Trash,
  Check,
} from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { archiveClass, deleteClass } from '@/lib/api/classes';
import { motion } from 'motion/react';

const subjectAccents: Record<string, { border: string; badge: string }> = {
  'Math': { border: 'border-t-blue-500', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  'Science': { border: 'border-t-green-500', badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  'English Language Arts': { border: 'border-t-purple-500', badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  'Social Studies': { border: 'border-t-orange-500', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  'History': { border: 'border-t-amber-500', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  'Art': { border: 'border-t-pink-500', badge: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300' },
  'Music': { border: 'border-t-violet-500', badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
  'Physical Education': { border: 'border-t-red-500', badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  'Computer Science': { border: 'border-t-cyan-500', badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300' },
  'Other': { border: 'border-t-gray-400', badge: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
};

const defaultAccent = { border: 'border-t-primary', badge: '' };

interface ClassCardProps {
  classData: Class;
  memberCount?: number;
  onUpdate?: () => void;
}

export function ClassCard({ classData, memberCount = 0, onUpdate }: ClassCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const accent = subjectAccents[classData.subject || ''] || defaultAccent;

  const handleCopyJoinCode = async () => {
    try {
      await navigator.clipboard.writeText(classData.join_code);
      setCopied(true);
      toast({
        title: 'Copied!',
        description: `Join code ${classData.join_code} copied to clipboard`,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
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
    <motion.div whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
      <Card
        className={`group cursor-pointer border-t-[3px] ${accent.border} hover:shadow-md transition-shadow`}
        onClick={() => router.push(`/teacher/classes/${classData.id}`)}
      >
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
                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" disabled={loading}>
                  <DotsThreeVertical weight="bold" className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/teacher/classes/${classData.id}`); }}>
                  <Eye weight="duotone" className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                <EditClassDialog
                  classData={classData}
                  onClassUpdated={() => onUpdate?.()}
                  trigger={
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={(e) => e.stopPropagation()}>
                      <PencilSimple weight="duotone" className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                  }
                />
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleArchive(); }}>
                  <Archive weight="duotone" className="mr-2 h-4 w-4" />
                  Archive
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash weight="duotone" className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="pb-3">
          <div className="flex items-center gap-2 mb-3">
            {classData.subject && (
              <Badge variant="secondary" className={accent.badge}>
                {classData.subject}
              </Badge>
            )}
            {classData.gc_course_id && (
              <Badge variant="outline" className="text-green-600 border-green-300 dark:text-green-400 dark:border-green-700 text-xs">
                Google Classroom
              </Badge>
            )}
          </div>

          {classData.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {classData.description}
            </p>
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <UsersThree weight="duotone" className="h-4 w-4" />
            <span>{memberCount} {memberCount === 1 ? 'student' : 'students'}</span>
          </div>
        </CardContent>

        <CardFooter className="pt-3 border-t flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Join code:</span>
            <code className="text-sm font-mono font-bold px-2.5 py-1 bg-muted rounded border border-dashed border-border">
              {classData.join_code}
            </code>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation();
              handleCopyJoinCode();
            }}
          >
            {copied ? (
              <Check weight="bold" className="h-4 w-4 text-green-600" />
            ) : (
              <Copy weight="duotone" className="h-4 w-4" />
            )}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
