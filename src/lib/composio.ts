/**
 * Composio Integration - Manages external account connections and content sync
 * Used for the Knowledge Base feature (Google Drive, Google Classroom)
 */
import { Composio } from '@composio/core';

let composioClient: InstanceType<typeof Composio> | null = null;

export function getComposio() {
  if (!composioClient) {
    const apiKey = process.env.COMPOSIO_API_KEY;
    if (!apiKey) {
      throw new Error('COMPOSIO_API_KEY is not configured');
    }
    composioClient = new Composio({
      apiKey,
      toolkitVersions: {
        googledrive: '20260209_00',
        googledocs: '20260209_00',
        google_classroom: '20260203_00',
      },
    });
  }
  return composioClient;
}

export type KnowledgeProvider = 'google_drive' | 'google_classroom';

/** Provider display metadata and Composio auth config IDs */
export const PROVIDERS: Record<KnowledgeProvider, {
  label: string;
  description: string;
  app: string;
  authConfigId: string;
}> = {
  google_drive: {
    label: 'Google Drive',
    description: 'Sync documents and files from your Drive',
    app: 'GOOGLEDRIVE',
    authConfigId: process.env.COMPOSIO_GOOGLE_DRIVE_AUTH_CONFIG_ID || '',
  },
  google_classroom: {
    label: 'Google Classroom',
    description: 'Sync courses, assignments, and materials',
    app: 'GOOGLECLASSROOM',
    authConfigId: process.env.COMPOSIO_GOOGLE_CLASSROOM_AUTH_CONFIG_ID || '',
  },
};

/**
 * Initiate OAuth connection for a provider via Composio.
 * If a connection already exists, delete it first to allow re-connection.
 */
export async function initiateConnection(
  userId: string,
  provider: KnowledgeProvider,
  callbackUrl: string
) {
  const composio = getComposio();
  const { authConfigId } = PROVIDERS[provider];

  if (!authConfigId) {
    throw new Error(`Auth config ID not set for ${provider}. Add COMPOSIO_GOOGLE_DRIVE_AUTH_CONFIG_ID or COMPOSIO_GOOGLE_CLASSROOM_AUTH_CONFIG_ID to .env.local`);
  }

  // Delete ALL existing Composio connections for this user+provider to avoid duplicates
  try {
    const existing = await getAllConnections(userId, provider);
    for (const conn of existing) {
      if (conn?.id) {
        await composio.connectedAccounts.delete(conn.id);
      }
    }
  } catch {
    // Ignore — no existing connections to clean up
  }

  const connectionRequest = await composio.connectedAccounts.initiate(
    userId,
    authConfigId,
    { callbackUrl }
  );

  return connectionRequest;
}

/**
 * Delete a Composio connected account for a user+provider
 */
export async function deleteComposioConnection(userId: string, provider: KnowledgeProvider) {
  try {
    const composio = getComposio();
    const existing = await getAllConnections(userId, provider);
    for (const conn of existing) {
      if (conn?.id) {
        await composio.connectedAccounts.delete(conn.id);
      }
    }
  } catch {
    // Best-effort cleanup
  }
}

/**
 * Check connection status for a user+provider
 */
export async function getConnectionStatus(userId: string, provider: KnowledgeProvider) {
  const composio = getComposio();

  try {
    const connections = await composio.connectedAccounts.list({
      userIds: [userId],
    });

    const app = PROVIDERS[provider].app;
    const items = (connections as any)?.items || (Array.isArray(connections) ? connections : []);
    const match = items.find(
      (c: any) => c.appName?.toUpperCase() === app || c.toolkit?.toUpperCase() === app
    );

    return match || null;
  } catch {
    return null;
  }
}

/**
 * Get ALL connections for a user+provider (used for cleanup of duplicates)
 */
async function getAllConnections(userId: string, provider: KnowledgeProvider) {
  const composio = getComposio();

  try {
    const connections = await composio.connectedAccounts.list({
      userIds: [userId],
    });

    const app = PROVIDERS[provider].app;
    const items = (connections as any)?.items || (Array.isArray(connections) ? connections : []);
    return items.filter(
      (c: any) => c.appName?.toUpperCase() === app || c.toolkit?.toUpperCase() === app
    );
  } catch {
    return [];
  }
}

/**
 * Fetch content from Google Drive via Composio tools
 */
export async function fetchGoogleDriveContent(userId: string) {
  const composio = getComposio();

  const result = await composio.tools.execute('GOOGLEDRIVE_FIND_FILE', {
    userId,
    arguments: {
      query: "mimeType='application/vnd.google-apps.document' or mimeType='application/pdf'",
      page_size: 50,
    },
  });

  return result;
}

/**
 * Fetch a specific Google Doc's text content via Drive
 */
export async function fetchGoogleDocById(userId: string, documentId: string) {
  const composio = getComposio();

  const result = await composio.tools.execute('GOOGLEDOCS_GET_DOCUMENT_BY_ID', {
    userId,
    arguments: { document_id: documentId },
  });

  return result;
}

/**
 * Fetch courses from Google Classroom
 */
export async function fetchClassroomCourses(userId: string) {
  const composio = getComposio();

  const result = await composio.tools.execute('GOOGLE_CLASSROOM_COURSES_LIST', {
    userId,
    arguments: {},
  });

  return result;
}

/**
 * Fetch coursework (assignments) for a specific course
 */
export async function fetchClassroomCoursework(userId: string, courseId: string) {
  const composio = getComposio();

  const result = await composio.tools.execute('GOOGLE_CLASSROOM_COURSE_WORK_LIST', {
    userId,
    arguments: { courseId },
  });

  return result;
}

/**
 * Fetch student submissions for a specific coursework item
 */
export async function fetchStudentSubmissions(userId: string, courseId: string, courseWorkId: string) {
  const composio = getComposio();

  const result = await composio.tools.execute('GOOGLE_CLASSROOM_STUDENT_SUBMISSIONS_LIST', {
    userId,
    arguments: { courseId, courseWorkId },
  });

  return result;
}

/**
 * Fetch course materials for a specific course
 */
export async function fetchClassroomMaterials(userId: string, courseId: string) {
  const composio = getComposio();

  const result = await composio.tools.execute('GOOGLE_CLASSROOM_COURSE_WORK_MATERIALS_LIST', {
    userId,
    arguments: { courseId },
  });

  return result;
}

/**
 * Add a link attachment to a student's submission in Google Classroom
 */
export async function addSubmissionLink(
  userId: string,
  courseId: string,
  courseWorkId: string,
  submissionId: string,
  url: string,
  title?: string
) {
  const composio = getComposio();

  const result = await composio.tools.execute(
    'GOOGLE_CLASSROOM_STUDENT_SUBMISSIONS_MODIFY_ATTACHMENTS',
    {
      userId,
      arguments: {
        courseId,
        courseWorkId,
        id: submissionId,
        addAttachments: [
          {
            link: {
              url,
              title: title || 'Whiteboard Submission',
            },
          },
        ],
      },
    }
  );

  return result;
}

/**
 * Turn in a student submission in Google Classroom
 */
export async function turnInSubmission(
  userId: string,
  courseId: string,
  courseWorkId: string,
  submissionId: string
) {
  const composio = getComposio();

  const result = await composio.tools.execute(
    'GOOGLE_CLASSROOM_STUDENT_SUBMISSIONS_TURN_IN',
    {
      userId,
      arguments: {
        courseId,
        courseWorkId,
        id: submissionId,
      },
    }
  );

  return result;
}

/**
 * Create a coursework (assignment) in Google Classroom
 */
export async function createClassroomCoursework(
  userId: string,
  courseId: string,
  title: string,
  description: string,
  linkUrl: string,
  dueDate?: { year: number; month: number; day: number; hours?: number; minutes?: number }
) {
  const composio = getComposio();

  const args: Record<string, unknown> = {
    courseId,
    title,
    description,
    workType: 'ASSIGNMENT',
    state: 'PUBLISHED',
    materials: [
      {
        link: {
          url: linkUrl,
          title: 'Open in Agathon',
        },
      },
    ],
  };

  if (dueDate) {
    args.dueDate = { year: dueDate.year, month: dueDate.month, day: dueDate.day };
    if (dueDate.hours !== undefined) {
      args.dueTime = { hours: dueDate.hours, minutes: dueDate.minutes ?? 0 };
    }
  }

  const result = await composio.tools.execute('GOOGLE_CLASSROOM_COURSE_WORK_CREATE', {
    userId,
    arguments: args,
  });

  return result;
}

/**
 * Extract plain text from Composio tool response
 * Handles different response shapes from Google Docs and Classroom
 */
export function extractTextContent(response: Record<string, unknown>): string {
  if (typeof response === 'string') return response;

  const data = response.data || response.response_data || response;

  // Google Docs: body.content array of structural elements
  if (data && typeof data === 'object' && 'body' in (data as Record<string, unknown>)) {
    const body = (data as Record<string, unknown>).body as Record<string, unknown>;
    if (body?.content && Array.isArray(body.content)) {
      return body.content
        .map((element: Record<string, unknown>) => {
          const paragraph = element.paragraph as Record<string, unknown> | undefined;
          if (paragraph?.elements && Array.isArray(paragraph.elements)) {
            return paragraph.elements
              .map((el: Record<string, unknown>) => {
                const textRun = el.textRun as Record<string, unknown> | undefined;
                return textRun?.content || '';
              })
              .join('');
          }
          return '';
        })
        .join('')
        .trim();
    }
  }

  // Google Classroom: coursework/materials have description, title fields
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const parts: string[] = [];
    if (obj.title) parts.push(String(obj.title));
    if (obj.description) parts.push(String(obj.description));
    if (obj.text) parts.push(String(obj.text));
    if (parts.length > 0) return parts.join('\n\n');
  }

  // Array of items (courses, coursework list)
  if (data && typeof data === 'object' && 'results' in (data as Record<string, unknown>)) {
    const results = (data as Record<string, unknown>).results;
    if (Array.isArray(results)) {
      return results
        .map((item: Record<string, unknown>) => {
          const parts: string[] = [];
          if (item.title) parts.push(String(item.title));
          if (item.name) parts.push(String(item.name));
          if (item.description) parts.push(String(item.description));
          return parts.join(': ');
        })
        .join('\n')
        .trim();
    }
  }

  // Fallback: stringify
  if (typeof data === 'string') return data;
  return JSON.stringify(data).slice(0, 5000);
}
