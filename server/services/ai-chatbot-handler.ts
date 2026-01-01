/**
 * AI-Powered Chatbot Handler
 * 
 * Handles natural language queries from VAs using AI to generate
 * intelligent, context-aware responses with a professional PM personality.
 */

import { generateAIResponse, generateCheckInMessage, generateStuckGuidance } from './ai-service';
import { aggregateCardContext, formatContextForAI } from './context-aggregator';
import { BotCommand, BotResponse, postTrelloComment } from './trello-chatbot';

/**
 * Check if a message is a natural language query (not a command)
 */
export function isNaturalLanguageQuery(text: string): boolean {
  // Remove @bot prefix
  const cleanText = text.replace(/@bot\s*/i, '').trim();
  
  // Known commands that should NOT be treated as natural language
  const commands = ['status', 'checkin', 'check', 'update', 'remind', 'reminder', 
                    'ping', 'time', 'timer', 'hours', 'progress', 'report', 'help', '?'];
  
  const firstWord = cleanText.split(/\s+/)[0]?.toLowerCase();
  
  // If it starts with a known command, it's not a natural language query
  if (commands.includes(firstWord)) {
    return false;
  }
  
  // If it's a question or longer text, treat as natural language
  if (cleanText.includes('?') || cleanText.split(/\s+/).length > 2) {
    return true;
  }
  
  return false;
}

/**
 * Detect if the VA is asking for help because they're stuck
 */
export function isStuckQuery(text: string): boolean {
  const stuckIndicators = [
    'stuck', 'help', 'confused', 'don\'t understand', 'not sure',
    'how do i', 'how can i', 'what should i', 'where do i',
    'can\'t figure', 'having trouble', 'problem with', 'issue with',
    'blocked', 'can\'t proceed', 'unable to'
  ];
  
  const lowerText = text.toLowerCase();
  return stuckIndicators.some(indicator => lowerText.includes(indicator));
}

/**
 * Extract the step reference from a stuck query
 */
export function extractStepReference(text: string, context: string): string | null {
  // Look for step numbers like "step 3", "step three", "#3"
  const stepMatch = text.match(/step\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/i);
  if (stepMatch) {
    return stepMatch[0];
  }
  
  // Look for quoted text that might reference a step
  const quotedMatch = text.match(/"([^"]+)"|'([^']+)'/);
  if (quotedMatch) {
    return quotedMatch[1] || quotedMatch[2];
  }
  
  return null;
}

/**
 * Handle a natural language query from a VA
 */
export async function handleNaturalLanguageQuery(
  cmd: BotCommand,
  vaId?: number
): Promise<BotResponse> {
  console.log(`[AI Chatbot] Processing natural language query from ${cmd.authorName}`);
  
  try {
    // Get full card context
    const context = await aggregateCardContext(cmd.cardId, vaId);
    const contextString = formatContextForAI(context);
    
    // Get the query text (remove @bot prefix)
    const query = cmd.rawArgs || cmd.args.join(' ');
    
    // Check if they're stuck and need specific guidance
    if (isStuckQuery(query)) {
      const stepRef = extractStepReference(query, contextString);
      if (stepRef) {
        console.log(`[AI Chatbot] Detected stuck query about: ${stepRef}`);
        const response = await generateStuckGuidance(stepRef, contextString);
        return {
          text: `🤝 **Here to help!**\n\n${response}`,
        };
      }
    }
    
    // Generate AI response
    const aiResponse = await generateAIResponse(query, contextString);
    
    return {
      text: `💬 ${aiResponse}`,
    };
  } catch (error) {
    console.error('[AI Chatbot] Error generating response:', error);
    return {
      text: `I apologize, but I'm having trouble processing your request right now. Please try again in a moment, or use **@bot help** to see available commands.`,
    };
  }
}

/**
 * Generate a proactive check-in message for a worker
 */
export async function generateProactiveCheckIn(
  cardId: string,
  workerName: string,
  isOverdue: boolean,
  vaId?: number
): Promise<string> {
  try {
    // Get full card context
    const context = await aggregateCardContext(cardId, vaId);
    const contextString = formatContextForAI(context);
    
    // Generate AI check-in message
    const message = await generateCheckInMessage(
      workerName,
      context.cardTitle,
      contextString,
      isOverdue
    );
    
    return message;
  } catch (error) {
    console.error('[AI Chatbot] Error generating check-in:', error);
    
    // Fallback to a simple message
    if (isOverdue) {
      return `Hi ${workerName}! 👋 I noticed we haven't received an update on "${cardId}" yet. How are things going? Let me know if you need any help!`;
    }
    return `Hi ${workerName}! 👋 Just checking in on your progress. How's everything going with this task?`;
  }
}

/**
 * Send a proactive check-in to a Trello card
 */
export async function sendProactiveCheckIn(
  cardId: string,
  workerName: string,
  isOverdue: boolean,
  vaId?: number
): Promise<boolean> {
  const message = await generateProactiveCheckIn(cardId, workerName, isOverdue, vaId);
  
  const formattedMessage = isOverdue
    ? `⏰ **Follow-up Check-in**\n\n@${workerName} ${message}`
    : `👋 **Check-in**\n\n@${workerName} ${message}`;
  
  return postTrelloComment(cardId, formattedMessage);
}

/**
 * Handle common VA questions with AI
 */
export async function handleCommonQuestions(
  question: string,
  cardId: string,
  vaId?: number
): Promise<string> {
  const context = await aggregateCardContext(cardId, vaId);
  const contextString = formatContextForAI(context);
  
  // Common question patterns and enhanced prompts
  const questionPatterns: Array<{ pattern: RegExp; enhancedPrompt: string }> = [
    {
      pattern: /what.*(should|can|do).*(next|now|first)/i,
      enhancedPrompt: 'The VA is asking what they should work on next. Based on the checklist, identify the next incomplete step and explain what needs to be done.'
    },
    {
      pattern: /how.*(long|much time)/i,
      enhancedPrompt: 'The VA is asking about time estimates. Based on the progress and time tracking data, provide an estimate of remaining time.'
    },
    {
      pattern: /when.*(due|deadline|finish)/i,
      enhancedPrompt: 'The VA is asking about deadlines. Check the due date and provide information about timing.'
    },
    {
      pattern: /who.*(contact|ask|help)/i,
      enhancedPrompt: 'The VA is asking who to contact for help. Provide guidance based on the task context.'
    },
    {
      pattern: /where.*(find|get|access)/i,
      enhancedPrompt: 'The VA is asking where to find something. Help them locate resources based on the card description and context.'
    }
  ];
  
  // Find matching pattern
  let prompt = question;
  for (const { pattern, enhancedPrompt } of questionPatterns) {
    if (pattern.test(question)) {
      prompt = `${enhancedPrompt}\n\nOriginal question: "${question}"`;
      break;
    }
  }
  
  return generateAIResponse(prompt, contextString);
}

export default {
  isNaturalLanguageQuery,
  isStuckQuery,
  handleNaturalLanguageQuery,
  generateProactiveCheckIn,
  sendProactiveCheckIn,
  handleCommonQuestions
};
