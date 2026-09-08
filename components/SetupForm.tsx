"use client";

import { useEffect, useRef, useState } from "react";

type SpeechRecognitionAlternativeLike = {
    transcript: string;
};

type SpeechRecognitionResultLike = {
    [index: number]: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionResultListLike = {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
};

type SpeechRecognitionEventLike = Event & {
    resultIndex: number;
    results: SpeechRecognitionResultListLike;
};

type SpeechRecognitionErrorEventLike = Event & {
    error: string;
};

interface SpeechRecognitionInstance {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    onresult: ((event: SpeechRecognitionEventLike) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
    onend: (() => void) | null;
}

interface SpeechRecognitionConstructor {
    new (): SpeechRecognitionInstance;
}

interface SpeechRecognitionWindow extends Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

type Feedback = {
    overall: number;
    clarity: number;
    depth: number;
    relevance: number;
    strengths: string;
    improvements: string;
    model_answer_hint: string;
};

type InterviewQuestion = {
    question: string;
    category: string;
};

type QuestionResult = {
    number: number;
    question: InterviewQuestion;
    status: "answered" | "skipped";
    answer?: string;
    feedback?: Feedback;
};

type ResumeMatch = {
    matchPercentage: number;
    matchingStrengths: string[];
    missingAreas: string[];
    suggestions: string[];
    summary: string;
};
class ApiRequestError extends Error {
    constructor(public status: number, message: string) {
        super(message);
    }
}

const primaryButton =
    "rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition duration-200 hover:bg-blue-700 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0";

const secondaryButton =
    "rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 transition duration-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-60";

const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 transition duration-200 outline-none placeholder:text-slate-400 hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function formatDuration(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60)
        .toString()
        .padStart(2, "0");

    const seconds = (totalSeconds % 60)
        .toString()
        .padStart(2, "0");

    return `${minutes}:${seconds}`;
}

async function getApiError(response: Response) {
    const data = (await response.json().catch(() => null)) as {
        error?: unknown;
    } | null;

    const message =
        typeof data?.error === "string" ? data.error : "Request failed";

    return new ApiRequestError(response.status, message);
}

async function analyzeResumeMatch() {
    if (!resumeText.trim()) {
        setMatchError("Please upload and analyze a resume first.");
        return;
    }

    if (!role.trim()) {
        setMatchError("Please enter the target job role first.");
        return;
    }

    setIsAnalyzingMatch(true);
    setMatchError("");
    setResumeMatch(null);

    try {
        const response = await fetch("/api/resume-match", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                role,
                jobDescription,
                requiredSkills,
                resumeText,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "Unable to analyze resume match."
            );
        }

        setResumeMatch(data as ResumeMatch);
    } catch (error) {
        setMatchError(
            error instanceof Error
                ? error.message
                : "Unable to analyze resume match."
        );
    } finally {
        setIsAnalyzingMatch(false);
    }
}

function errorMessage(error: unknown, fallback: string) {
    return error instanceof ApiRequestError && error.status === 429
        ? error.message
        : fallback;
}

function StarScore({ label, score }: { label: string; score: number }) {
    return (
        <div>
            <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-700">{label}</span>
                <span className="text-sm font-semibold text-slate-900">
                    {score}/10
                </span>
            </div>

            <p
                className="mt-1 text-amber-500"
                aria-label={`${label}: ${score} out of 10`}
            >
                {"*".repeat(score)}
                <span className="text-slate-300">
                    {"★".repeat(10 - score)}
                </span>
            </p>
        </div>
    );
}

export default function SetupForm() {
    const sessionEndedRef = useRef(false);
    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
    const voiceBaseAnswerRef = useRef("");

    const [role, setRole] = useState("");
    const [company, setCompany] = useState("");
    const [jobDescription, setJobDescription] = useState("");
    const [requiredSkills, setRequiredSkills] = useState("");
    const [resumeFile, setResumeFile] = useState<File | null>(null);
    const [resumeText, setResumeText] = useState("");
    const [isParsingResume, setIsParsingResume] = useState(false);
    const [resumeError, setResumeError] = useState("");
    const [resumeMatch, setResumeMatch] = useState<ResumeMatch | null>(null);
    const [isAnalyzingMatch, setIsAnalyzingMatch] = useState(false);
    const [matchError, setMatchError] = useState("");
    const [interviewType, setInterviewType] = useState("Technical");
    const [experienceLevel, setExperienceLevel] = useState("Fresher");
    const [questionCount, setQuestionCount] = useState("5");

    const [interviewStarted, setInterviewStarted] = useState(false);
    const [interviewCompleted, setInterviewCompleted] = useState(false);
    const [totalQuestions, setTotalQuestions] = useState(0);
    const [currentQuestionNumber, setCurrentQuestionNumber] = useState(0);

    const [previousQuestions, setPreviousQuestions] = useState<string[]>([]);
    const [questionResults, setQuestionResults] = useState<QuestionResult[]>(
        []
    );

    const [currentQuestion, setCurrentQuestion] =
        useState<InterviewQuestion | null>(null);

    const [answer, setAnswer] = useState("");
    const [feedback, setFeedback] = useState<Feedback | null>(null);
    const [answerSubmitted, setAnswerSubmitted] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [error, setError] = useState("");

    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [isListening, setIsListening] = useState(false);

    useEffect(() => {
        if (!isTimerRunning) return;

        const intervalId = window.setInterval(() => {
            setElapsedSeconds((seconds) => seconds + 1);
        }, 1000);

        return () => window.clearInterval(intervalId);
    }, [isTimerRunning]);


    useEffect(() => {
        return () => {
            recognitionRef.current?.stop();
        };
    }, []);

    function startListening() {
        const SpeechRecognition =
            (window as SpeechRecognitionWindow).SpeechRecognition ||
            (window as SpeechRecognitionWindow).webkitSpeechRecognition;

        if (!SpeechRecognition) {
            setError("Voice input is not supported in this browser. Please use Google Chrome or type your answer.");
            return;
        }

        if (isListening) return;

        setError("");
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";
        voiceBaseAnswerRef.current = answer.trim();

        recognition.onresult = (event: SpeechRecognitionEventLike) => {
            let transcript = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }

            const base = voiceBaseAnswerRef.current;
            setAnswer(`${base}${base && transcript.trim() ? " " : ""}${transcript}`.trim());
        };

        recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
            if (event.error !== "no-speech" && event.error !== "aborted") {
                setError("Voice input stopped unexpectedly. Please try again.");
            }
            recognitionRef.current = null;
            setIsListening(false);
        };

        recognition.onend = () => {
            recognitionRef.current = null;
            setIsListening(false);
        };

        recognitionRef.current = recognition;
        setIsListening(true);

        try {
            recognition.start();
        } catch {
            setError("Unable to start voice input. Please try again.");
            recognitionRef.current = null;
            setIsListening(false);
        }
    }

    function stopListening() {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
        setIsListening(false);
    }

    async function generateQuestion(questionHistory: string[]) {
        const response = await fetch("/api/interview-question", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                role,
                company,
                jobDescription,
                requiredSkills,
                resumeText,
                interviewType,
                experienceLevel,
                previousQuestions: questionHistory,
            }),
        });

        if (!response.ok) {
            throw await getApiError(response);
        }

        return (await response.json()) as InterviewQuestion;
    }

    function clearCurrentQuestionState() {
        stopListening();
        voiceBaseAnswerRef.current = "";
        setAnswer("");
        setFeedback(null);
        setAnswerSubmitted(false);
    }

    async function startInterview() {
        if (!role.trim()) {
            setError("Please enter the role you are interviewing for.");
            return;
        }

        setIsLoading(true);
        setError("");
        sessionEndedRef.current = false;
        setIsTimerRunning(false);
        setElapsedSeconds(0);

        try {
            const firstQuestion = await generateQuestion([]);

            setTotalQuestions(Number(questionCount));
            setCurrentQuestionNumber(1);
            setPreviousQuestions([firstQuestion.question]);
            setQuestionResults([]);
            setCurrentQuestion(firstQuestion);

            clearCurrentQuestionState();

            setInterviewCompleted(false);
            setInterviewStarted(true);
            setIsTimerRunning(true);
        } catch (caughtError) {
            setError(
                errorMessage(
                    caughtError,
                    "Unable to start the interview. Please try again."
                )
            );

            console.error(caughtError);
        } finally {
            setIsLoading(false);
        }
    }

    async function generateNextQuestion() {
        setIsLoading(true);
        setError("");

        try {
            const nextQuestion = await generateQuestion(previousQuestions);

            if (sessionEndedRef.current) return;

            setPreviousQuestions((questions) => [
                ...questions,
                nextQuestion.question,
            ]);

            setCurrentQuestionNumber((number) => number + 1);
            setCurrentQuestion(nextQuestion);

            clearCurrentQuestionState();
        } catch (caughtError) {
            setError(
                errorMessage(
                    caughtError,
                    "Unable to generate the next question. Please try again."
                )
            );

            console.error(caughtError);
        } finally {
            setIsLoading(false);
        }
    }

    async function submitAnswer() {
        if (!currentQuestion || !answer.trim()) return;
        stopListening();

        setIsEvaluating(true);
        setError("");

        try {
            const response = await fetch("/api/interview-feedback", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    role,
                    company,
                    jobDescription,
                    requiredSkills,
                    interviewType,
                    experienceLevel,
                    question: currentQuestion.question,
                    category: currentQuestion.category,
                    answer,
                }),
            });

            if (!response.ok) {
                throw await getApiError(response);
            }

            const questionFeedback = (await response.json()) as Feedback;

            if (sessionEndedRef.current) return;

            setFeedback(questionFeedback);

            setQuestionResults((results) => [
                ...results,
                {
                    number: currentQuestionNumber,
                    question: currentQuestion,
                    status: "answered",
                    answer,
                    feedback: questionFeedback,
                },
            ]);

            setAnswerSubmitted(true);
        } catch (caughtError) {
            setError(
                errorMessage(
                    caughtError,
                    "Unable to evaluate your answer. Please try again."
                )
            );

            console.error(caughtError);
        } finally {
            setIsEvaluating(false);
        }
    }

    async function skipQuestion() {
        if (!currentQuestion || isLoading || isEvaluating) return;
        stopListening();

        const skippedResult: QuestionResult = {
            number: currentQuestionNumber,
            question: currentQuestion,
            status: "skipped",
        };

        setQuestionResults((results) => [...results, skippedResult]);

        clearCurrentQuestionState();

        if (currentQuestionNumber === totalQuestions) {
            setIsTimerRunning(false);
            setInterviewCompleted(true);
            return;
        }

        await generateNextQuestion();
    }

    function endInterview() {
        stopListening();
        sessionEndedRef.current = true;
        setIsTimerRunning(false);

        if (currentQuestion && !answerSubmitted) {
            setQuestionResults((results) => [
                ...results,
                {
                    number: currentQuestionNumber,
                    question: currentQuestion,
                    status: "skipped",
                },
            ]);
        }

        setInterviewCompleted(true);
    }

    function finishInterview() {
        stopListening();
        setIsTimerRunning(false);
        setInterviewCompleted(true);
    }

    function resetSession() {
        stopListening();
        sessionEndedRef.current = false;
        setIsTimerRunning(false);
        setElapsedSeconds(0);

        setInterviewStarted(false);
        setInterviewCompleted(false);

        setTotalQuestions(0);
        setCurrentQuestionNumber(0);

        setPreviousQuestions([]);
        setQuestionResults([]);

        setCurrentQuestion(null);

        clearCurrentQuestionState();

        setError("");
    }

    const answeredResults = questionResults.filter(
        (result) => result.status === "answered" && result.feedback
    );

    const skippedCount = questionResults.filter(
        (result) => result.status === "skipped"
    ).length;

    const averageScore = answeredResults.length
        ? answeredResults.reduce(
            (total, result) => total + result.feedback!.overall,
            0
        ) / answeredResults.length
        : null;

    const verdict =
        averageScore === null || averageScore < 5
            ? "Needs Work"
            : averageScore < 7
                ? "Fair"
                : averageScore < 8.5
                    ? "Good"
                    : "Strong";

    const progress = totalQuestions
        ? (currentQuestionNumber / totalQuestions) * 100
        : 0;

    function trackerClass(questionNumber: number) {
        const result = questionResults.find(
            (item) => item.number === questionNumber
        );

        if (
            questionNumber === currentQuestionNumber &&
            !interviewCompleted
        ) {
            return "border-blue-600 bg-blue-600 text-white";
        }

        if (result?.status === "answered") {
            return "border-emerald-600 bg-emerald-600 text-white";
        }

        if (result?.status === "skipped") {
            return "border-amber-400 bg-amber-400 text-slate-900";
        }

        return "border-slate-300 bg-slate-100 text-slate-500";
    }

    if (!interviewStarted) {
        return (
            <section className="mx-auto w-full max-w-2xl">
                <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">
                            Set Up Your Interview
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Add the details you have. The interview questions
                            will adapt to them.
                        </p>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                            Role you are interviewing for
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Software Developer"
                            value={role}
                            onChange={(event) => setRole(event.target.value)}
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                            Current company or target company
                            <span className="ml-1 text-slate-400">
                                (optional)
                            </span>
                        </label>
                        <input
                            type="text"
                            placeholder="Company name"
                            value={company}
                            onChange={(event) =>
                                setCompany(event.target.value)
                            }
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                            Job Description
                            <span className="ml-1 text-slate-400">
                                (optional)
                            </span>
                        </label>
                        <textarea
                            placeholder="Paste the job description here..."
                            value={jobDescription}
                            onChange={(event) =>
                                setJobDescription(event.target.value)
                            }
                            rows={4}
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                            Required Skills
                            <span className="ml-1 text-slate-400">
                                (optional)
                            </span>
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. React, TypeScript, SQL, Node.js"
                            value={requiredSkills}
                            onChange={(event) =>
                                setRequiredSkills(event.target.value)
                            }
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                            Resume
                            <span className="ml-1 text-slate-400">
                                PDF only
                            </span>
                        </label>

                        <input
                            type="file"
                            accept=".pdf,application/pdf"
                            onChange={async (event) => {
                                const file = event.target.files?.[0] || null;

                                setResumeFile(file);
                                setResumeText("");
                                setResumeError("");

                                if (!file) return;

                                setIsParsingResume(true);

                                try {
                                    const formData = new FormData();
                                    formData.append("resume", file);

                                    const response = await fetch("/api/resume-parse", {
                                        method: "POST",
                                        body: formData,
                                    });

                                    const data = await response.json();

                                    if (!response.ok) {
                                        throw new Error(data.error || "Unable to analyze resume.");
                                    }

                                    setResumeText(data.text);
                                } catch (error) {
                                    setResumeError(
                                        error instanceof Error
                                            ? error.message
                                            : "Unable to analyze resume."
                                    );
                                } finally {
                                    setIsParsingResume(false);
                                }
                            }}

                            {resumeFile && (
                                <p className="mt-2 text-sm text-slate-600">
                                    Selected:{" "}
                                    <span className="font-medium text-slate-800">
                                        {resumeFile.name}
                                    </span>
                                </p>
                            )}

                            <button
                            type="button"
                            onClick={analyzeResumeMatch}
                            disabled={
                                isParsingResume ||
                                isAnalyzingMatch ||
                                !resumeText.trim() ||
                                !role.trim()
                            }
                            className="mt-3 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isAnalyzingMatch
                                ? "Analyzing Resume..."
                                : "Analyze Resume Match"}
                        </button>

                        {matchError && (
                            <p className="mt-2 text-sm text-red-600">
                                {matchError}
                            </p>
                        )}

                        {resumeMatch && (
                            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-slate-500">
                                            Resume Match
                                        </p>
                                        <p className="text-3xl font-bold text-slate-900">
                                            {resumeMatch.matchPercentage}%
                                        </p>
                                    </div>

                                    <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                                        Target: {role}
                                    </span>
                                </div>

                                <p className="mt-3 text-sm text-slate-600">
                                    {resumeMatch.summary}
                                </p>

                                <div className="mt-4 grid gap-4 md:grid-cols-3">
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-800">
                                            Matching Strengths
                                        </h3>

                                        <ul className="mt-2 space-y-1 text-sm text-slate-600">
                                            {resumeMatch.matchingStrengths.map(
                                                (strength, index) => (
                                                    <li key={index}>
                                                        {strength}
                                                    </li>
                                                )
                                            )}
                                        </ul>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-800">
                                            Missing Areas
                                        </h3>

                                        <ul className="mt-2 space-y-1 text-sm text-slate-600">
                                            {resumeMatch.missingAreas.map(
                                                (area, index) => (
                                                    <li key={index}>
                                                        {area}
                                                    </li>
                                                )
                                            )}
                                        </ul>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-800">
                                            Suggestions
                                        </h3>

                                        <ul className="mt-2 space-y-1 text-sm text-slate-600">
                                            {resumeMatch.suggestions.map(
                                                (suggestion, index) => (
                                                    <li key={index}>
                                                        {suggestion}
                                                    </li>
                                                )
                                            )}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}

                        <p className="mt-1 text-xs text-slate-400">
                            Your resume is parsed and used to tailor questions and analyze role fit.
                        </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">
                                Interview Type
                            </label>

                            <select
                                value={interviewType}
                                onChange={(event) =>
                                    setInterviewType(event.target.value)
                                }
                                className={inputClass}
                            >

                                {isParsingResume && (
                                    <p className="mt-2 text-sm text-blue-600">
                                        Analyzing resume...
                                    </p>
                                )}

                                {resumeText && (
                                    <p className="mt-2 text-sm text-emerald-600">
                                        Resume analyzed successfully
                                    </p>
                                )}

                                {resumeError && (
                                    <p className="mt-2 text-sm text-red-600">
                                        {resumeError}
                                    </p>
                                )}
                                <option value="Technical">Technical</option>
                                <option value="Behavioral">Behavioral</option>
                                <option value="System Design">
                                    System Design
                                </option>
                                <option value="Mixed">Mixed</option>
                            </select>
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">
                                Experience Level
                            </label>

                            <select
                                value={experienceLevel}
                                onChange={(event) =>
                                    setExperienceLevel(event.target.value)
                                }
                                className={inputClass}
                            >
                                <option value="Fresher">Fresher</option>
                                <option value="Junior">Junior</option>
                                <option value="Mid-Level">Mid-Level</option>
                                <option value="Senior">Senior</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-slate-700">
                                Number of Questions
                            </label>
                            <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                                {questionCount}
                            </span>
                        </div>

                        <input
                            type="range"
                            min="3"
                            max="10"
                            value={questionCount}
                            onChange={(event) =>
                                setQuestionCount(event.target.value)
                            }
                            className="mt-3 w-full accent-blue-600"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={startInterview}
                        disabled={isLoading}
                        className={`${primaryButton} w-full`}
                    >
                        {isLoading
                            ? "Generating interview..."
                            : "Start Interview"}
                    </button>

                    {error && (
                        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            {error}
                        </p>
                    )}
                </div>
            </section>
        );
    }

    if (interviewCompleted) {
        return (
            <section className="space-y-6">
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="text-2xl font-bold text-slate-900">
                        Interview Summary
                    </h2>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-lg bg-blue-50 p-4">
                            <p className="text-sm text-slate-600">
                                Average Score
                            </p>
                            <p className="mt-1 text-3xl font-bold text-slate-900">
                                {averageScore === null
                                    ? "N/A"
                                    : `${averageScore.toFixed(1)}/10`}
                            </p>
                        </div>

                        <div className="rounded-lg bg-slate-50 p-4">
                            <p className="text-sm text-slate-600">
                                Answered
                            </p>
                            <p className="mt-1 text-3xl font-bold text-slate-900">
                                {answeredResults.length}
                            </p>
                        </div>

                        <div className="rounded-lg bg-amber-50 p-4">
                            <p className="text-sm text-slate-600">
                                Skipped
                            </p>
                            <p className="mt-1 text-3xl font-bold text-slate-900">
                                {skippedCount}
                            </p>
                        </div>

                        <div className="rounded-lg bg-slate-50 p-4">
                            <p className="text-sm text-slate-600">
                                Total Interview Time
                            </p>
                            <p className="mt-1 text-3xl font-bold text-slate-900">
                                {formatDuration(elapsedSeconds)}
                            </p>
                        </div>
                    </div>

                    <p className="mt-5 text-lg font-semibold text-slate-900">
                        Verdict: {verdict}
                    </p>

                    {averageScore === null && (
                        <p className="mt-1 text-slate-600">
                            No answers were evaluated, so the score is
                            unavailable.
                        </p>
                    )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="text-xl font-bold text-slate-900">
                        Question History
                    </h3>

                    <div className="mt-4 space-y-4">
                        {[...questionResults]
                            .sort((a, b) => a.number - b.number)
                            .map((result) => (
                                <article
                                    key={result.number}
                                    className="rounded-lg border border-slate-200 p-4"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <h4 className="font-semibold text-slate-900">
                                            Question {result.number}
                                        </h4>

                                        <span
                                            className={`rounded-full px-3 py-1 text-sm font-semibold ${result.status === "answered"
                                                ? "bg-emerald-100 text-emerald-800"
                                                : "bg-amber-100 text-amber-800"
                                                }`}
                                        >
                                            {result.status === "answered"
                                                ? "Answered"
                                                : "Skipped"}
                                        </span>
                                    </div>

                                    <p className="mt-2 text-slate-700">
                                        {result.question.question}
                                    </p>

                                    {result.status === "answered" &&
                                        result.feedback ? (
                                        <div className="mt-3 space-y-1 text-sm text-slate-700">
                                            <p>
                                                <strong>
                                                    Overall score:
                                                </strong>{" "}
                                                {result.feedback.overall}/10
                                            </p>

                                            <p>
                                                <strong>Strengths:</strong>{" "}
                                                {result.feedback.strengths}
                                            </p>

                                            <p>
                                                <strong>Improvements:</strong>{" "}
                                                {result.feedback.improvements}
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="mt-3 font-medium text-amber-700">
                                            Skipped
                                        </p>
                                    )}
                                </article>
                            ))}
                    </div>
                </div>

                <button
                    type="button"
                    onClick={resetSession}
                    className={primaryButton}
                >
                    New Interview
                </button>
            </section>
        );
    }

    if (!currentQuestion) return null;

    return (
        <section className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                    type="button"
                    onClick={resetSession}
                    className={secondaryButton}
                >
                    Back to Setup
                </button>

                <div className="flex items-center gap-3">
                    <p className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                        Interview Time: {formatDuration(elapsedSeconds)}
                    </p>

                    <button
                        type="button"
                        onClick={endInterview}
                        className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-white transition hover:bg-slate-900"
                    >
                        End Interview
                    </button>
                </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div
                    className="flex flex-wrap gap-2"
                    aria-label="Question status tracker"
                >
                    {Array.from(
                        { length: totalQuestions },
                        (_, index) => (
                            <span
                                key={index}
                                className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold ${trackerClass(
                                    index + 1
                                )}`}
                            >
                                {index + 1}
                            </span>
                        )
                    )}
                </div>

                <div className="mt-4 flex items-center justify-between text-sm font-semibold text-slate-600">
                    <span>
                        Question {currentQuestionNumber} of {totalQuestions}
                    </span>

                    <span>{Math.round(progress)}% complete</span>
                </div>

                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                        className="h-full rounded-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800">
                    {currentQuestion.category}
                </span>

                <h2 className="mt-4 text-xl font-bold text-slate-900">
                    {currentQuestion.question}
                </h2>
            </div>

            {!answerSubmitted ? (
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <label className="font-semibold text-slate-800">Your Answer</label>
                        {!isListening ? (
                            <button type="button" onClick={startListening} disabled={isEvaluating} className="rounded-lg bg-red-500 px-4 py-2 font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60">
                                Start Speaking
                            </button>
                        ) : (
                            <button type="button" onClick={stopListening} className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-white transition hover:bg-slate-900">
                                Stop Listening
                            </button>
                        )}
                    </div>

                    {isListening && (
                        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                            Listening... Speak your answer clearly.
                        </div>
                    )}

                    <textarea
                        placeholder="Type your answer here or use voice input..."
                        rows={10}
                        value={answer}
                        onChange={(event) => setAnswer(event.target.value)}
                        className={inputClass}
                    />

                    <p className="mt-2 text-sm text-slate-600">
                        Word count:{" "}
                        {answer.trim() === ""
                            ? 0
                            : answer.trim().split(/\s+/).length}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={submitAnswer}
                            disabled={isEvaluating || !answer.trim()}
                            className={primaryButton}
                        >
                            {isEvaluating
                                ? "Evaluating answer..."
                                : "Submit Answer"}
                        </button>

                        <button
                            type="button"
                            onClick={skipQuestion}
                            disabled={isLoading || isEvaluating}
                            className="rounded-lg bg-amber-400 px-4 py-2 font-semibold text-slate-900 transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Skip
                        </button>
                    </div>
                </div>
            ) : feedback ? (
                <div className="space-y-5 rounded-xl border border-blue-200 bg-blue-50/40 p-6 shadow-sm">
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <h3 className="font-bold text-slate-800">
                            Your Answer
                        </h3>

                        <p className="mt-2 whitespace-pre-wrap text-slate-700">
                            {answer}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-medium text-slate-600">
                                Overall Score
                            </p>

                            <p className="text-4xl font-bold text-slate-900">
                                {feedback.overall}
                                <span className="text-xl text-slate-600">
                                    /10
                                </span>
                            </p>
                        </div>

                        <p
                            className="text-2xl text-blue-600"
                            aria-label={`Overall score: ${feedback.overall} out of 10`}
                        >
                            {"*".repeat(feedback.overall)}
                            <span className="text-slate-300">
                                {".".repeat(10 - feedback.overall)}
                            </span>
                        </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                        <StarScore
                            label="Clarity"
                            score={feedback.clarity}
                        />

                        <StarScore label="Depth" score={feedback.depth} />

                        <StarScore
                            label="Relevance"
                            score={feedback.relevance}
                        />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-lg border border-emerald-200 bg-white p-4">
                            <h3 className="font-bold text-emerald-800">
                                Strengths
                            </h3>

                            <p className="mt-2 text-slate-700">
                                {feedback.strengths}
                            </p>
                        </div>

                        <div className="rounded-lg border border-amber-200 bg-white p-4">
                            <h3 className="font-bold text-amber-800">
                                Areas for Improvement
                            </h3>

                            <p className="mt-2 text-slate-700">
                                {feedback.improvements}
                            </p>
                        </div>
                    </div>

                    {currentQuestionNumber === totalQuestions ? (
                        <button
                            type="button"
                            onClick={finishInterview}
                            className={primaryButton}
                        >
                            Finish Interview
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={generateNextQuestion}
                            disabled={isLoading}
                            className={primaryButton}
                        >
                            {isLoading
                                ? "Generating question..."
                                : "Next Question"}
                        </button>
                    )}
                </div>
            ) : null}

            {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                    {error}
                </p>
            )}
        </section>
    );
}