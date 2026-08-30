import { NextResponse } from "next/server";

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

        if (
            file.type !== "application/pdf" &&
            !file.name.toLowerCase().endsWith(".pdf")
        ) {
            return NextResponse.json(
                { error: "Only PDF files are supported." },
                { status: 400 }
            );
        }

        const arrayBuffer = await file.arrayBuffer();

        // Dynamically load pdfjs only on the server at runtime.
        const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

        const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(arrayBuffer),
            useWorkerFetch: false,
            isEvalSupported: false,
            useSystemFonts: true,
        });

        const pdf = await loadingTask.promise;
        let resumeText = "";

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
            const page = await pdf.getPage(pageNumber);
            const content = await page.getTextContent();

            const pageText = content.items
                .map((item) => ("str" in item ? item.str : ""))
                .join(" ");

            resumeText += pageText + "\n";
        }

        resumeText = resumeText.trim();

        if (!resumeText) {
            return NextResponse.json(
                {
                    error:
                        "No readable text could be extracted from this PDF. Please use a text-based PDF.",
                },
                { status: 422 }
            );
        }

        return NextResponse.json({
            text: resumeText,
            characterCount: resumeText.length,
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