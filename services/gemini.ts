
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const geminiService = {
  /**
   * Scans text for safety violations
   */
  async scanText(text: string): Promise<{ isSafe: boolean; reason?: string }> {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze this chat message for safety: "${text}". Respond in JSON format with "isSafe" (boolean) and "reason" (string, optional).`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isSafe: { type: Type.BOOLEAN },
              reason: { type: Type.STRING }
            },
            required: ['isSafe']
          }
        }
      });
      return JSON.parse(response.text || '{"isSafe": true}');
    } catch {
      return { isSafe: true };
    }
  },

  /**
   * Scans a frame for nudity or violence to protect users
   */
  async scanFrame(base64Image: string): Promise<{ isSafe: boolean; blurRequired: boolean }> {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { data: base64Image.split(',')[1], mimeType: 'image/jpeg' } },
            { text: "Analyze for nudity or violence. Respond in JSON with isSafe and blurRequired." }
          ]
        },
      });
      const result = (response.text || "").toLowerCase();
      const isSafe = !result.includes('unsafe') && !result.includes('nudity');
      return { isSafe, blurRequired: !isSafe };
    } catch {
      return { isSafe: true, blurRequired: false };
    }
  }
};
