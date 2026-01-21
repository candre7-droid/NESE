import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT_PART_1, SYSTEM_PROMPT_PART_2 } from "../constants";

export class GeminiService {
  private getApiKey(): string {
    try {
      // Intentem obtenir la clau tant de process.env com del polyfill de window
      if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
        return process.env.API_KEY;
      }
      if (typeof window !== 'undefined' && (window as any).process?.env?.API_KEY) {
        return (window as any).process.env.API_KEY;
      }
    } catch (e) {
      console.warn("No s'ha pogut recuperar l'API_KEY de l'entorn");
    }
    return "";
  }

  async generateConclusions(input: string, selectedBlocks: number[], level?: string): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) return "Error: API_KEY no configurada correctament a Vercel.";
    
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
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_PROMPT_PART_1,
          temperature: 0.7,
        },
      });

      return response.text || "No s'ha obtingut resposta de la IA.";
    } catch (err: any) {
      console.error("Error Gemini:", err);
      return `Error en la generació: ${err.message || 'Error desconegut'}`;
    }
  }

  async generateOrientations(conclusions: string, level?: string): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) return "Error: API_KEY no configurada.";
    
    const ai = new GoogleGenAI({ apiKey });
    const levelContext = level ? `Nota: L'alumne és de nivell ${level}.` : '';
    const prompt = `${levelContext}\n\nBasant-te en les següents conclusions de l'apartat 1, redacta l'apartat 2 d'orientacions:\n\n${conclusions}`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_PROMPT_PART_2,
          temperature: 0.7,
        },
      });

      return response.text || "No s'ha obtingut resposta de la IA.";
    } catch (err: any) {
      console.error("Error Gemini:", err);
      return `Error en la generació: ${err.message || 'Error desconegut'}`;
    }
  }
}

export const geminiService = new GeminiService();