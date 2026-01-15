'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertTriangle,
  Clock,
  HelpCircle,
  Eye,
  CheckCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { formatDistance } from 'date-fns';
import { useRouter } from 'next/navigation';

interface StruggleIndicator {
  id: string;
  indicator_type: 'repeated_hints' | 'long_time' | 'erasing' | 'no_progress' | 'explicit_help';
  severity: 'low' | 'medium' | 'high';
  details?: any;
  created_at: string;
}

interface StrugglingStudent {
  id: string;
  ai_help_count: number;
  solve_mode_count: number;
  time_spent_seconds: number;
  last_activity_at: string | null;
  student: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
  student_board: {
    id: string;
    title: string;
    preview: string | null;
    updated_at: string;
  } | null;
  assignment: {
    id: string;
    title: string;
    class: {
      id: string;
      name: string;
    };
  };
  struggle_indicators: StruggleIndicator[];
}

interface StrugglingStudentsPanelProps {
  classId?: string;
  assignmentId?: string;
  refreshInterval?: number;
}

const indicatorConfig = {
  repeated_hints: {
    icon: HelpCircle,
    label: 'Repeated help requests',
    color: 'text-amber-600',
  },
  long_time: {
    icon: Clock,
    label: 'Extended time on problem',
    color: 'text-blue-600',
  },
  erasing: {
    icon: AlertTriangle,
    label: 'Frequent erasing',
    color: 'text-orange-600',
  },
  no_progress: {
    icon: AlertTriangle,
    label: 'No progress detected',
    color: 'text-red-600',
  },
  explicit_help: {
    icon: HelpCircle,
    label: 'Asked for help',
    color: 'text-purple-600',
  },
};

export function StrugglingStudentsPanel({
  classId,
  assignmentId,
  refreshInterval = 30000,
}: StrugglingStudentsPanelProps) {
  const router = useRouter();
  const [students, setStudents] = useState<StrugglingStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (classId) params.set('classId', classId);
      if (assignmentId) params.set('assignmentId', assignmentId);

      const res = await fetch(`/api/teacher/struggling-students?${params}`);
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students || []);
      }
    } catch (error) {
      console.error('Failed to fetch struggling students:', error);
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, [classId, assignmentId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval]);

  const handleResolve = async (indicatorId: string) => {
    try {
      await fetch('/api/teacher/struggling-students', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ indicatorId, resolved: true }),
      });
      fetchData();
    } catch (error) {
      console.error('Failed to resolve indicator:', error);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'high':
        return <Badge variant="destructive">Urgent</Badge>;
      case 'medium':
        return <Badge className="bg-amber-500">Needs Attention</Badge>;
      default:
        return <Badge variant="secondary">Monitor</Badge>;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Struggling Students
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={students.length > 0 ? 'border-amber-300' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className={`h-5 w-5 ${students.length > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
            Struggling Students
            {students.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {students.length}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Last updated {formatDistance(lastRefresh, new Date(), { addSuffix: true })}
        </p>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {students.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="font-medium">All students are doing well!</p>
              <p className="text-sm">No struggling indicators detected</p>
            </div>
          ) : (
            students.map((student) => (
              <div
                key={student.id}
                className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {student.student.avatar_url ? (
                      <img
                        src={student.student.avatar_url}
                        alt=""
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-medium">
                        {(student.student.full_name || student.student.email)[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-medium">
                        {student.student.full_name || 'Unknown'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {student.assignment.title} • {student.assignment.class.name}
                      </p>
                    </div>
                  </div>
                  {student.struggle_indicators[0] && getSeverityBadge(student.struggle_indicators[0].severity)}
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  {student.struggle_indicators.map((indicator) => {
                    const config = indicatorConfig[indicator.indicator_type];
                    const Icon = config.icon;
                    return (
                      <div
                        key={indicator.id}
                        className="flex items-center gap-1.5 text-xs bg-muted px-2 py-1 rounded"
                      >
                        <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                        <span>{config.label}</span>
                        <button
                          onClick={() => handleResolve(indicator.id)}
                          className="ml-1 hover:text-green-600"
                          title="Mark as resolved"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                  <span>{student.ai_help_count} AI helps</span>
                  <span>{student.solve_mode_count} solves used</span>
                  <span>{formatTime(student.time_spent_seconds || 0)} spent</span>
                </div>

                <div className="flex gap-2">
                  {student.student_board && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/board/${student.student_board!.id}`)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View Board
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      )}
    </Card>
  );
}
