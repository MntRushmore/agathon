import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const assignmentId = searchParams.get('assignmentId');

    if (!assignmentId) {
      return NextResponse.json({ error: 'Assignment ID required' }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'teacher') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { data: conceptData, error } = await supabase
      .from('concept_mastery')
      .select(`
        concept_name,
        mastery_level,
        ai_help_count,
        solve_mode_used,
        time_spent_seconds,
        student:profiles!student_id(id, full_name)
      `)
      .eq('assignment_id', assignmentId);

    if (error) {
      console.error('Error fetching concept mastery:', error);
      return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }

    const conceptMap: Record<string, {
      concept: string;
      totalStudents: number;
      struggling: number;
      learning: number;
      proficient: number;
      mastered: number;
      avgHelpCount: number;
      solveUsedCount: number;
      avgTimeSeconds: number;
    }> = {};

    (conceptData || []).forEach((item: any) => {
      const concept = item.concept_name;
      if (!conceptMap[concept]) {
        conceptMap[concept] = {
          concept,
          totalStudents: 0,
          struggling: 0,
          learning: 0,
          proficient: 0,
          mastered: 0,
          avgHelpCount: 0,
          solveUsedCount: 0,
          avgTimeSeconds: 0,
        };
      }

      conceptMap[concept].totalStudents++;
      conceptMap[concept][item.mastery_level as 'struggling' | 'learning' | 'proficient' | 'mastered']++;
      conceptMap[concept].avgHelpCount += item.ai_help_count || 0;
      if (item.solve_mode_used) conceptMap[concept].solveUsedCount++;
      conceptMap[concept].avgTimeSeconds += item.time_spent_seconds || 0;
    });

    const concepts = Object.values(conceptMap).map(c => ({
      ...c,
      avgHelpCount: c.totalStudents > 0 ? Math.round(c.avgHelpCount / c.totalStudents * 10) / 10 : 0,
      avgTimeSeconds: c.totalStudents > 0 ? Math.round(c.avgTimeSeconds / c.totalStudents) : 0,
      strugglingPercent: c.totalStudents > 0 ? Math.round((c.struggling / c.totalStudents) * 100) : 0,
    }));

    concepts.sort((a, b) => b.strugglingPercent - a.strugglingPercent);

    const { data: aiUsage } = await supabase
      .from('ai_usage')
      .select('mode, concept_tags')
      .eq('assignment_id', assignmentId);

    const modeBreakdown = {
      feedback: 0,
      suggest: 0,
      answer: 0,
      chat: 0,
    };

    (aiUsage || []).forEach((usage: any) => {
      if (usage.mode in modeBreakdown) {
        modeBreakdown[usage.mode as keyof typeof modeBreakdown]++;
      }
    });

    return NextResponse.json({ 
      concepts,
      modeBreakdown,
      totalAIInteractions: aiUsage?.length || 0,
    });
  } catch (error) {
    console.error('Concept mastery API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
