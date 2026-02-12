
import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT_PART_1, SYSTEM_PROMPT_PART_2, SYSTEM_PROMPT_REFINEMENT, SYSTEM_PROMPT_ASSISTANT } from "../constants";

export class GeminiService {
  private async withRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 1000): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (err: any) {
        lastError = err;
        const status = err.status || (err.message?.includes('503') ? 503 : err.message?.includes('429') ? 429 : 0);
        
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
          model: 'gemini-3-pro-preview',
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
      throw err;
    }
  }

  async generateOrientations(conclusions: string, level?: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const levelContext = level ? `Nota: L'alumne és de nivell ${level}.` : '';
    const prompt = `${levelContext}\n\nBasant-te en les següents conclusions de l'apartat 1, redacta l'apartat 2 d'orientacions:\n\n${conclusions}`;

    try {
      return await this.withRetry(async () => {
        const response = await ai.models.generateContent({
          model: 'gemini-3-pro-preview',
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
      throw err;
    }
  }

  async visionExtractText(imagesBase64: string[]): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const imageParts = imagesBase64.map(base64 => ({
      inlineData: {
        data: base64.split(',')[1],
        mimeType: 'image/jpeg'
      }
    }));

    const prompt = `Ets un expert en transcripció de documents oficials i informes psicopedagògics de Catalunya (EAP).
La teva missió és extreure tot el text d'aquestes imatges amb la màxima precisió possible.

INSTRUCCIONS CRUCIALS:
1. Si hi ha taules de resultats (WISC-V, BAS-II, PROLEC, etc.), transcriu-les de forma clara, mantenint l'ordre de columnes i les puntuacions numèriques (CI, índexs, centils).
2. Transcriu el text de forma literal, sense resumir ni ometre cap detall.
3. Si el document té segells o capçaleres oficials, identifica'ls breument: [Capçalera: Generalitat de Catalunya / Nom del Centre].
4. Separa les pàgines clarament amb '--- Pàgina X ---'.
5. Mantingues l'estructura de paràgrafs i títols.

RECORDA: És un document confidencial i molt important, cada dada numèrica ha de ser exacta.`;

    try {
      return await this.withRetry(async () => {
        // Utilitzem gemini-3-pro-preview per a una anàlisi visual més profunda i precisa
        const response = await ai.models.generateContent({
          model: 'gemini-3-pro-preview',
          contents: { parts: [...imageParts, { text: prompt }] },
        });
        return response.text || "";
      });
    } catch (err: any) {
      console.error("Error en visió Gemini:", err);
      throw err;
    }
  }

  async refineText(text: string, instruction: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `TEXT ACTUAL:\n${text}\n\nINSTRUCCIÓ DE REFINAMENT:\n${instruction}`;

    try {
      return await this.withRetry(async () => {
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt,
          config: {
            systemInstruction: SYSTEM_PROMPT_REFINEMENT,
            temperature: 0.5,
          },
        });
        return response.text || text;
      });
    } catch (err) {
      console.error("Error refinant text:", err);
      return text;
    }
  }

  async askAssistant(message: string, context: string, history: {role: string, parts: {text: string}[]}[] = []): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          ...history,
          { role: 'user', parts: [{ text: `CONTEXT ACTUAL (Notes de l'alumne):\n${context}\n\nPREGUNTA DE L'USUARI: ${message}` }] }
        ],
        config: {
          systemInstruction: SYSTEM_PROMPT_ASSISTANT,
          temperature: 0.7,
        },
      });
      return response.text || "No tinc resposta per a això.";
    } catch (err) {
      return "Ho sento, he tingut un problema processant la teva consulta.";
    }
  }
}

export const geminiService = new GeminiService();
