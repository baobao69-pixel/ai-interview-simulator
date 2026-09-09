import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { NextResponse } from "next/server";

type ResumeMatchRequest = {
    role?: unknown;
    jobDescription?: unknown;
    requiredSkills?: unknown;
    resumeText?: unknown;
};

type ResumeMatchResult = {
    matchPercentage: number;
    matchingStrengths: string[];
    missingAreas: string[];
    suggestions: string[];
    summary: string;
};

function isResumeMatchResult(
    value: unknown
): value is ResumeMatchResult {
    if (!value || typeof value !== "object") return false;

    const candidate = value as Record<string, unknown>;

    return (
        typeof candidate.matchPercentage === "number" &&
        candidate.matchPercentage >= 0 &&
        candidate.matchPercentage <= 100 &&
        Array.isArray(candidate.matchingStrengths) &&
        Array.isArray(candidate.missingAreas) &&
        Array.isArray(candidate.suggestions) &&
        typeof candidate.summary === "string"
    );
}

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as ResumeMatchRequest;

        const {
            role,
            jobDescription,
            requiredSkills,
            resumeText,
        } = body;

        if (
            typeof role !== "string" ||
            !role.trim()
        ) {
            return NextResponse.json(
                { error: "A target role is required." },
                { status: 400 }
            );
        }

        if (
            typeof resumeText !== "string" ||
            !resumeText.trim()
        ) {
            return NextResponse.json(
                { error: "A parsed resume is required for matching." },
                { status: 400 }
            );
        }

        const jobDescriptionContext =
            typeof jobDescription === "string" &&
                jobDescription.trim()
                ? jobDescription.trim()
                : "No job description was provided.";

        const requiredSkillsContext =
            typeof requiredSkills === "string" &&
                requiredSkills.trim()
                ? requiredSkills.trim()
                : "No specific required skills were provided.";

        const gemini = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY,
        });

        const prompt = `
Analyze how well this candidate's resume matches the target role.

Target role:
${role.trim()}

Job description:
${jobDescriptionContext}

Required skills:
${requiredSkillsContext}

Resume:
${resumeText.trim().slice(0, 15000)}

Score the resume realistically from 0 to 100.

Do not inflate the score just to be encouraging.

If the resume is fundamentally unrelated to the target role, give a very low score.

Identify:
1. Skills, experience, or qualifications that strongly match.
2. Important missing or weak areas.
3. Specific improvements the candidate can make to their resume.

Return JSON only.
`;

        const response =
            await gemini.models.generateContent({
                model: "gemini-2.5-flash-lite",
                contents: prompt,
                config: {
                    maxOutputTokens: 2048,
                    responseMimeType: "application/json",
                    responseJsonSchema: {
                        type: "object",
                        properties: {
                            matchPercentage: {
                                type: "number",
                            },
                            matchingStrengths: {
                                type: "array",
                                items: {
                                    type: "string",
                                },
                            },
                            missingAreas: {
                                type: "array",
                                items: {
                                    type: "string",
                                },
                            },
                            suggestions: {
                                type: "array",
                                items: {
                                    type: "string",
                                },
                            },
                            summary: {
                                type: "string",
                            },
                        },
                        required: [
                            "matchPercentage",
                            "matchingStrengths",
                            "missingAreas",
                            "suggestions",
                            "summary",
                        ],
                    },
                    thinkingConfig: {
                        thinkingLevel: ThinkingLevel.MINIMAL,
                    },
                },
            });

        const responseText = response.text?.trim();

        if (!responseText) {
            return NextResponse.json(
                { error: "Could not analyze the resume match." },
                { status: 500 }
            );
        }

        const result: unknown =
            JSON.parse(responseText);

        if (!isResumeMatchResult(result)) {
            return NextResponse.json(
                { error: "Resume analysis returned an invalid format." },
                { status: 500 }
            );
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error("Error analyzing resume match:", error);

        return NextResponse.json(
            { error: "Unable to analyze resume match." },
            { status: 500 }
        );
    }
}
