/**
 * Enhanced APTLSS Parser
 * 
 * Parses APTLSS checklist items with improved accuracy for:
 * - Time duration extraction (multiple formats)
 * - Date/deadline detection
 * - Task type classification
 * - Dependency identification
 * - Confidence scoring
 */

export interface ParsedTask {
  description: string;
  cleanDescription: string;
  durationHours: number;
  durationConfidence: 'high' | 'medium' | 'low';
  dueDate: string | null;
  dateSource: 'explicit' | 'card' | 'inferred' | 'default';
  taskType: TaskType;
  dependencies: string[];
  isBlocker: boolean;
  hasExternalDependency: boolean;
  complexity: 'simple' | 'medium' | 'complex';
  keywords: string[];
}

export type TaskType = 
  | 'communication' // emails, calls, messages
  | 'research'      // research, analysis, review
  | 'creation'      // writing, design, development
  | 'admin'         // scheduling, filing, organizing
  | 'meeting'       // meetings, calls, sync
  | 'review'        // review, feedback, approval
  | 'other';

// Time duration patterns (ordered by specificity)
const TIME_PATTERNS = [
  // Explicit time ranges: "1-2 hours", "30-45 mins"
  { pattern: /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(h(?:ours?)?|hrs?|m(?:ins?)?|minutes?)/i, type: 'range' },
  // Combined format: "1h30m", "2h15min"
  { pattern: /(\d+)\s*h(?:ours?|rs?)?\s*(\d+)\s*m(?:ins?|inutes?)?/i, type: 'combined' },
  // Decimal hours: "1.5h", "0.5 hours"
  { pattern: /(\d+(?:\.\d+)?)\s*(h(?:ours?)?|hrs?)/i, type: 'hours' },
  // Minutes: "30m", "45 mins", "90 minutes"
  { pattern: /(\d+)\s*(m(?:ins?)?|minutes?)/i, type: 'minutes' },
  // Pomodoro: "2 pomodoros", "1 pomo"
  { pattern: /(\d+)\s*pomo(?:doros?)?/i, type: 'pomodoro' },
  // Time estimate in parentheses: "(30m)", "(1h)"
  { pattern: /\((\d+(?:\.\d+)?)\s*(h(?:ours?)?|hrs?|m(?:ins?)?|minutes?)\)/i, type: 'parentheses' },
  // Bracketed time: "[30m]", "[1h]"
  { pattern: /\[(\d+(?:\.\d+)?)\s*(h(?:ours?)?|hrs?|m(?:ins?)?|minutes?)\]/i, type: 'bracketed' },
];

// Date patterns
const DATE_PATTERNS = [
  // Explicit due date: "due: Dec 15", "due: 2025-12-15"
  { pattern: /due:\s*([^|,\n]+)/i, type: 'explicit' },
  // By date: "by Dec 15", "by tomorrow"
  { pattern: /by\s+([\w\s,]+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?)/i, type: 'by' },
  // Date in brackets: "[Dec 15]", "[2025-12-15]"
  { pattern: /\[(\d{4}-\d{2}-\d{2}|\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?)\]/i, type: 'bracketed' },
  // ISO date anywhere: "2025-12-15"
  { pattern: /(\d{4}-\d{2}-\d{2})/i, type: 'iso' },
];

// Task type keywords
const TASK_TYPE_KEYWORDS: Record<TaskType, string[]> = {
  communication: ['email', 'call', 'message', 'reply', 'respond', 'contact', 'reach out', 'follow up', 'send', 'notify'],
  research: ['research', 'analyze', 'investigate', 'study', 'explore', 'find', 'look into', 'gather', 'collect'],
  creation: ['write', 'create', 'design', 'develop', 'build', 'draft', 'compose', 'prepare', 'make', 'produce'],
  admin: ['schedule', 'organize', 'file', 'update', 'maintain', 'clean', 'sort', 'archive', 'backup', 'setup'],
  meeting: ['meeting', 'call', 'sync', 'standup', 'huddle', 'discussion', 'presentation', 'demo', 'interview'],
  review: ['review', 'check', 'approve', 'feedback', 'evaluate', 'assess', 'verify', 'validate', 'proofread'],
  other: [],
};

// Default durations by task type (in hours)
const DEFAULT_DURATIONS: Record<TaskType, number> = {
  communication: 0.25,  // 15 minutes
  research: 1.0,        // 1 hour
  creation: 1.5,        // 1.5 hours
  admin: 0.5,           // 30 minutes
  meeting: 0.5,         // 30 minutes
  review: 0.5,          // 30 minutes
  other: 0.5,           // 30 minutes default
};

// Complexity indicators
const COMPLEXITY_KEYWORDS = {
  simple: ['quick', 'simple', 'easy', 'brief', 'short', 'minor', 'small'],
  complex: ['complex', 'detailed', 'comprehensive', 'thorough', 'extensive', 'in-depth', 'major', 'large'],
};

// Dependency keywords
const DEPENDENCY_KEYWORDS = ['after', 'once', 'when', 'depends on', 'requires', 'waiting for', 'blocked by', 'following'];

// Blocker keywords
const BLOCKER_KEYWORDS = ['blocker', 'blocking', 'critical', 'urgent', 'asap', 'priority', 'important'];

/**
 * Parse time duration from task description
 */
function parseTimeDuration(text: string): { hours: number; confidence: 'high' | 'medium' | 'low'; matched: string | null } {
  for (const { pattern, type } of TIME_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      let hours: number;
      
      switch (type) {
        case 'range':
          // Take average of range
          const min = parseFloat(match[1]);
          const max = parseFloat(match[2]);
          const unit = match[3].toLowerCase();
          const avgValue = (min + max) / 2;
          hours = unit.startsWith('m') ? avgValue / 60 : avgValue;
          return { hours, confidence: 'high', matched: match[0] };
          
        case 'combined':
          hours = parseInt(match[1]) + parseInt(match[2]) / 60;
          return { hours, confidence: 'high', matched: match[0] };
          
        case 'hours':
          hours = parseFloat(match[1]);
          return { hours, confidence: 'high', matched: match[0] };
          
        case 'minutes':
          hours = parseInt(match[1]) / 60;
          return { hours, confidence: 'high', matched: match[0] };
          
        case 'pomodoro':
          // 1 pomodoro = 25 minutes
          hours = parseInt(match[1]) * 25 / 60;
          return { hours, confidence: 'medium', matched: match[0] };
          
        case 'parentheses':
        case 'bracketed':
          const value = parseFloat(match[1]);
          const timeUnit = match[2].toLowerCase();
          hours = timeUnit.startsWith('m') ? value / 60 : value;
          return { hours, confidence: 'high', matched: match[0] };
      }
    }
  }
  
  return { hours: 0, confidence: 'low', matched: null };
}

/**
 * Parse due date from task description
 */
function parseDueDate(text: string, cardDueDate?: string): { date: string | null; source: 'explicit' | 'card' | 'inferred' | 'default' } {
  for (const { pattern, type } of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const dateStr = match[1].trim();
      const parsedDate = parseFlexibleDate(dateStr);
      if (parsedDate) {
        return { date: parsedDate, source: 'explicit' };
      }
    }
  }
  
  // Check for relative dates
  const lowerText = text.toLowerCase();
  const today = new Date();
  
  if (lowerText.includes('today')) {
    return { date: formatDate(today), source: 'inferred' };
  }
  if (lowerText.includes('tomorrow')) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { date: formatDate(tomorrow), source: 'inferred' };
  }
  if (lowerText.includes('this week')) {
    // End of this week (Friday)
    const friday = new Date(today);
    friday.setDate(friday.getDate() + (5 - friday.getDay()));
    return { date: formatDate(friday), source: 'inferred' };
  }
  if (lowerText.includes('next week')) {
    // Start of next week (Monday)
    const nextMonday = new Date(today);
    nextMonday.setDate(nextMonday.getDate() + (8 - nextMonday.getDay()));
    return { date: formatDate(nextMonday), source: 'inferred' };
  }
  
  // Use card due date if available
  if (cardDueDate) {
    return { date: cardDueDate, source: 'card' };
  }
  
  // Default to today
  return { date: formatDate(today), source: 'default' };
}

/**
 * Parse flexible date formats
 */
function parseFlexibleDate(dateStr: string): string | null {
  // Try ISO format first
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Try parsing with Date
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return formatDate(parsed);
  }
  
  return null;
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Detect task type from description
 */
function detectTaskType(text: string): TaskType {
  const lowerText = text.toLowerCase();
  
  for (const [type, keywords] of Object.entries(TASK_TYPE_KEYWORDS)) {
    if (type === 'other') continue;
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        return type as TaskType;
      }
    }
  }
  
  return 'other';
}

/**
 * Detect task complexity
 */
function detectComplexity(text: string): 'simple' | 'medium' | 'complex' {
  const lowerText = text.toLowerCase();
  
  for (const keyword of COMPLEXITY_KEYWORDS.complex) {
    if (lowerText.includes(keyword)) return 'complex';
  }
  
  for (const keyword of COMPLEXITY_KEYWORDS.simple) {
    if (lowerText.includes(keyword)) return 'simple';
  }
  
  return 'medium';
}

/**
 * Extract dependencies from description
 */
function extractDependencies(text: string): string[] {
  const dependencies: string[] = [];
  const lowerText = text.toLowerCase();
  
  for (const keyword of DEPENDENCY_KEYWORDS) {
    const index = lowerText.indexOf(keyword);
    if (index !== -1) {
      // Extract text after the keyword until end of sentence or comma
      const afterKeyword = text.substring(index + keyword.length).trim();
      const match = afterKeyword.match(/^[^.,\n]+/);
      if (match) {
        dependencies.push(match[0].trim());
      }
    }
  }
  
  return dependencies;
}

/**
 * Check if task is a blocker
 */
function isBlocker(text: string): boolean {
  const lowerText = text.toLowerCase();
  return BLOCKER_KEYWORDS.some(keyword => lowerText.includes(keyword));
}

/**
 * Check for external dependencies
 */
function hasExternalDependency(text: string): boolean {
  const lowerText = text.toLowerCase();
  const externalKeywords = ['waiting for', 'pending', 'external', 'client', 'vendor', 'third party', 'approval needed'];
  return externalKeywords.some(keyword => lowerText.includes(keyword));
}

/**
 * Clean description by removing parsed metadata
 */
function cleanDescription(text: string, matchedTime: string | null): string {
  let clean = text;
  
  // Remove time patterns
  if (matchedTime) {
    clean = clean.replace(matchedTime, '').trim();
  }
  
  // Remove date patterns
  for (const { pattern } of DATE_PATTERNS) {
    clean = clean.replace(pattern, '').trim();
  }
  
  // Remove empty parentheses and brackets
  clean = clean.replace(/\(\s*\)/g, '').replace(/\[\s*\]/g, '').trim();
  
  // Clean up extra whitespace and punctuation
  clean = clean.replace(/\s+/g, ' ').replace(/^\s*[-|:]\s*/, '').trim();
  
  return clean;
}

/**
 * Extract keywords from description
 */
function extractKeywords(text: string): string[] {
  const keywords: string[] = [];
  const lowerText = text.toLowerCase();
  
  // Check all task type keywords
  for (const typeKeywords of Object.values(TASK_TYPE_KEYWORDS)) {
    for (const keyword of typeKeywords) {
      if (lowerText.includes(keyword)) {
        keywords.push(keyword);
      }
    }
  }
  
  // Check blocker keywords
  for (const keyword of BLOCKER_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      keywords.push(keyword);
    }
  }
  
  return Array.from(new Set(keywords)); // Remove duplicates
}

/**
 * Main parsing function
 */
export function parseAPTLSSItem(
  itemName: string,
  cardDueDate?: string,
  cardLabels?: string[]
): ParsedTask {
  // Parse time duration
  const { hours: parsedHours, confidence: durationConfidence, matched: matchedTime } = parseTimeDuration(itemName);
  
  // Detect task type
  const taskType = detectTaskType(itemName);
  
  // Determine final duration
  let durationHours: number;
  let finalConfidence = durationConfidence;
  
  if (parsedHours > 0) {
    durationHours = parsedHours;
  } else {
    // Use default based on task type
    durationHours = DEFAULT_DURATIONS[taskType];
    finalConfidence = 'low';
    
    // Adjust based on complexity
    const complexity = detectComplexity(itemName);
    if (complexity === 'complex') {
      durationHours *= 1.5;
    } else if (complexity === 'simple') {
      durationHours *= 0.75;
    }
  }
  
  // Parse due date
  const { date: dueDate, source: dateSource } = parseDueDate(itemName, cardDueDate);
  
  // Extract other metadata
  const dependencies = extractDependencies(itemName);
  const blocker = isBlocker(itemName);
  const externalDep = hasExternalDependency(itemName);
  const complexity = detectComplexity(itemName);
  const keywords = extractKeywords(itemName);
  const cleanDesc = cleanDescription(itemName, matchedTime);
  
  return {
    description: itemName,
    cleanDescription: cleanDesc,
    durationHours: Math.round(durationHours * 100) / 100, // Round to 2 decimal places
    durationConfidence: finalConfidence,
    dueDate,
    dateSource,
    taskType,
    dependencies,
    isBlocker: blocker,
    hasExternalDependency: externalDep,
    complexity,
    keywords,
  };
}

/**
 * Parse multiple APTLSS items with context awareness
 */
export function parseAPTLSSChecklist(
  items: Array<{ name: string; state: string; id: string }>,
  cardDueDate?: string,
  cardLabels?: string[]
): Array<ParsedTask & { originalItem: typeof items[0] }> {
  return items.map((item, index) => {
    const parsed = parseAPTLSSItem(item.name, cardDueDate, cardLabels);
    
    // Add context from previous items for dependency detection
    if (index > 0) {
      const prevItem = items[index - 1];
      // If this item starts with "then" or similar, it depends on previous
      if (/^(then|next|after that|following)/i.test(item.name)) {
        parsed.dependencies.push(prevItem.name.substring(0, 50));
      }
    }
    
    return {
      ...parsed,
      originalItem: item,
    };
  });
}
