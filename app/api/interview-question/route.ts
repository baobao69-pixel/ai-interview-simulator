import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { NextResponse } from "next/server";

type GeneratedQuestion = {
  question: string;
  category: string;
  tips: [string, string, string];
};

type QuestionRequestBody = {
  role?: unknown;
  company?: unknown;
  interviewType?: unknown;
  experienceLevel?: unknown;
  previousQuestions?: unknown;
};

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

function isGeneratedQuestion(value: unknown): value is GeneratedQuestion {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  return typeof candidate.question === "string"
    && candidate.question.trim().length > 0
    && typeof candidate.category === "string"
    && candidate.category.trim().length > 0
    && Array.isArray(candidate.tips)
    && candidate.tips.length === 3
    && candidate.tips.every((tip) => typeof tip === "string" && tip.trim().length > 0);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as QuestionRequestBody;
    const { role, company, interviewType, experienceLevel } = body;
    const previousQuestions = Array.isArray(body.previousQuestions)
      ? body.previousQuestions.filter((question: unknown): question is string => typeof question === "string")
      : [];

    if (typeof role !== "string" || !role || typeof interviewType !== "string" || !interviewType || typeof experienceLevel !== "string" || !experienceLevel) {
      return NextResponse.json(
        { error: "role, interviewType, and experienceLevel are required." },
        { status: 400 }
      );
    }

    const companyContext = typeof company === "string" && company ? ` applying to ${company}` : "";
    const previousQuestionsContext = previousQuestions.length
      ? ` Do not repeat or closely rephrase any of these earlier session questions: ${previousQuestions.map((question) => `"${question}"`).join(", ")}.`
      : "";

    const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await gemini.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate exactly one complete, relevant ${interviewType} interview question for a ${experienceLevel} ${role} candidate${companyContext}.${previousQuestionsContext} Return JSON only. The category must match the generated question and interview type. Provide exactly three short, useful tips specific to this question. Do not use generic Python, mutability, or data-structure tips.`,
      config: {
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          properties: {
            question: { type: "string" },
            category: { type: "string" },
            tips: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 3 },
          },
          required: ["question", "category", "tips"],
        },
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      },
    });

    const questionText = response.text?.trim();
    if (!questionText) {
      return NextResponse.json({ error: "Could not generate an interview question." }, { status: 500 });
    }

    const generatedQuestion: unknown = JSON.parse(questionText);
    if (!isGeneratedQuestion(generatedQuestion)) {
      return NextResponse.json({ error: "Generated interview question had an invalid format." }, { status: 500 });
    }

    return NextResponse.json(generatedQuestion);
  } catch (error) {
    console.error("Error generating interview question:", error);
    if (isQuotaError(error)) {
      return NextResponse.json({ error: quotaErrorMessage }, { status: 429 });
    }

    return NextResponse.json({ error: "Unable to generate an interview question." }, { status: 500 });
  }
}
