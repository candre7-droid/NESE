
import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT_PART_1, SYSTEM_PROMPT_PART_2 } from "../constants";

export class GeminiService {
  private ai: GoogleGenAI | null = null;

  constructor() {
    this.initAI();
  }

  private initAI() {
    try {
      // Accedim de forma ultra-segura a la clau
      const env = (typeof process !== 'undefined' && process.env) ? process.env : {};
      const apiKey = (env as any).API_KEY || '';
      
      if (!apiKey) {
        console.warn("GeminiService: No s'ha trobat l'API_KEY a les variables d'entorn.");
      }
      
      this.ai = new GoogleGenAI({ apiKey });
    } catch (e) {
      console.error("GeminiService: Error inicialitzant la IA", e);
    }
  }

  async generateConclusions(input: string, selectedBlocks: number[], level?: string): Promise<string> {
    if (!this.ai) return "El servei de IA no està configurat correctament.";
    
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
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_PROMPT_PART_1,
          temperature: 0.7,
        },
      });

      return response.text || "La IA no ha pogut generar cap resposta.";
    } catch (err: any) {
      console.error("Error Gemini:", err);
      return `Error en la generació: ${err.message || 'Error desconegut'}`;
    }
  }

  async generateOrientations(conclusions: string, level?: string): Promise<string> {
    if (!this.ai) return "El servei de IA no està configurat correctament.";
    
    const levelContext = level ? `Nota: L'alumne és de nivell ${level}.` : '';
    const prompt = `${levelContext}\n\nBasant-te en les següents conclusions de l'apartat 1, redacta l'apartat 2 d'orientacions:\n\n${conclusions}`;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_PROMPT_PART_2,
          temperature: 0.7,
        },
      });

      return response.text || "La IA no ha pogut generar cap resposta.";
    } catch (err: any) {
      console.error("Error Gemini:", err);
      return `Error en la generació: ${err.message || 'Error desconegut'}`;
    }
  }
}

export const geminiService = new GeminiService();
