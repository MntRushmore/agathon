/**
 * Knowledge Base AI Agent
 *
 * Searches the user's synced knowledge base for relevant context
 * and injects it into the system prompt before calling the LLM.
 * This makes the tutor aware of the student's own notes and materials.
 */
import { createServiceRoleClient } from '@/lib/supabase/server';

interface KnowledgeContext {
  found: boolean;
  snippets: { title: string; content: string; source: string }[];
}

/**
 * Search the user's knowledge base for content relevant to their question.
 * Uses PostgreSQL full-text search with fallback to ILIKE.
 */
export async function searchKnowledgeBase(
  userId: string,
  query: string,
  limit = 3
): Promise<KnowledgeContext> {
  const supabase = createServiceRoleClient();

  // Extract key terms from the query for better search
  const searchTerms = extractSearchTerms(query);

  if (searchTerms.length === 0) {
    return { found: false, snippets: [] };
  }

  // Try full-text search first
  const tsQuery = searchTerms.join(' & ');
  const { data, error } = await supabase
    .from('knowledge_base')
    .select('title, content, source')
    .eq('user_id', userId)
    .textSearch('content', tsQuery, { type: 'plain' })
    .limit(limit);

  if (!error && data && data.length > 0) {
    return {
      found: true,
      snippets: data.map((d) => ({
        title: d.title || 'Untitled',
        content: extractRelevantSnippet(d.content, searchTerms),
        source: d.source,
      })),
    };
  }

  // Fallback: ILIKE search with the most significant term
  const primaryTerm = searchTerms[0];
  const { data: fallbackData } = await supabase
    .from('knowledge_base')
    .select('title, content, source')
    .eq('user_id', userId)
    .or(`title.ilike.%${primaryTerm}%,content.ilike.%${primaryTerm}%`)
    .limit(limit);

  if (fallbackData && fallbackData.length > 0) {
    return {
      found: true,
      snippets: fallbackData.map((d) => ({
        title: d.title || 'Untitled',
        content: extractRelevantSnippet(d.content, searchTerms),
        source: d.source,
      })),
    };
  }

  return { found: false, snippets: [] };
}

/**
 * Build an enhanced system prompt that includes knowledge base context
 */
export function buildKnowledgeAwarePrompt(
  basePrompt: string,
  knowledgeContext: KnowledgeContext
): string {
  if (!knowledgeContext.found || knowledgeContext.snippets.length === 0) {
    return basePrompt;
  }

  const contextBlock = knowledgeContext.snippets
    .map((s, i) => `[${i + 1}] "${s.title}" (from ${formatSource(s.source)}):\n${s.content}`)
    .join('\n\n');

  return `${basePrompt}

KNOWLEDGE BASE CONTEXT:
The student has connected their personal notes and study materials. Below are relevant excerpts from their own documents that may help you provide personalized tutoring:

${contextBlock}

IMPORTANT: Use this context naturally when relevant. Reference their notes (e.g. "I can see from your notes on [topic] that...") to make the tutoring feel personalized. Do NOT quote large sections verbatim — summarize and connect to their question. If the knowledge base context is not relevant to their current question, simply ignore it.`;
}

/**
 * Check if a user has any knowledge base content
 */
export async function hasKnowledgeBase(userId: string): Promise<boolean> {
  const supabase = createServiceRoleClient();

  const { count } = await supabase
    .from('knowledge_base')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  return (count ?? 0) > 0;
}

/**
 * Fetch upcoming assignments (due in the next 7 days, not yet turned in)
 * and build a context string for the AI tutor.
 */
export async function getUpcomingAssignmentsContext(userId: string): Promise<string> {
  const supabase = createServiceRoleClient();

  const { data } = await supabase
    .from('knowledge_base')
    .select('title, metadata')
    .eq('user_id', userId)
    .eq('source', 'google_classroom')
    .filter('metadata->>type', 'eq', 'coursework')
    .limit(50);

  if (!data || data.length === 0) return '';

  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const upcoming = data
    .map(item => {
      const meta = item.metadata as Record<string, any>;
      const dueDate = parseDueDateHelper(meta?.due_date);
      return { title: item.title, courseName: meta?.course_name, dueDate, submissionState: meta?.submission_state, assignedGrade: meta?.assigned_grade, maxPoints: meta?.max_points };
    })
    .filter(a => {
      if (!a.dueDate) return false;
      const turnedIn = a.submissionState === 'TURNED_IN' || a.submissionState === 'RETURNED';
      return a.dueDate >= now && a.dueDate <= weekFromNow && !turnedIn;
    })
    .sort((a, b) => (a.dueDate!.getTime() - b.dueDate!.getTime()));

  if (upcoming.length === 0) return '';

  const lines = upcoming.map(a => {
    const days = Math.ceil((a.dueDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const urgency = days <= 1 ? '(DUE TOMORROW!)' : days <= 2 ? '(due very soon)' : `(due in ${days} days)`;
    return `- "${a.title}" for ${a.courseName || 'Unknown Course'} ${urgency}`;
  });

  return `\nUPCOMING ASSIGNMENTS (next 7 days):\n${lines.join('\n')}\nYou may proactively mention these if relevant, e.g. "I see you have [assignment] due soon — would you like help with it?"`;
}

function parseDueDateHelper(dueDate: any): Date | null {
  if (!dueDate) return null;
  if (typeof dueDate === 'string') return new Date(dueDate);
  if (dueDate.year && dueDate.month && dueDate.day) {
    return new Date(dueDate.year, dueDate.month - 1, dueDate.day);
  }
  return null;
}

// --- Helpers ---

function extractSearchTerms(query: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
    'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
    'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
    'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'both',
    'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
    'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
    'because', 'but', 'and', 'or', 'if', 'while', 'about', 'what', 'which',
    'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'it', 'its',
    'i', 'me', 'my', 'myself', 'we', 'our', 'help', 'please', 'explain',
    'tell', 'show', 'give', 'know', 'understand', 'work', 'solve',
  ]);

  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w))
    .slice(0, 5);
}

function extractRelevantSnippet(content: string, terms: string[], maxLength = 400): string {
  const lower = content.toLowerCase();

  // Find the best window around matching terms
  let bestStart = 0;
  let bestScore = 0;

  for (let i = 0; i < content.length - maxLength; i += 50) {
    const window = lower.slice(i, i + maxLength);
    let score = 0;
    for (const term of terms) {
      if (window.includes(term)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestStart = i;
    }
  }

  const snippet = content.slice(bestStart, bestStart + maxLength).trim();

  // Add ellipsis if truncated
  const prefix = bestStart > 0 ? '...' : '';
  const suffix = bestStart + maxLength < content.length ? '...' : '';

  return `${prefix}${snippet}${suffix}`;
}

function formatSource(source: string): string {
  const labels: Record<string, string> = {
    google_drive: 'Google Drive',
    google_classroom: 'Google Classroom',
  };
  return labels[source] || source;
}
