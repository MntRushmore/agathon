'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, BarChart3, TrendingDown, TrendingUp } from 'lucide-react';

interface ConceptData {
  concept: string;
  totalStudents: number;
  struggling: number;
  learning: number;
  proficient: number;
  mastered: number;
  avgHelpCount: number;
  solveUsedCount: number;
  avgTimeSeconds: number;
  strugglingPercent: number;
}

interface ConceptMasteryHeatmapProps {
  assignmentId: string;
}

const getMasteryColor = (strugglingPercent: number) => {
  if (strugglingPercent >= 70) return 'bg-red-500';
  if (strugglingPercent >= 50) return 'bg-orange-500';
  if (strugglingPercent >= 30) return 'bg-amber-500';
  if (strugglingPercent >= 15) return 'bg-yellow-500';
  return 'bg-green-500';
};

const getMasteryLabel = (strugglingPercent: number) => {
  if (strugglingPercent >= 70) return 'Critical';
  if (strugglingPercent >= 50) return 'Needs Review';
  if (strugglingPercent >= 30) return 'Some Struggle';
  if (strugglingPercent >= 15) return 'Minor Issues';
  return 'On Track';
};

export function ConceptMasteryHeatmap({ assignmentId }: ConceptMasteryHeatmapProps) {
  const [concepts, setConcepts] = useState<ConceptData[]>([]);
  const [modeBreakdown, setModeBreakdown] = useState<Record<string, number>>({});
  const [totalInteractions, setTotalInteractions] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/teacher/concept-mastery?assignmentId=${assignmentId}`);
      if (res.ok) {
        const data = await res.json();
        setConcepts(data.concepts || []);
        setModeBreakdown(data.modeBreakdown || {});
        setTotalInteractions(data.totalAIInteractions || 0);
      }
    } catch (error) {
      console.error('Failed to fetch concept mastery:', error);
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
            <BarChart3 className="h-5 w-5" />
            Concept Mastery
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
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Concept Mastery Heatmap
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold">{totalInteractions}</div>
            <div className="text-xs text-muted-foreground">Total AI Interactions</div>
          </div>
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/40 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{modeBreakdown.feedback || 0}</div>
            <div className="text-xs text-muted-foreground">Feedback</div>
          </div>
          <div className="text-center p-3 bg-amber-50 dark:bg-amber-950/40 rounded-lg">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{modeBreakdown.suggest || 0}</div>
            <div className="text-xs text-muted-foreground">Suggestions</div>
          </div>
          <div className="text-center p-3 bg-green-50 dark:bg-green-950/40 rounded-lg">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{modeBreakdown.answer || 0}</div>
            <div className="text-xs text-muted-foreground">Solves</div>
          </div>
        </div>

        {concepts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No concept data yet</p>
            <p className="text-sm">Concept mastery will appear as students use AI help</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>Concept</span>
              <span>Class Performance</span>
            </div>
            {concepts.map((concept) => (
              <div key={concept.concept} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${getMasteryColor(concept.strugglingPercent)}`} />
                    <span className="font-medium">{concept.concept}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {getMasteryLabel(concept.strugglingPercent)}
                  </Badge>
                </div>

                <div className="h-4 bg-muted rounded-full overflow-hidden flex mb-2">
                  {concept.struggling > 0 && (
                    <div
                      className="bg-red-500 h-full"
                      style={{ width: `${(concept.struggling / concept.totalStudents) * 100}%` }}
                      title={`${concept.struggling} struggling`}
                    />
                  )}
                  {concept.learning > 0 && (
                    <div
                      className="bg-amber-500 h-full"
                      style={{ width: `${(concept.learning / concept.totalStudents) * 100}%` }}
                      title={`${concept.learning} learning`}
                    />
                  )}
                  {concept.proficient > 0 && (
                    <div
                      className="bg-blue-500 h-full"
                      style={{ width: `${(concept.proficient / concept.totalStudents) * 100}%` }}
                      title={`${concept.proficient} proficient`}
                    />
                  )}
                  {concept.mastered > 0 && (
                    <div
                      className="bg-green-500 h-full"
                      style={{ width: `${(concept.mastered / concept.totalStudents) * 100}%` }}
                      title={`${concept.mastered} mastered`}
                    />
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      {concept.struggling} struggling
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      {concept.mastered} mastered
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>{concept.avgHelpCount} avg helps</span>
                    <span>{formatTime(concept.avgTimeSeconds)} avg time</span>
                  </div>
                </div>

                {concept.strugglingPercent >= 50 && (
                  <div className="mt-2 p-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" />
                    <span>
                      {concept.strugglingPercent}% of students need help with this concept. Consider reviewing in class.
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-center gap-6 pt-4 border-t text-xs">
          <span className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" /> Struggling
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-amber-500" /> Learning
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-blue-500" /> Proficient
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-green-500" /> Mastered
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
