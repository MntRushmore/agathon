'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { removeStudentFromClass } from '@/lib/api/classes';
import { MoreVertical, UserMinus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistance } from 'date-fns';

interface Student {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

interface ClassMemberWithStudent {
  id: string;
  student_id: string;
  joined_at: string;
  student: Student;
}

interface ClassRosterProps {
  classId: string;
  members: ClassMemberWithStudent[];
  onUpdate?: () => void;
}

export function ClassRoster({ classId, members, onUpdate }: ClassRosterProps) {
  const { toast } = useToast();
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleRemoveStudent = async (studentId: string, studentName: string) => {
    if (!confirm(`Remove ${studentName} from this class? They can rejoin using the join code.`)) {
      return;
    }

    setRemovingId(studentId);
    try {
      await removeStudentFromClass(classId, studentId);
      toast({
        title: 'Student removed',
        description: `${studentName} has been removed from the class`,
      });
      onUpdate?.();
    } catch (error) {
      console.error('Error removing student:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove student',
        variant: 'destructive',
      });
    } finally {
      setRemovingId(null);
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return email[0].toUpperCase();
  };

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg">
        <div className="rounded-full bg-muted p-4 mb-4">
          <UserMinus className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">No students yet</h3>
        <p className="text-muted-foreground max-w-md">
          Share your join code with students so they can enroll in this class.
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => (
            <TableRow key={member.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={member.student.avatar_url || undefined} />
                    <AvatarFallback>
                      {getInitials(member.student.full_name, member.student.email)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">
                    {member.student.full_name || 'Unknown Student'}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {member.student.email}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDistance(new Date(member.joined_at), new Date(), {
                  addSuffix: true,
                })}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={removingId === member.student_id}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() =>
                        handleRemoveStudent(
                          member.student_id,
                          member.student.full_name || member.student.email
                        )
                      }
                      className="text-destructive focus:text-destructive"
                    >
                      <UserMinus className="mr-2 h-4 w-4" />
                      Remove from class
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
