import { NextResponse } from "next/server";

type ResumeMatchRequest = {
    role?: unknown;
    jobDescription?: unknown;
    requiredSkills?: unknown;
    resumeText?: unknown;
};

function normalize(text: string) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9+#.\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function extractTerms(text: string) {
    return normalize(text)
        .split(/[\s,;|/]+/)
        .filter((term) => term.length >= 3);
}

export async function POST(request: Request) {
    try {
        const body =
            (await request.json()) as ResumeMatchRequest;

        const role =
            typeof body.role === "string" ? body.role.trim() : "";
        const jobDescription =
            typeof body.jobDescription === "string"
                ? body.jobDescription.trim()
                : "";
        const requiredSkills =
            typeof body.requiredSkills === "string"
                ? body.requiredSkills.trim()
                : "";
        const resumeText =
            typeof body.resumeText === "string"
                ? body.resumeText.trim()
                : "";

        if (!role) {
            return NextResponse.json(
                { error: "A target role is required." },
                { status: 400 }
            );
        }

        if (!resumeText) {
            return NextResponse.json(
                { error: "A parsed resume is required for matching." },
                { status: 400 }
            );
        }

        const resume = normalize(resumeText);

        const terms = [
            ...new Set(
                extractTerms(`${requiredSkills} ${jobDescription}`)
            ),
        ];

        const matchedTerms = terms.filter((term) =>
            resume.includes(term)
        );

        const missingTerms = terms.filter(
            (term) => !resume.includes(term)
        );

        const roleTerms = extractTerms(role);
        const roleMatches = roleTerms.filter((term) =>
            resume.includes(term)
        );

        const skillScore =
            terms.length > 0
                ? matchedTerms.length / terms.length
                : 0;

        const roleScore =
            roleTerms.length > 0
                ? roleMatches.length / roleTerms.length
                : 0;

        const matchPercentage = Math.round(
            Math.min(100, skillScore * 80 + roleScore * 20)
        );

        const matchingStrengths =
            matchedTerms.length > 0
                ? matchedTerms.slice(0, 6).map(
                      (term) =>
                          `Resume demonstrates experience or knowledge related to ${term}.`
                  )
                : [
                      "The resume was successfully parsed, but few direct matches were found.",
                  ];

        const missingAreas =
            missingTerms.length > 0
                ? missingTerms.slice(0, 6).map(
                      (term) =>
                          `Consider strengthening evidence of ${term}.`
                  )
                : [
                      "No major skill gaps were identified from the supplied requirements.",
                  ];

        const suggestions = [
            `Tailor the resume toward the ${role} role by emphasizing the most relevant experience.`,
            ...(missingTerms.length > 0
                ? [
                      `Add relevant projects, experience, or achievements related to ${missingTerms
                          .slice(0, 3)
                          .join(", ")} if applicable.`,
                  ]
                : []),
            "Use measurable outcomes and specific technologies wherever possible.",
        ];

        const summary =
            matchPercentage >= 75
                ? `The resume shows a strong match for the ${role} role based on the supplied requirements.`
                : matchPercentage >= 50
                    ? `The resume shows a moderate match for the ${role} role, with some areas that could be strengthened.`
                    : `The resume currently shows a limited match for the ${role} role based on the supplied requirements.`;

        return NextResponse.json({
            matchPercentage,
            matchingStrengths,
            missingAreas,
            suggestions,
            summary,
        });
    } catch (error) {
        console.error("Error analyzing resume match:", error);

        return NextResponse.json(
            { error: "Unable to analyze resume match." },
            { status: 500 }
        );
    }
}
