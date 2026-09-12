import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Gemini AI Service
 * Powered by Google Gemini 2.8 Flash for adaptive hint generation,
 * deceptive sabotage insights, and automated post-game mistake analysis.
 *
 * Designed to be zero-impact and safe: if no API key is set or the service is unreachable,
 * it seamlessly falls back to deterministic AST & heuristic models without throwing errors.
 */

export class GeminiService {
  private static apiKey = env.GEMINI_API_KEY;
  private static model = env.GEMINI_MODEL || 'gemini-2.8-flash';

  public static isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0 && this.apiKey !== 'your-gemini-api-key-here');
  }

  public static getModelName(): string {
    return this.model;
  }

  /**
   * Generates a contextual deceptive hint or code explanation using Gemini 2.0 Flash.
   * Gracefully returns null if Gemini is unconfigured or unavailable.
   */
  public static async generateInsight(topic: string, userCodeSnippet?: string): Promise<{
    statement: string;
    explanation: string;
    isCorrect: boolean;
  } | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
      const prompt = `You are an AI game engine generating a subtle programming challenge or misconception for a coding deception game.
Topic: ${topic}
${userCodeSnippet ? `Current Code:\n${userCodeSnippet}` : ''}
Generate a JSON response with:
- "statement": A believable statement about this algorithm or code that sounds expert but is either subtly true or deceptively false.
- "isCorrect": boolean (true if accurate, false if deceptive/buggy).
- "explanation": Short explanation why it is true or false.
Return ONLY valid JSON.`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 300,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        logger.warn(`[GeminiService] API returned status ${response.status}. Falling back to default heuristics.`);
        return null;
      }

      const data: any = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) return null;

      const parsed = JSON.parse(rawText);
      return {
        statement: parsed.statement,
        explanation: parsed.explanation,
        isCorrect: Boolean(parsed.isCorrect),
      };
    } catch (err: any) {
      logger.warn(`[GeminiService] Safe fallback activated: ${err?.message || 'Unknown error'}`);
      return null;
    }
  }
}

// Log status on startup (informative only)
if (GeminiService.isConfigured()) {
  logger.info(`[AI Engine] Google Gemini integrated successfully (Model: ${GeminiService.getModelName()})`);
} else {
  logger.info('[AI Engine] Running with local heuristic engine (Set GEMINI_API_KEY to activate Gemini 2.8 Flash live generation)');
}
