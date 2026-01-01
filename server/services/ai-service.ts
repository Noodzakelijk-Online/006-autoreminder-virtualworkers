/**
 * AI Service - Provides intelligent responses using Groq (free tier) or Ollama (self-hosted)
 * 
 * This service powers the AI Project Manager bot with:
 * - Context-aware responses to VA questions
 * - Professional PM personality
 * - Support for both cloud (Groq) and self-hosted (Ollama) AI providers
 */

import { getDb } from '../db';

// AI Provider types
export type AIProvider = 'groq' | 'ollama';

// Configuration interface
interface AIConfig {
  provider: AIProvider;
  groqApiKey?: string;
  groqModel: string;
  ollamaUrl: string;
  ollamaModel: string;
}

// Default configuration
let aiConfig: AIConfig = {
  provider: 'groq',
  groqApiKey: process.env.GROQ_API_KEY || '',
  groqModel: 'llama-3.1-8b-instant', // Free tier model
  ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  ollamaModel: 'llama3.1:8b'
};

// Professional PM System Prompt
const PM_SYSTEM_PROMPT = `You are an AI Project Manager assistant embedded in a task management system. Your role is to help virtual assistants (VAs) complete their work efficiently and professionally.

PERSONALITY & TONE:
- Professional but supportive
- Direct and clear in communication
- Encouraging without being patronizing
- Solution-oriented when problems arise
- Respectful of the VA's expertise and time

RESPONSIBILITIES:
1. Answer questions about tasks, priorities, and next steps
2. Provide guidance when VAs are stuck on a step
3. Clarify task requirements based on available context
4. Suggest approaches to complete work efficiently
5. Help break down complex tasks into manageable steps

GUIDELINES:
- Keep responses concise and actionable (2-4 sentences when possible)
- Reference specific task details when available
- If you don't have enough context, ask clarifying questions
- Never make up information - admit when you don't know something
- Focus on helping the VA succeed, not micromanaging

CONTEXT AWARENESS:
You will receive context about the current card including:
- Card title and description
- APTLSS checklist steps and completion status
- Time entries and estimates
- Previous comments and discussions
- Worker profile information

Use this context to provide relevant, personalized responses.`;

/**
 * Get current AI configuration
 */
export function getAIConfig(): AIConfig {
  return { ...aiConfig };
}

/**
 * Update AI configuration
 */
export function setAIConfig(config: Partial<AIConfig>): void {
  aiConfig = { ...aiConfig, ...config };
}

/**
 * Set the AI provider (groq or ollama)
 */
export function setAIProvider(provider: AIProvider): void {
  aiConfig.provider = provider;
}

/**
 * Call Groq API for AI response
 */
async function callGroq(messages: Array<{ role: string; content: string }>): Promise<string> {
  if (!aiConfig.groqApiKey) {
    throw new Error('Groq API key not configured. Please add GROQ_API_KEY to your environment or configure it in settings.');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${aiConfig.groqApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: aiConfig.groqModel,
      messages,
      temperature: 0.7,
      max_tokens: 500,
      top_p: 1,
      stream: false
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[AI Service] Groq API error:', error);
    throw new Error(`Groq API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response. Please try again.';
}

/**
 * Call Ollama API for AI response (self-hosted)
 */
async function callOllama(messages: Array<{ role: string; content: string }>): Promise<string> {
  try {
    const response = await fetch(`${aiConfig.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: aiConfig.ollamaModel,
        messages,
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 500
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[AI Service] Ollama API error:', error);
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.message?.content || 'I apologize, but I was unable to generate a response. Please try again.';
  } catch (error) {
    if (error instanceof Error && error.message.includes('fetch')) {
      throw new Error(`Cannot connect to Ollama at ${aiConfig.ollamaUrl}. Make sure Ollama is running.`);
    }
    throw error;
  }
}

/**
 * Generate AI response with automatic fallback
 */
export async function generateAIResponse(
  userMessage: string,
  context: string
): Promise<string> {
  const messages = [
    { role: 'system', content: PM_SYSTEM_PROMPT },
    { role: 'system', content: `CURRENT CONTEXT:\n${context}` },
    { role: 'user', content: userMessage }
  ];

  try {
    if (aiConfig.provider === 'groq') {
      return await callGroq(messages);
    } else {
      return await callOllama(messages);
    }
  } catch (error) {
    console.error(`[AI Service] ${aiConfig.provider} failed:`, error);
    
    // Try fallback to other provider
    const fallbackProvider = aiConfig.provider === 'groq' ? 'ollama' : 'groq';
    console.log(`[AI Service] Attempting fallback to ${fallbackProvider}...`);
    
    try {
      if (fallbackProvider === 'groq') {
        return await callGroq(messages);
      } else {
        return await callOllama(messages);
      }
    } catch (fallbackError) {
      console.error(`[AI Service] Fallback to ${fallbackProvider} also failed:`, fallbackError);
      
      // Return a helpful error message
      return `I'm currently unable to process your request due to a technical issue. Please try again in a moment, or contact support if the problem persists.\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}

/**
 * Generate a proactive check-in message
 */
export async function generateCheckInMessage(
  workerName: string,
  cardTitle: string,
  context: string,
  isOverdue: boolean
): Promise<string> {
  const prompt = isOverdue
    ? `Generate a polite but direct check-in message for ${workerName} about the task "${cardTitle}". They haven't provided an update after the expected time. Ask about their progress and if they need any help. Keep it professional and non-accusatory.`
    : `Generate a friendly check-in message for ${workerName} about the task "${cardTitle}". Ask how things are going and if they need any assistance. Keep it brief and supportive.`;

  return generateAIResponse(prompt, context);
}

/**
 * Generate a response to a VA's question
 */
export async function generateQuestionResponse(
  question: string,
  context: string
): Promise<string> {
  return generateAIResponse(question, context);
}

/**
 * Generate guidance when VA is stuck
 */
export async function generateStuckGuidance(
  stepDescription: string,
  context: string
): Promise<string> {
  const prompt = `The VA is stuck on this step: "${stepDescription}". Provide helpful guidance on how to approach or complete this step. Be specific and actionable.`;
  return generateAIResponse(prompt, context);
}

/**
 * Test AI connection
 */
export async function testAIConnection(): Promise<{ success: boolean; provider: AIProvider; message: string }> {
  const testMessage = 'Hello, please respond with "Connection successful" to confirm you are working.';
  
  try {
    const response = await generateAIResponse(testMessage, 'This is a connection test.');
    return {
      success: true,
      provider: aiConfig.provider,
      message: `${aiConfig.provider} is working. Response: ${response.substring(0, 100)}...`
    };
  } catch (error) {
    return {
      success: false,
      provider: aiConfig.provider,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export default {
  getAIConfig,
  setAIConfig,
  setAIProvider,
  generateAIResponse,
  generateCheckInMessage,
  generateQuestionResponse,
  generateStuckGuidance,
  testAIConnection
};
