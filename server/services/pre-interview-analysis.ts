/**
 * Pre-Interview Analysis Service
 * 
 * Analyzes Trello card content BEFORE interviewing the user to:
 * 1. Extract evidence (attachments, comments, descriptions)
 * 2. Identify people, amounts, dates, urgency
 * 3. Generate smart questions based on gaps
 * 4. Pre-fill likely answers to minimize user input
 */

export interface CardEvidence {
  attachments: {
    pdfs: Array<{ name: string; url: string }>;
    spreadsheets: Array<{ name: string; url: string }>;
    videos: Array<{ name: string; url: string }>;
    images: Array<{ name: string; url: string }>;
    other: Array<{ name: string; url: string }>;
  };
  people: Array<{ name: string; role?: string; source: string }>;
  amounts: Array<{ amount: number; currency: string; context: string; source: string }>;
  dates: Array<{ date: string; type: 'deadline' | 'mentioned' | 'event'; context: string }>;
  urgencySignals: Array<{ signal: string; source: string }>;
  keywords: string[];
  existingChecklists: Array<{ name: string; items: number }>;
}

export interface PreAnalysisResult {
  evidence: CardEvidence;
  proposedGoal: string;
  successCriteria: string[];
  identifiedGaps: Array<{
    question: string;
    context: string;
    priority: 'critical' | 'important' | 'nice-to-have';
  }>;
  confidence: number; // 0-100
  summary: string;
}

/**
 * Extract people mentioned in text
 */
function extractPeople(text: string): Array<{ name: string; source: string }> {
  const people: Array<{ name: string; source: string }> = [];
  
  // Pattern: @name or "Name" or Name (capitalized)
  const patterns = [
    /@(\w+)/g, // @mentions
    /"([A-Z][a-z]+ [A-Z][a-z]+)"/g, // "First Last"
    /\b([A-Z][a-z]+)\s+\((?:VA|worker|student|lawyer|counsel)\)/gi, // Name (role)
  ];
  
  patterns.forEach(pattern => {
    const matches = Array.from(text.matchAll(pattern));
    for (const match of matches) {
      const name = match[1];
      if (name && name.length > 2) {
        people.push({ name, source: match[0] });
      }
    }
  });
  
  return people;
}

/**
 * Extract money amounts from text
 */
function extractAmounts(text: string): Array<{ amount: number; currency: string; context: string; source: string }> {
  const amounts: Array<{ amount: number; currency: string; context: string; source: string }> = [];
  
  // Patterns: €12,450 or $1,234.56 or 1000 EUR
  const patterns = [
    /€\s?(\d{1,3}(?:[,\.]\d{3})*(?:[,\.]\d{2})?)/g,
    /\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,
    /(\d{1,3}(?:[,\.]\d{3})*(?:[,\.]\d{2})?)\s?(EUR|USD|GBP)/gi,
  ];
  
  patterns.forEach(pattern => {
    const matches = Array.from(text.matchAll(pattern));
    for (const match of matches) {
      const amountStr = match[1].replace(/[,\.]/g, '');
      const amount = parseInt(amountStr, 10);
      const currency = match[0].includes('€') ? 'EUR' : match[0].includes('$') ? 'USD' : match[2] || 'EUR';
      
      // Get context (20 chars before and after)
      const index = text.indexOf(match[0]);
      const context = text.substring(Math.max(0, index - 20), Math.min(text.length, index + match[0].length + 20));
      
      amounts.push({ amount, currency, context, source: match[0] });
    }
  });
  
  return amounts;
}

/**
 * Extract dates from text
 */
function extractDates(text: string): Array<{ date: string; type: 'deadline' | 'mentioned' | 'event'; context: string }> {
  const dates: Array<{ date: string; type: 'deadline' | 'mentioned' | 'event'; context: string }> = [];
  
  // Patterns: YYYY-MM-DD, DD/MM/YYYY, "by Jan 15", "deadline: ..."
  const patterns = [
    /(\d{4}-\d{2}-\d{2})/g, // ISO date
    /(\d{1,2}\/\d{1,2}\/\d{4})/g, // DD/MM/YYYY
    /(deadline|due|by)\s*:?\s*(\d{1,2}\s+\w+\s+\d{4})/gi, // deadline: 15 Jan 2025
  ];
  
  patterns.forEach(pattern => {
    const matches = Array.from(text.matchAll(pattern));
    for (const match of matches) {
      const dateStr = match[1] || match[2];
      const type = match[0].toLowerCase().includes('deadline') || match[0].toLowerCase().includes('due') ? 'deadline' : 'mentioned';
      
      const index = text.indexOf(match[0]);
      const context = text.substring(Math.max(0, index - 20), Math.min(text.length, index + match[0].length + 20));
      
      dates.push({ date: dateStr, type, context });
    }
  });
  
  return dates;
}

/**
 * Detect urgency signals in text
 */
function detectUrgency(text: string): Array<{ signal: string; source: string }> {
  const signals: Array<{ signal: string; source: string }> = [];
  
  const urgencyKeywords = [
    'urgent', 'asap', 'critical', 'emergency', 'immediately', 
    'high priority', 'drop everything', 'time-sensitive'
  ];
  
  const lowerText = text.toLowerCase();
  urgencyKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) {
      const index = lowerText.indexOf(keyword);
      const source = text.substring(Math.max(0, index - 10), Math.min(text.length, index + keyword.length + 10));
      signals.push({ signal: keyword, source });
    }
  });
  
  return signals;
}

/**
 * Analyze Trello card before interview
 */
export async function analyzeCardBeforeInterview(card: any): Promise<PreAnalysisResult> {
  // Combine all text content
  const allText = [
    card.name || '',
    card.desc || '',
    ...(card.comments || []).map((c: any) => c.data?.text || ''),
  ].join('\n');
  
  // Extract evidence
  const evidence: CardEvidence = {
    attachments: {
      pdfs: (card.attachments || []).filter((a: any) => a.name.toLowerCase().endsWith('.pdf')),
      spreadsheets: (card.attachments || []).filter((a: any) => 
        a.name.toLowerCase().endsWith('.xlsx') || a.name.toLowerCase().endsWith('.xls') || a.name.toLowerCase().endsWith('.csv')
      ),
      videos: (card.attachments || []).filter((a: any) => 
        a.name.toLowerCase().endsWith('.mp4') || a.name.toLowerCase().endsWith('.mov') || a.name.toLowerCase().endsWith('.avi')
      ),
      images: (card.attachments || []).filter((a: any) => 
        a.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/)
      ),
      other: (card.attachments || []).filter((a: any) => 
        !a.name.toLowerCase().match(/\.(pdf|xlsx?|csv|mp4|mov|avi|jpe?g|png|gif|webp)$/)
      ),
    },
    people: extractPeople(allText),
    amounts: extractAmounts(allText),
    dates: extractDates(allText),
    urgencySignals: detectUrgency(allText),
    keywords: extractKeywords(allText),
    existingChecklists: (card.checklists || []).map((cl: any) => ({
      name: cl.name,
      items: cl.checkItems?.length || 0,
    })),
  };
  
  // Identify gaps
  const gaps: Array<{ question: string; context: string; priority: 'critical' | 'important' | 'nice-to-have' }> = [];
  
  // Check for missing deadline
  if (evidence.urgencySignals.length > 0 && evidence.dates.filter(d => d.type === 'deadline').length === 0) {
    gaps.push({
      question: "What is the specific deadline?",
      context: `I see urgency signals (${evidence.urgencySignals.map(s => s.signal).join(', ')}) but no explicit deadline`,
      priority: 'critical',
    });
  }
  
  // Check for scattered evidence
  if (evidence.attachments.videos.length > 3) {
    gaps.push({
      question: "Where should the video evidence be organized?",
      context: `I found ${evidence.attachments.videos.length} video files that need organizing`,
      priority: 'important',
    });
  }
  
  // Check for unclear next steps
  if (evidence.people.length > 2) {
    gaps.push({
      question: "Who is responsible for what?",
      context: `Multiple people mentioned (${evidence.people.map(p => p.name).join(', ')}) - need to clarify roles`,
      priority: 'important',
    });
  }
  
  // Generate proposed goal (will be enhanced by AI in next step)
  const proposedGoal = generateProposedGoal(card, evidence);
  
  // Generate summary
  const summary = generateSummary(evidence);
  
  // Calculate confidence
  const confidence = calculateConfidence(evidence, gaps);
  
  return {
    evidence,
    proposedGoal,
    successCriteria: [], // Will be filled by AI
    identifiedGaps: gaps,
    confidence,
    summary,
  };
}

/**
 * Extract keywords from text
 */
function extractKeywords(text: string): string[] {
  const keywords: string[] = [];
  
  // Common task-related keywords
  const taskKeywords = [
    'letter', 'email', 'call', 'meeting', 'review', 'draft', 'send', 'payment',
    'legal', 'contract', 'agreement', 'dispute', 'claim', 'evidence', 'document'
  ];
  
  const lowerText = text.toLowerCase();
  taskKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) {
      keywords.push(keyword);
    }
  });
  
  return Array.from(new Set(keywords)); // Remove duplicates
}

/**
 * Generate proposed goal based on evidence
 */
function generateProposedGoal(card: any, evidence: CardEvidence): string {
  // Start with card name
  let goal = card.name || 'Complete task';
  
  // Add financial context if found
  if (evidence.amounts.length > 0) {
    const mainAmount = evidence.amounts[0];
    goal += ` (${mainAmount.currency} ${mainAmount.amount.toLocaleString()})`;
  }
  
  // Add urgency if found
  if (evidence.urgencySignals.length > 0) {
    goal = `[URGENT] ${goal}`;
  }
  
  return goal;
}

/**
 * Generate summary of findings
 */
function generateSummary(evidence: CardEvidence): string {
  const parts: string[] = [];
  
  // Attachments
  const totalAttachments = 
    evidence.attachments.pdfs.length +
    evidence.attachments.spreadsheets.length +
    evidence.attachments.videos.length +
    evidence.attachments.images.length +
    evidence.attachments.other.length;
  
  if (totalAttachments > 0) {
    const breakdown: string[] = [];
    if (evidence.attachments.videos.length > 0) breakdown.push(`${evidence.attachments.videos.length} videos`);
    if (evidence.attachments.pdfs.length > 0) breakdown.push(`${evidence.attachments.pdfs.length} PDFs`);
    if (evidence.attachments.spreadsheets.length > 0) breakdown.push(`${evidence.attachments.spreadsheets.length} spreadsheets`);
    if (evidence.attachments.images.length > 0) breakdown.push(`${evidence.attachments.images.length} images`);
    
    parts.push(`Found ${totalAttachments} attachments: ${breakdown.join(', ')}`);
  }
  
  // People
  if (evidence.people.length > 0) {
    const uniquePeople = Array.from(new Set(evidence.people.map(p => p.name)));
    parts.push(`People mentioned: ${uniquePeople.join(', ')}`);
  }
  
  // Amounts
  if (evidence.amounts.length > 0) {
    const mainAmount = evidence.amounts[0];
    parts.push(`Financial: ${mainAmount.currency} ${mainAmount.amount.toLocaleString()}`);
  }
  
  // Urgency
  if (evidence.urgencySignals.length > 0) {
    parts.push(`Priority: ${evidence.urgencySignals[0].signal.toUpperCase()}`);
  }
  
  // Existing checklists
  if (evidence.existingChecklists.length > 0) {
    parts.push(`Existing checklists: ${evidence.existingChecklists.map(c => c.name).join(', ')}`);
  }
  
  return parts.join(' • ');
}

/**
 * Calculate confidence score
 */
function calculateConfidence(evidence: CardEvidence, gaps: any[]): number {
  let score = 50; // Base score
  
  // Increase confidence for evidence found
  if (evidence.amounts.length > 0) score += 10;
  if (evidence.people.length > 0) score += 10;
  if (evidence.dates.length > 0) score += 10;
  if (evidence.keywords.length > 3) score += 10;
  
  // Decrease confidence for gaps
  const criticalGaps = gaps.filter(g => g.priority === 'critical').length;
  const importantGaps = gaps.filter(g => g.priority === 'important').length;
  
  score -= criticalGaps * 15;
  score -= importantGaps * 10;
  
  return Math.max(0, Math.min(100, score));
}
