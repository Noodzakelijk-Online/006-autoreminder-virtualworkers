/**
 * ATIS AI Task Understanding Service
 * 
 * Uses AI to analyze Trello cards and generate:
 * - Task goal and deliverable
 * - Entity extraction (people, organizations, systems, documents)
 * - Complexity assessment
 * - Time estimation
 * - APTLSS checklist generation
 */

import { getDb } from '../db';
import { 
  atisCards, 
  atisAttachments, 
  atisComments,
  atisCardUnderstanding,
  atisBoards,
  type ATISCard,
  type ATISAttachment,
  type ATISComment,
} from '../../drizzle/schema';
import { eq, isNull, and, sql, desc } from 'drizzle-orm';

const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL || 'https://forge.manus.ai';
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

console.log('[ATIS Understanding] Forge API URL:', FORGE_API_URL);
console.log('[ATIS Understanding] Forge API Key:', FORGE_API_KEY ? 'set' : 'NOT SET');

interface CardContext {
  card: ATISCard;
  boardName: string;
  attachments: ATISAttachment[];
  comments: ATISComment[];
}

interface TaskUnderstanding {
  goal: string;
  deliverable: string;
  taskType: string;
  entities: {
    people: string[];
    organizations: string[];
    cases: string[];
    systems: string[];
    documents: string[];
  };
  deadlines: Array<{ date: string; source: string; description: string }>;
  estimatedMinutes: number;
  dependencies: string[];
  produces: string[];
  domain: string;
  complexity: 'simple' | 'medium' | 'complex';
  clarityScore: number;
  missingInfo: string[];
  confidenceScore: number;
  aptlssChecklist: APTLSSItem[];
}

interface APTLSSItem {
  name: string;
  estimatedMinutes: number;
  priority: 'A' | 'P' | 'T' | 'L' | 'S';
  dependencies?: string[];
}

interface UnderstandingProgress {
  current: number;
  total: number;
  cardName: string;
  status: 'processing' | 'success' | 'failed';
}

type ProgressCallback = (progress: UnderstandingProgress) => void;

/**
 * Build full context for a card including attachments and comments
 */
async function buildCardContext(cardId: number): Promise<CardContext | null> {
  const db = await getDb();
  if (!db) return null;

  // Get the card
  const [card] = await db.select()
    .from(atisCards)
    .where(eq(atisCards.id, cardId))
    .limit(1);

  if (!card) return null;

  // Get board name
  const [board] = await db.select()
    .from(atisBoards)
    .where(eq(atisBoards.id, card.boardId))
    .limit(1);

  // Get attachments
  const attachments = await db.select()
    .from(atisAttachments)
    .where(eq(atisAttachments.cardId, cardId));

  // Get comments (most recent first)
  const comments = await db.select()
    .from(atisComments)
    .where(eq(atisComments.cardId, cardId))
    .orderBy(desc(atisComments.commentDate))
    .limit(50); // Limit to 50 most recent comments

  return {
    card,
    boardName: board?.name || 'Unknown Board',
    attachments,
    comments,
  };
}

/**
 * Format card context into a prompt for AI analysis
 */
function formatContextForAI(context: CardContext): string {
  const { card, boardName, attachments, comments } = context;

  let prompt = `# Task Card Analysis

## Card Information
- **Board**: ${boardName}
- **List**: ${card.listName || 'Unknown'}
- **Title**: ${card.name}
- **Description**: ${card.description || 'No description provided'}
- **Due Date**: ${card.dueDate ? new Date(card.dueDate).toLocaleDateString() : 'Not set'}
- **Labels**: ${card.labels || 'None'}

## Attachments (${attachments.length} total)
`;

  if (attachments.length > 0) {
    for (const att of attachments.slice(0, 20)) { // Limit to 20 attachments
      prompt += `- ${att.filename || att.url} (${att.fileType || 'unknown type'})`;
      if (att.extractedContent) {
        prompt += `\n  Content preview: ${att.extractedContent.substring(0, 500)}...`;
      }
      prompt += '\n';
    }
  } else {
    prompt += 'No attachments\n';
  }

  prompt += `\n## Comments (${comments.length} total, showing most recent)\n`;

  if (comments.length > 0) {
    for (const comment of comments.slice(0, 15)) { // Limit to 15 comments
      const date = comment.commentDate ? new Date(comment.commentDate).toLocaleDateString() : 'Unknown date';
      prompt += `- [${date}] ${comment.authorName || 'Unknown'}: ${comment.text?.substring(0, 300) || ''}${(comment.text?.length || 0) > 300 ? '...' : ''}\n`;
    }
  } else {
    prompt += 'No comments\n';
  }

  return prompt;
}

/**
 * Call AI to analyze the card and generate understanding
 */
async function analyzeWithAI(context: CardContext): Promise<TaskUnderstanding> {
  const contextText = formatContextForAI(context);

  const systemPrompt = `You are an expert task analyst for a Virtual Assistant management system. Your job is to analyze Trello cards and extract structured information to help VAs understand and complete tasks efficiently.

Analyze the provided card information and return a JSON object with the following structure:
{
  "goal": "Clear, concise statement of what this task is trying to achieve (1-2 sentences)",
  "deliverable": "Specific, tangible output that marks this task as complete",
  "taskType": "One of: communication, research, creation, meeting, review, admin, finance, legal, technical, personal",
  "entities": {
    "people": ["Names of people mentioned or involved"],
    "organizations": ["Companies, agencies, institutions mentioned"],
    "cases": ["Case numbers, reference numbers, ticket IDs"],
    "systems": ["Software, platforms, tools mentioned"],
    "documents": ["Specific documents referenced"]
  },
  "deadlines": [{"date": "YYYY-MM-DD", "source": "where this deadline came from", "description": "what's due"}],
  "estimatedMinutes": 30,
  "dependencies": ["What must happen before this task can be completed"],
  "produces": ["What completing this task enables or produces"],
  "domain": "Area of work (e.g., HR, Finance, Legal, IT, Personal, Business)",
  "complexity": "simple|medium|complex",
  "clarityScore": 7,
  "missingInfo": ["Information that would help complete this task but is not provided"],
  "confidenceScore": 85,
  "aptlssChecklist": [
    {"name": "Step 1 description", "estimatedMinutes": 10, "priority": "A"},
    {"name": "Step 2 description", "estimatedMinutes": 15, "priority": "P"},
    {"name": "Step 3 description", "estimatedMinutes": 5, "priority": "T"}
  ]
}

APTLSS Priority Guide:
- A (Afspraken/Appointments): Scheduled meetings, calls, appointments
- P (Projecten/Projects): Multi-step work requiring planning
- T (Taken/Tasks): Single actionable items
- L (Leesvoer/Reading): Documents to review, emails to read
- S (Someday/Maybe): Low priority items for later

Guidelines:
- Be specific and actionable in the checklist items
- Estimate time realistically based on task complexity
- Extract ALL entities mentioned in the card, comments, and attachments
- If information is unclear, note it in missingInfo
- Confidence score should reflect how well you understand what needs to be done
- Break complex tasks into 3-7 checklist items
- Simple tasks may only need 1-3 items

Return ONLY valid JSON, no markdown formatting or explanation.`;

  const userPrompt = `Analyze this Trello card and generate a structured task understanding:\n\n${contextText}`;

  try {
    const apiUrl = `${FORGE_API_URL}/v1/chat/completions`;
    console.log('[ATIS Understanding] Calling AI API:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FORGE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-20250514',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ATIS Understanding] AI API error response:', errorText);
      throw new Error(`AI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    // Parse the JSON response - handle markdown code blocks
    let jsonContent = content.trim();
    
    // Remove markdown code blocks if present
    if (jsonContent.startsWith('```json')) {
      jsonContent = jsonContent.slice(7);
    } else if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.slice(3);
    }
    if (jsonContent.endsWith('```')) {
      jsonContent = jsonContent.slice(0, -3);
    }
    jsonContent = jsonContent.trim();
    
    const understanding = JSON.parse(jsonContent) as TaskUnderstanding;
    return understanding;
  } catch (error: any) {
    console.error('[ATIS Understanding] AI analysis error:', error);
    
    // Return a default understanding on error
    return {
      goal: `Complete task: ${context.card.name}`,
      deliverable: 'Task completion',
      taskType: 'admin',
      entities: { people: [], organizations: [], cases: [], systems: [], documents: [] },
      deadlines: [],
      estimatedMinutes: 30,
      dependencies: [],
      produces: [],
      domain: 'General',
      complexity: 'medium',
      clarityScore: 3,
      missingInfo: ['AI analysis failed - manual review recommended'],
      confidenceScore: 20,
      aptlssChecklist: [
        { name: `Review and complete: ${context.card.name.substring(0, 50)}`, estimatedMinutes: 30, priority: 'T' }
      ],
    };
  }
}

/**
 * Save understanding to database
 */
async function saveUnderstanding(cardId: number, cardTrelloId: string, understanding: TaskUnderstanding): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Check if understanding already exists
  const [existing] = await db.select()
    .from(atisCardUnderstanding)
    .where(eq(atisCardUnderstanding.cardId, cardId))
    .limit(1);

  const data = {
    cardId,
    cardTrelloId,
    goal: understanding.goal,
    deliverable: understanding.deliverable,
    taskType: understanding.taskType,
    entities: JSON.stringify(understanding.entities),
    deadlines: JSON.stringify(understanding.deadlines),
    estimatedMinutes: understanding.estimatedMinutes,
    dependencies: JSON.stringify(understanding.dependencies),
    produces: JSON.stringify(understanding.produces),
    domain: understanding.domain,
    complexity: understanding.complexity,
    clarityScore: understanding.clarityScore,
    missingInfo: JSON.stringify(understanding.missingInfo),
    confidenceScore: understanding.confidenceScore,
    status: 'complete' as const,
    generatedAt: new Date(),
  };

  if (existing) {
    await db.update(atisCardUnderstanding)
      .set(data)
      .where(eq(atisCardUnderstanding.cardId, cardId));
  } else {
    await db.insert(atisCardUnderstanding).values(data);
  }
}

/**
 * Process a single card with AI understanding
 */
export async function processCardUnderstanding(cardId: number): Promise<TaskUnderstanding | null> {
  const context = await buildCardContext(cardId);
  if (!context) {
    console.error(`[ATIS Understanding] Card ${cardId} not found`);
    return null;
  }

  console.log(`[ATIS Understanding] Analyzing card: ${context.card.name.substring(0, 50)}...`);

  const understanding = await analyzeWithAI(context);
  await saveUnderstanding(cardId, context.card.trelloId, understanding);

  return understanding;
}

/**
 * Process all cards that don't have understanding yet
 */
export async function processAllCardsUnderstanding(
  onProgress?: ProgressCallback,
  limit?: number
): Promise<{ processed: number; failed: number }> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Get cards without understanding (non-archived only)
  const cardsWithoutUnderstanding = await db.select({
    id: atisCards.id,
    trelloId: atisCards.trelloId,
    name: atisCards.name,
  })
    .from(atisCards)
    .leftJoin(atisCardUnderstanding, eq(atisCards.id, atisCardUnderstanding.cardId))
    .where(and(
      isNull(atisCardUnderstanding.id),
      eq(atisCards.isArchived, 0)
    ))
    .limit(limit || 1000);

  console.log(`[ATIS Understanding] Found ${cardsWithoutUnderstanding.length} cards to process`);

  let processed = 0;
  let failed = 0;

  for (let i = 0; i < cardsWithoutUnderstanding.length; i++) {
    const card = cardsWithoutUnderstanding[i];

    if (onProgress) {
      onProgress({
        current: i + 1,
        total: cardsWithoutUnderstanding.length,
        cardName: card.name,
        status: 'processing',
      });
    }

    try {
      await processCardUnderstanding(card.id);
      processed++;

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: cardsWithoutUnderstanding.length,
          cardName: card.name,
          status: 'success',
        });
      }

      console.log(`[ATIS Understanding] [${i + 1}/${cardsWithoutUnderstanding.length}] Processed: ${card.name.substring(0, 50)}...`);
    } catch (error: any) {
      failed++;
      console.error(`[ATIS Understanding] Failed to process card ${card.id}:`, error.message);

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: cardsWithoutUnderstanding.length,
          cardName: card.name,
          status: 'failed',
        });
      }
    }

    // Rate limiting: wait 500ms between AI calls
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return { processed, failed };
}

/**
 * Get understanding statistics
 */
export async function getUnderstandingStats(): Promise<{
  totalCards: number;
  withUnderstanding: number;
  withoutUnderstanding: number;
  avgConfidence: number;
  avgClarity: number;
  byComplexity: { simple: number; medium: number; complex: number };
  byTaskType: Record<string, number>;
}> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const [totalResult] = await db.select({ count: sql<number>`count(*)` })
    .from(atisCards)
    .where(eq(atisCards.isArchived, 0));

  const [withResult] = await db.select({ count: sql<number>`count(*)` })
    .from(atisCardUnderstanding);

  const [avgResult] = await db.select({
    avgConfidence: sql<number>`AVG(confidenceScore)`,
    avgClarity: sql<number>`AVG(clarityScore)`,
  }).from(atisCardUnderstanding);

  // Get complexity breakdown
  const complexityResults = await db.select({
    complexity: atisCardUnderstanding.complexity,
    count: sql<number>`count(*)`,
  })
    .from(atisCardUnderstanding)
    .groupBy(atisCardUnderstanding.complexity);

  const byComplexity = { simple: 0, medium: 0, complex: 0 };
  for (const row of complexityResults) {
    if (row.complexity && row.complexity in byComplexity) {
      byComplexity[row.complexity as keyof typeof byComplexity] = Number(row.count);
    }
  }

  // Get task type breakdown
  const taskTypeResults = await db.select({
    taskType: atisCardUnderstanding.taskType,
    count: sql<number>`count(*)`,
  })
    .from(atisCardUnderstanding)
    .groupBy(atisCardUnderstanding.taskType);

  const byTaskType: Record<string, number> = {};
  for (const row of taskTypeResults) {
    if (row.taskType) {
      byTaskType[row.taskType] = Number(row.count);
    }
  }

  return {
    totalCards: Number(totalResult?.count) || 0,
    withUnderstanding: Number(withResult?.count) || 0,
    withoutUnderstanding: (Number(totalResult?.count) || 0) - (Number(withResult?.count) || 0),
    avgConfidence: Math.round(avgResult?.avgConfidence || 0),
    avgClarity: Math.round(avgResult?.avgClarity || 0),
    byComplexity,
    byTaskType,
  };
}
