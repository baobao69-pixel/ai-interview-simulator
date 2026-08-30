import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { NextResponse } from "next/server";

type Difficulty = "Easy" | "Medium" | "Hard";
type Likelihood = "Most Likely" | "Likely" | "Less Likely";

type GeneratedQuestion = {
  question: string;
  category: string;
  difficulty: Difficulty;
  likelihood: Likelihood;
  tips: [string, string, string];
};

type QuestionRequestBody = {
  role?: unknown;
  company?: unknown;
  interviewType?: unknown;
  experienceLevel?: unknown;
  previousQuestions?: unknown;
};

const quotaErrorMessage =
  "The free AI request limit has been reached. Please try again after the quota resets.";

function isQuotaError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const candidate = error as {
    status?: number;
    code?: number | string;
    message?: string;
    error?: {
      code?: number | string;
      status?: string;
      message?: string;
    };
  };

  const message = [
    candidate.message,
    candidate.error?.message,
    candidate.error?.status,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  return (
    candidate.status === 429 ||
    candidate.code === 429 ||
    candidate.error?.code === 429 ||
    message.includes("resource_exhausted") ||
    message.includes("quota")
  );
}

function isGeneratedQuestion(value: unknown): value is GeneratedQuestion {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;

  const validDifficulty =
    candidate.difficulty === "Easy" ||
    candidate.difficulty === "Medium" ||
    candidate.difficulty === "Hard";

  const validLikelihood =
    candidate.likelihood === "Most Likely" ||
    candidate.likelihood === "Likely" ||
    candidate.likelihood === "Less Likely";

  return (
    typeof candidate.question === "string" &&
    candidate.question.trim().length > 0 &&
    typeof candidate.category === "string" &&
    candidate.category.trim().length > 0 &&
    validDifficulty &&
    validLikelihood &&
    Array.isArray(candidate.tips) &&
    candidate.tips.length === 3 &&
    candidate.tips.every(
      (tip) =>
        typeof tip === "string" &&
        tip.trim().length > 0
    )
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as QuestionRequestBody;

    const {
      role,
      company,
      interviewType,
      experienceLevel,
    } = body;

    const previousQuestions = Array.isArray(
      body.previousQuestions
    )
      ? body.previousQuestions.filter(
        (question: unknown): question is string =>
          typeof question === "string"
      )
      : [];

    if (
      typeof role !== "string" ||
      !role ||
      typeof interviewType !== "string" ||
      !interviewType ||
      typeof experienceLevel !== "string" ||
      !experienceLevel
    ) {
      return NextResponse.json(
        {
          error:
            "role, interviewType, and experienceLevel are required.",
        },
        { status: 400 }
      );
    }

    const companyContext =
      typeof company === "string" && company
        ? ` applying to ${company}`
        : "";

    const previousQuestionsContext =
      previousQuestions.length
        ? ` Do not repeat or closely rephrase any of these earlier session questions: ${previousQuestions
          .map(
            (question) => `"${question}"`
          )
          .join(", ")}.`
        : "";

    const gemini = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const response =
      await gemini.models.generateContent({
        model: "gemini-3-flash-preview",

        contents: `
Generate exactly one complete and relevant ${interviewType}
interview question for a ${experienceLevel} ${role}
candidate${companyContext}.

${previousQuestionsContext}

Return JSON only.

The question must be realistic and appropriate for an actual
interview.

Also classify the question using:

difficulty:
- Easy
- Medium
- Hard

likelihood:
- Most Likely = highly common or important question for this role
- Likely = reasonably common interview question
- Less Likely = specialized or less commonly asked question

category:
Use a short descriptive category such as:
- React
- System Design
- Database
- Behavioral
- Security
- Problem Solving
- Architecture

Provide exactly three short and useful tips specific to the
generated question.

Do not use generic filler tips.
Do not repeat previous questions.
                `,

        config: {
          maxOutputTokens: 1024,

          responseMimeType:
            "application/json",

          responseJsonSchema: {
            type: "object",

            properties: {
              question: {
                type: "string",
              },

              category: {
                type: "string",
              },

              difficulty: {
                type: "string",
                enum: [
                  "Easy",
                  "Medium",
                  "Hard",
                ],
              },

              likelihood: {
                type: "string",
                enum: [
                  "Most Likely",
                  "Likely",
                  "Less Likely",
                ],
              },

              tips: {
                type: "array",
                items: {
                  type: "string",
                },
                minItems: 3,
                maxItems: 3,
              },
            },

            required: [
              "question",
              "category",
              "difficulty",
              "likelihood",
              "tips",
            ],
          },

          thinkingConfig: {
            thinkingLevel:
              ThinkingLevel.MINIMAL,
          },
        },
      });

    const questionText =
      response.text?.trim();

    if (!questionText) {
      return NextResponse.json(
        {
          error:
            "Could not generate an interview question.",
        },
        { status: 500 }
      );
    }

    const generatedQuestion: unknown =
      JSON.parse(questionText);

    if (!isGeneratedQuestion(generatedQuestion)) {
      return NextResponse.json(
        {
          error:
            "Generated interview question had an invalid format.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      generatedQuestion
    );
  } catch (error) {
    console.error(
      "Error generating interview question:",
      error
    );

    if (isQuotaError(error)) {
      return NextResponse.json(
        {
          error:
            quotaErrorMessage,
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error:
          "Unable to generate an interview question.",
      },
      { status: 500 }
    );
  }
}