import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { NextResponse } from "next/server";

const quotaErrorMessage = "The free AI request limit has been reached. Please try again after the quota resets.";

function isQuotaError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const candidate = error as {
    status?: number;
    code?: number | string;
    message?: string;
    error?: { code?: number | string; status?: string; message?: string };
  };
  const message = [candidate.message, candidate.error?.message, candidate.error?.status]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  return candidate.status === 429
    || candidate.code === 429
    || candidate.error?.code === 429
    || message.includes("resource_exhausted")
    || message.includes("quota");
}

export async function POST(request: Request) {
  try {
    const { role, interviewType, experienceLevel, question, answer } =
      await request.json();

    if (!role || !interviewType || !experienceLevel || !question || !answer) {
      return NextResponse.json(
        { error: "role, interviewType, experienceLevel, question, and answer are required." },
        { status: 400 }
      );
    }

    const gemini = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const response = await gemini.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Evaluate this ${interviewType} interview answer for a ${experienceLevel} ${role} candidate. For Behavioral interviews, emphasize communication, structure, specific examples, and relevance. For Technical interviews, emphasize correctness, depth, explanation, and relevance. Do not invent percentages or scientific metrics.\n\nQuestion: ${question}\n\nAnswer: ${answer}`,
      config: {
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          properties: {
            overall: { type: "integer", minimum: 1, maximum: 10 },
            clarity: { type: "integer", minimum: 1, maximum: 10 },
            depth: { type: "integer", minimum: 1, maximum: 10 },
            relevance: { type: "integer", minimum: 1, maximum: 10 },
            strengths: { type: "string" },
            improvements: { type: "string" },
            model_answer_hint: { type: "string" },
          },
          required: ["overall", "clarity", "depth", "relevance", "strengths", "improvements", "model_answer_hint"],
        },
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.MINIMAL,
        },
      },
    });

    const feedbackText = response.text?.trim();

    if (!feedbackText) {
      return NextResponse.json(
        { error: "Could not generate interview feedback." },
        { status: 500 }
      );
    }

    return NextResponse.json(JSON.parse(feedbackText));
  } catch (error) {
    console.error("Error generating interview feedback:", error);
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage }, { status: 429 });
    }

    return NextResponse.json(
      { error: "Unable to generate interview feedback." },
      { status: 500 }
    );
  }
}
