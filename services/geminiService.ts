import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT_PART_1, SYSTEM_PROMPT_PART_2 } from "../constants";

export class GeminiService {
  private async withRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 1000): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (err: any) {
        lastError = err;
        const status = err.status || (err.message?.includes('503') ? 503 : err.message?.includes('429') ? 429 : 0);
        
        // Només reintentem si és un error de servidor (503) o de quota (429)
        if (status === 503 || status === 429) {
          const delay = baseDelay * Math.pow(2, i);
          console.warn(`Gemini API ocupada (${status}). Reintentant en ${delay}ms... (Intent ${i + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }

  async generateConclusions(input: string, selectedBlocks: number[], level?: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const blocksText = selectedBlocks.join(", ");
    const levelContext = level ? `L'alumne es troba al nivell de: ${level}.` : '';
    const prompt = `CONTEXT DE L'ALUMNE:
${levelContext}

INFORMACIÓ PROPORCIONADA:
${input}

INSTRUCCIÓ:
L'usuari ha seleccionat els següents blocs per incloure en l'informe: ${blocksText}. 
Redacta l'apartat 1 de l'informe seguint estrictament les instruccions del teu rol.`;

    try {
      return await this.withRetry(async () => {
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt,
          config: {
            systemInstruction: SYSTEM_PROMPT_PART_1,
            temperature: 0.7,
          },
        });

        const text = response.text;
        if (!text) throw new Error("La IA ha retornat una resposta buida.");
        return text;
      });
    } catch (err: any) {
      console.error("Error Gemini Apartat 1:", err);
      if (err.message?.includes('503')) {
        throw new Error("El servidor de Google està saturat en aquests moments. Si us plau, torna-ho a intentar en uns segons.");
      }
      throw new Error(`Error de connexió amb la IA: ${err.message || 'Error desconegut'}`);
    }
  }

  async generateOrientations(conclusions: string, level?: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const levelContext = level ? `Nota: L'alumne és de nivell ${level}.` : '';
    const prompt = `${levelContext}\n\nBasant-te en les següents conclusions de l'apartat 1, redacta l'apartat 2 d'orientacions:\n\n${conclusions}`;

    try {
      return await this.withRetry(async () => {
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt,
          config: {
            systemInstruction: SYSTEM_PROMPT_PART_2,
            temperature: 0.7,
          },
        });

        const text = response.text;
        if (!text) throw new Error("La IA no ha generat les orientacions.");
        return text;
      });
    } catch (err: any) {
      console.error("Error Gemini Apartat 2:", err);
      throw new Error(`Error de generació d'orientacions: ${err.message || 'Error desconegut'}`);
    }
  }
}

export const geminiService = new GeminiService();