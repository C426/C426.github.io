import { GoogleGenAI } from "@google/genai";

const parseJsonPayload = (raw: string) => {
    try {
        return JSON.parse(raw);
    } catch {
        return JSON.parse(raw.replace(/```json/gi, '').replace(/```/g, '').trim());
    }
};

export class GeminiAdapter {
    private ai: GoogleGenAI;
    private chat: any;

    constructor(apiKey: string, modelName: string, systemPrompt: string) {
        this.ai = new GoogleGenAI({ apiKey });
        this.chat = this.ai.chats.create({
            model: modelName,
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: "application/json",
            }
        });
    }

    async sendMessage(msg: string) {
        const response = await this.chat.sendMessage({ message: msg });
        return parseJsonPayload(response.text);
    }
}

export class OpenAIAdapter {
    private apiKey: string;
    private baseUrl: string;
    private modelName: string;
    private messages: any[];

    constructor(apiKey: string, baseUrl: string, modelName: string, systemPrompt: string) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.modelName = modelName;
        this.messages = [{ role: "system", content: systemPrompt }];
    }

    async sendMessage(message: string) {
        this.messages.push({ role: "user", content: message });
        const res = await fetch(this.baseUrl, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${this.apiKey}` 
            },
            body: JSON.stringify({ 
                model: this.modelName, 
                messages: this.messages, 
                response_format: { type: "json_object" }, 
                temperature: 1.0 
            })
        });
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error?.message || "API Error");
        }
        const data = await res.json();
        const aiContent = data.choices[0].message.content;
        this.messages.push({ role: "assistant", content: aiContent });
        return parseJsonPayload(aiContent);
    }
}
