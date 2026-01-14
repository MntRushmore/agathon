'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { joinClass, getStudentClasses } from '@/lib/api/classes';
import { ArrowLeft, Users, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

interface EnrolledClass {
  id: string;
  class_id: string;
  student_id: string;
  joined_at: string;
  class: {
    id: string;
    name: string;
    subject: string | null;
    grade_level: string | null;
    teacher_id: string;
  };
}

export default function StudentJoinPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [enrolledClasses, setEnrolledClasses] = useState<EnrolledClass[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);

  const loadEnrolledClasses = async () => {
    setLoadingClasses(true);
    try {
      const classes = await getStudentClasses();
      setEnrolledClasses(classes as EnrolledClass[]);
    } catch (error) {
      console.error('Error loading enrolled classes:', error);
    } finally {
      setLoadingClasses(false);
    }
  };

  useEffect(() => {
    loadEnrolledClasses();
  }, []);

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();

    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      toast({
        title: 'Invalid code',
        description: 'Join code must be 6 characters',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const result = await joinClass(code);
      toast({
        title: 'Successfully joined!',
        description: `You've been enrolled in ${result.class.name}`,
      });
      setJoinCode('');
      loadEnrolledClasses();
    } catch (error: any) {
      console.error('Error joining class:', error);
      if (error.message === 'Already enrolled in this class') {
        toast({
          title: 'Already enrolled',
          description: 'You are already a member of this class',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Invalid join code',
          description: 'Could not find a class with this code',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setJoinCode(value.slice(0, 6));
  };

  return (
    <div className="min-h-screen bg-background page-transition">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/')}
          className="mb-6"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-semibold mb-3">Join a Class</h1>
          <p className="text-muted-foreground text-lg">
            Enter the 6-character code from your teacher
          </p>
        </div>

        <Card className="mb-12">
          <CardHeader>
            <CardTitle>Enter Join Code</CardTitle>
            <CardDescription>
              Your teacher will provide you with a unique code
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoinClass} className="space-y-4">
              <div className="flex gap-3">
                <Input
                  value={joinCode}
                  onChange={handleCodeChange}
                  placeholder="ABC123"
                  className="text-2xl font-mono font-bold text-center tracking-wider h-14"
                  maxLength={6}
                  autoComplete="off"
                  autoCapitalize="characters"
                />
                <Button type="submit" disabled={loading || joinCode.length !== 6} className="h-14 px-8">
                  {loading ? 'Joining...' : 'Join Class'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Join codes are 6 characters long and case-insensitive
              </p>
            </form>
          </CardContent>
        </Card>

        {/* Enrolled Classes */}
        <div>
          <h2 className="text-2xl font-semibold mb-6">Your Classes</h2>
          {loadingClasses ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-muted rounded-lg skeleton" />
              ))}
            </div>
          ) : enrolledClasses.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="rounded-full bg-muted p-4 mx-auto w-fit mb-4">
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">Not enrolled in any classes yet</h3>
                <p className="text-muted-foreground">
                  Enter a join code above to join your first class
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {enrolledClasses.map((enrollment) => (
                <Card
                  key={enrollment.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => router.push('/')}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-medium">{enrollment.class.name}</h3>
                          <Check className="h-5 w-5 text-green-600" />
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          {enrollment.class.grade_level && (
                            <span className="text-sm text-muted-foreground">
                              {enrollment.class.grade_level}
                            </span>
                          )}
                          {enrollment.class.subject && (
                            <Badge variant="secondary">{enrollment.class.subject}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
