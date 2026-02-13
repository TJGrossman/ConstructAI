import OpenAI from "openai";

const globalForOpenAI = globalThis as unknown as {
  openai: OpenAI;
};

export const openai =
  globalForOpenAI.openai ||
  new OpenAI({
    apiKey: process.env.TOGETHER_API_KEY,
    baseURL: "https://api.together.xyz/v1",
  });

if (process.env.NODE_ENV !== "production")
  globalForOpenAI.openai = openai;
