
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const geminiService = {
  /**
   * Generates a realistic response from an "AI Stranger" to simulate a chat
   */
  async getAIResponse(history: {role: string, text: string}[], interests: string[]): Promise<string> {
    try {
      const chat = ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: {
          systemInstruction: `You are an anonymous person in a chat room. You share these interests: ${interests.join(', ')}. 
          Be casual, use lowercase sometimes, use slang, and be friendly but brief. 
          Do not admit you are an AI. Act like a real person named "Stranger".`
        }
      });
      
      const lastMsg = history[history.length - 1]?.text || "Hi!";
      const response = await chat.sendMessage({ message: lastMsg });
      return response.text || "hey! what's up?";
    } catch (error) {
      return "That's cool! Tell me more.";
    }
  },

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
      return JSON.parse(response.text || '[]');
    } catch {
      return ["What's your favorite thing about your hobby?", "How did you get started?", "What's the best thing that happened today?"];
    }
  },

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
