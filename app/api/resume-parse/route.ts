import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";

export const runtime = "nodejs";

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get("resume");

        if (!(file instanceof File)) {
            return NextResponse.json(
                { error: "Please upload a resume PDF." },
                { status: 400 }
            );
        }

        const isPdf =
            file.type === "application/pdf" ||
            file.name.toLowerCase().endsWith(".pdf");

        if (!isPdf) {
            return NextResponse.json(
                { error: "Only PDF files are supported." },
                { status: 400 }
            );
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await getDocumentProxy(
            new Uint8Array(arrayBuffer)
        );

        const result = await extractText(pdf, {
            mergePages: true,
        });

        const resumeText = result.text.trim();

        if (!resumeText) {
            return NextResponse.json(
                {
                    error:
                        "No readable text could be extracted from this PDF. Please try a text-based PDF.",
                },
                { status: 422 }
            );
        }

        return NextResponse.json({
            text: resumeText,
            characterCount: resumeText.length,
            totalPages: result.totalPages,
        });
    } catch (error) {
        console.error("Resume parsing error:", error);

        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Unable to read this resume.",
            },
            { status: 500 }
        );
    }
}
