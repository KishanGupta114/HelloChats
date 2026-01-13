
import { GoogleGenAI, Type } from "@google/genai";

// Use the API key directly from process.env.API_KEY as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const geminiService = {
  /**
   * Generates ice-breaker questions based on user interests
   */
  async getIceBreakers(interests: string[]): Promise<string[]> {
    try {
      const prompt = `Generate 3 fun, safe, and engaging ice-breaker questions for an anonymous chat between two people who both like: ${interests.join(', ')}. Return only a JSON array of strings.`;
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });
      // response.text is a property, safe to use with fallback
      return JSON.parse(response.text || '[]');
    } catch (error) {
      console.error("IceBreaker Error:", error);
      return ["What's your favorite thing about your hobby?", "How did you get started with your interests?", "If you could do anything right now, what would it be?"];
    }
  },

  /**
   * Scans text for toxicity or unsafe content
   */
  async scanText(text: string): Promise<{ isSafe: boolean; reason?: string }> {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze this chat message for safety: "${text}". Is it harmful, abusive, sexually explicit, or hate speech? Respond in JSON format with "isSafe" (boolean) and "reason" (string, optional).`,
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
      // response.text is a property, safe to use with fallback
      return JSON.parse(response.text || '{"isSafe": true}');
    } catch {
      return { isSafe: true };
    }
  },

  /**
   * Scans an image (frame) for nudity or unsafe visual content
   */
  async scanFrame(base64Image: string): Promise<{ isSafe: boolean; blurRequired: boolean }> {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { data: base64Image.split(',')[1], mimeType: 'image/jpeg' } },
            { text: "Analyze this video frame for adult content, nudity, or violence. If it's unsafe, return blurRequired: true and isSafe: false. Otherwise, return isSafe: true. Respond in JSON." }
          ]
        },
      });
      // Safe check for response.text as it might be undefined
      const result = (response.text || "").toLowerCase();
      const isSafe = !result.includes('unsafe') && !result.includes('nudity');
      return { isSafe, blurRequired: !isSafe };
    } catch {
      return { isSafe: true, blurRequired: false };
    }
  }
};
