import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT_PART_1, SYSTEM_PROMPT_PART_2 } from "../constants";

export class GeminiService {
  private getApiKey(): string {
    try {
      // @ts-ignore
      return process.env.API_KEY || (window as any).process?.env?.API_KEY || "";
    } catch (e) {
      return "";
    }
  }

  async generateConclusions(input: string, selectedBlocks: number[], level?: string): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) throw new Error("API_KEY no configurada correctament.");
    
    const ai = new GoogleGenAI({ apiKey });
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
    } catch (err: any) {
      console.error("Error Gemini Apartat 1:", err);
      if (err.message?.includes('429')) {
        throw new Error("S'ha superat el límit de quota gratuïta. Espera un minut.");
      }
      throw err;
    }
  }

  async generateOrientations(conclusions: string, level?: string): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) throw new Error("API_KEY no trobada.");

    const ai = new GoogleGenAI({ apiKey });
    const levelContext = level ? `Nota: L'alumne és de nivell ${level}.` : '';
    const prompt = `${levelContext}\n\nBasant-te en les següents conclusions de l'apartat 1, redacta l'apartat 2 d'orientacions:\n\n${conclusions}`;

    try {
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
    } catch (err: any) {
      console.error("Error Gemini Apartat 2:", err);
      throw err;
    }
  }
}

export const geminiService = new GeminiService();