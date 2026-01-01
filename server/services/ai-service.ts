/**
 * AI Service - Provides intelligent responses using latest Q4 2025 open-source models
 * 
 * Supported Providers:
 * - Groq (free tier) - Llama 3.3, Qwen 3
 * - Together.ai (free tier) - DeepSeek V3.2, DeepSeek V3.2 Speciale
 * - OpenRouter - Access to multiple models
 * - Ollama (self-hosted) - Any open-source model locally
 */

import { getDb } from '../db';

// AI Provider types - expanded for Q4 2025 models
export type AIProvider = 'groq' | 'together' | 'openrouter' | 'ollama';

// Available models per provider (Q4 2025)
export const AVAILABLE_MODELS = {
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', description: 'Latest Meta model, excellent all-around', released: 'Dec 2024' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', description: 'Fast, lightweight model', released: 'Jul 2024' },
    { id: 'qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', description: 'Strong multilingual support', released: 'Nov 2024' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', description: 'Efficient mixture of experts', released: 'Dec 2023' }
  ],
  together: [
    { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek V3.2', description: 'Matches GPT-5, best value (Dec 2025)', released: 'Dec 2025' },
    { id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek R1', description: 'Advanced reasoning model', released: 'Nov 2025' },
    { id: 'Qwen/Qwen2.5-72B-Instruct-Turbo', name: 'Qwen 2.5 72B Turbo', description: 'Fast Qwen variant', released: 'Nov 2024' },
    { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3 70B Turbo', description: 'Optimized Llama 3.3', released: 'Dec 2024' }
  ],
  openrouter: [
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3.2', description: 'Latest DeepSeek via OpenRouter', released: 'Dec 2025' },
    { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', description: 'Alibaba\'s latest', released: 'Nov 2024' },
    { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', description: 'Meta\'s latest open model', released: 'Dec 2024' },
    { id: 'mistralai/mistral-large-2411', name: 'Mistral Large', description: 'Mistral\'s flagship', released: 'Nov 2024' }
  ],
  ollama: [
    { id: 'qwen2.5:72b', name: 'Qwen 2.5 72B', description: 'Full Qwen 2.5 locally', released: 'Nov 2024' },
    { id: 'qwen2.5:32b', name: 'Qwen 2.5 32B', description: 'Balanced Qwen variant', released: 'Nov 2024' },
    { id: 'llama3.3:70b', name: 'Llama 3.3 70B', description: 'Latest Llama locally', released: 'Dec 2024' },
    { id: 'deepseek-v3:latest', name: 'DeepSeek V3', description: 'DeepSeek locally (when available)', released: 'Dec 2025' },
    { id: 'mistral:latest', name: 'Mistral', description: 'Lightweight and fast', released: '2024' }
  ]
} as const;

// Configuration interface
interface AIConfig {
  provider: AIProvider;
  model: string;
  // Provider-specific settings
  groqApiKey?: string;
  togetherApiKey?: string;
  openrouterApiKey?: string;
  ollamaUrl: string;
}

// Default configuration - using DeepSeek V3.2 as default (best free option Dec 2025)
let aiConfig: AIConfig = {
  provider: 'together',
  model: 'deepseek-ai/DeepSeek-V3',
  groqApiKey: process.env.GROQ_API_KEY || '',
  togetherApiKey: process.env.TOGETHER_API_KEY || '',
  openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
  ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434'
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
 * Set the AI provider
 */
export function setAIProvider(provider: AIProvider): void {
  aiConfig.provider = provider;
  // Set default model for the provider
  const models = AVAILABLE_MODELS[provider];
  if (models && models.length > 0) {
    aiConfig.model = models[0].id;
  }
}

/**
 * Set the model for current provider
 */
export function setAIModel(model: string): void {
  aiConfig.model = model;
}

/**
 * Get available models for a provider
 */
export function getAvailableModels(provider?: AIProvider) {
  const p = provider || aiConfig.provider;
  return AVAILABLE_MODELS[p] || [];
}

/**
 * Call Groq API for AI response
 */
async function callGroq(messages: Array<{ role: string; content: string }>): Promise<string> {
  if (!aiConfig.groqApiKey) {
    throw new Error('Groq API key not configured. Get a free key at console.groq.com');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${aiConfig.groqApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: aiConfig.model,
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
 * Call Together.ai API for AI response (DeepSeek V3.2, etc.)
 */
async function callTogether(messages: Array<{ role: string; content: string }>): Promise<string> {
  if (!aiConfig.togetherApiKey) {
    throw new Error('Together.ai API key not configured. Get a free key at api.together.xyz');
  }

  const response = await fetch('https://api.together.xyz/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${aiConfig.togetherApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: aiConfig.model,
      messages,
      temperature: 0.7,
      max_tokens: 500,
      top_p: 1,
      stream: false
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[AI Service] Together.ai API error:', error);
    throw new Error(`Together.ai API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response. Please try again.';
}

/**
 * Call OpenRouter API for AI response
 */
async function callOpenRouter(messages: Array<{ role: string; content: string }>): Promise<string> {
  if (!aiConfig.openrouterApiKey) {
    throw new Error('OpenRouter API key not configured. Get a key at openrouter.ai');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${aiConfig.openrouterApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://va-dashboard.manus.space',
      'X-Title': 'VA Dashboard'
    },
    body: JSON.stringify({
      model: aiConfig.model,
      messages,
      temperature: 0.7,
      max_tokens: 500,
      top_p: 1
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[AI Service] OpenRouter API error:', error);
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
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
        model: aiConfig.model,
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

  const providerCalls: Record<AIProvider, () => Promise<string>> = {
    groq: () => callGroq(messages),
    together: () => callTogether(messages),
    openrouter: () => callOpenRouter(messages),
    ollama: () => callOllama(messages)
  };

  // Define fallback order
  const fallbackOrder: AIProvider[] = ['together', 'groq', 'openrouter', 'ollama'];
  const orderedProviders = [aiConfig.provider, ...fallbackOrder.filter(p => p !== aiConfig.provider)];

  for (const provider of orderedProviders) {
    try {
      console.log(`[AI Service] Trying ${provider} with model ${aiConfig.model}...`);
      return await providerCalls[provider]();
    } catch (error) {
      console.error(`[AI Service] ${provider} failed:`, error);
      // Continue to next provider
    }
  }

  // All providers failed
  return `I'm currently unable to process your request due to a technical issue. Please check your AI provider settings or try again later.`;
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
export async function testAIConnection(): Promise<{ success: boolean; provider: AIProvider; model: string; message: string }> {
  const testMessage = 'Hello, please respond with "Connection successful" to confirm you are working.';
  
  try {
    const response = await generateAIResponse(testMessage, 'This is a connection test.');
    return {
      success: true,
      provider: aiConfig.provider,
      model: aiConfig.model,
      message: `${aiConfig.provider} (${aiConfig.model}) is working. Response: ${response.substring(0, 100)}...`
    };
  } catch (error) {
    return {
      success: false,
      provider: aiConfig.provider,
      model: aiConfig.model,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export default {
  getAIConfig,
  setAIConfig,
  setAIProvider,
  setAIModel,
  getAvailableModels,
  generateAIResponse,
  generateCheckInMessage,
  generateQuestionResponse,
  generateStuckGuidance,
  testAIConnection,
  AVAILABLE_MODELS
};
