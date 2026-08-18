
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
    tips: [string, string, string];
};

type QuestionResult = {
    number: number;
    question: InterviewQuestion;
    status: "answered" | "skipped";
    answer?: string;
    feedback?: Feedback;
};

class ApiRequestError extends Error {
    constructor(public status: number, message: string) {
        super(message);
    }
}

const primaryButton =
    "rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";

const secondaryButton =
    "rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60";

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
    const data = (await response
        .json()
        .catch(() => null)) as { error?: unknown } | null;

    const message =
        typeof data?.error === "string" ? data.error : "Request failed";

    return new ApiRequestError(response.status, message);
}

function errorMessage(error: unknown, fallback: string) {
    return error instanceof ApiRequestError && error.status === 429
        ? error.message
        : fallback;
}

function createFallbackQuestion(
    questionHistory: string[],
    interviewType: string,
    role: string
): InterviewQuestion {
    const technicalQuestions = [
        "Explain the difference between an array and a linked list, and when you would choose each one.",
        "What is the difference between a process and a thread?",
        "Explain how a database index improves query performance and mention one trade-off.",
        "What is the difference between authentication and authorization?",
        "Explain the difference between synchronous and asynchronous programming with a practical example.",
        "What happens when you enter a URL in a browser and press Enter?",
        "Explain what an API is and how a frontend application typically communicates with one.",
        "What is normalization in databases, and why is it useful?",
        "Explain the difference between a stack and a queue and give one use case for each.",
        "What is caching, and when can caching cause problems?",
    ];

    const behavioralQuestions = [
        "Describe a time when you faced a difficult problem. How did you approach it and what was the outcome?",
        "Tell me about a time when you had to learn something quickly to complete a task.",
        "Describe a situation where you received critical feedback. What did you do with it?",
        "Tell me about a time when you worked with someone who had a different approach from yours.",
        "Describe a time when you made a mistake. How did you handle it?",
        "Tell me about a time when you had to manage multiple priorities under pressure.",
        "Describe a project you are proud of and explain your specific contribution.",
        "Tell me about a time when you took initiative without being asked.",
        "Describe a situation where something did not go according to plan. What did you learn?",
        "Tell me about a time when you had to explain a complex idea to someone with less technical knowledge.",
    ];

    const systemDesignQuestions = [
        "How would you design a simple URL shortening service? Explain the main components and data flow.",
        "How would you design a notification system that can send email and in-app notifications?",
        "How would you design a file-upload service for a web application?",
        "How would you design a simple real-time chat application?",
        "How would you design a system that tracks user activity events at scale?",
        "How would you design a basic appointment-booking system?",
        "How would you design a service that stores and retrieves user profile data efficiently?",
        "How would you design a rate-limiting mechanism for a public API?",
        "How would you design a basic search feature for a large collection of documents?",
        "How would you design a leaderboard that updates frequently?",
    ];

    let pool = technicalQuestions;
    if (interviewType === "Behavioral") pool = behavioralQuestions;
    if (interviewType === "System Design") pool = systemDesignQuestions;
    if (interviewType === "Mixed") {
        pool = technicalQuestions.map((question, index) =>
            index % 2 === 0 ? question : behavioralQuestions[index]
        );
    }

    const unusedQuestion = pool.find(
        (question) => !questionHistory.includes(question)
    );
    const question = unusedQuestion ?? pool[questionHistory.length % pool.length];
    const category =
        interviewType === "Mixed"
            ? technicalQuestions.includes(question)
                ? "Technical"
                : "Behavioral"
            : interviewType;

    const roleLabel = role.trim() || "your target role";

    return {
        question,
        category,
        tips: [
            `Keep your answer relevant to ${roleLabel}.`,
            category === "Behavioral"
                ? "Use a clear Situation, Action, and Result structure."
                : "Define the core concept before giving your example.",
            "Use one practical example instead of listing disconnected facts.",
        ],
    };
}

function createFallbackFeedback(
    answer: string,
    interviewType: string
): Feedback {
    const words = answer.trim() ? answer.trim().split(/\s+/).length : 0;
    const overall = words >= 120 ? 8 : words >= 70 ? 7 : words >= 35 ? 6 : 5;
    const clarity = Math.min(10, overall + (/[.!?]/.test(answer) ? 1 : 0));
    const depth = Math.min(10, Math.max(4, overall + (words >= 100 ? 1 : 0)));
    const relevance = Math.min(10, overall + (words >= 50 ? 1 : 0));

    return {
        overall,
        clarity,
        depth,
        relevance,
        strengths:
            "Your answer addresses the question and provides a clear starting point. You kept the response focused enough to evaluate.",
        improvements:
            interviewType === "Behavioral"
                ? "Add a clearer situation, explain your specific actions, and finish with a measurable result or lesson."
                : "Add more precise technical reasoning, explain why your approach works, and support it with a concrete example or trade-off.",
        model_answer_hint:
            interviewType === "Behavioral"
                ? "Structure your answer as Situation, Task, Action, Result, then briefly state what you learned."
                : "Start with the definition, explain how it works, mention a trade-off, and give one practical example.",
    };
}

function StarScore({
    label,
    score,
}: {
    label: string;
    score: number;
}) {
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
                {"★".repeat(score)}
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
    const [isFallbackMode, setIsFallbackMode] = useState(false);

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
            setError(
                "Voice input is not supported in this browser. Please use Google Chrome or type your answer."
            );
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

            for (
                let i = event.resultIndex;
                i < event.results.length;
                i++
            ) {
                transcript += event.results[i][0].transcript;
            }

            const base = voiceBaseAnswerRef.current;

            setAnswer(
                `${base}${base && transcript.trim() ? " " : ""}${transcript}`.trim()
            );
        };

        recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
            if (event.error !== "no-speech" && event.error !== "aborted") {
                setError(
                    "Voice input stopped unexpectedly. Please try again."
                );
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
        if (isFallbackMode) {
            return createFallbackQuestion(
                questionHistory,
                interviewType,
                role
            );
        }

        const response = await fetch("/api/interview-question", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                role,
                company,
                interviewType,
                experienceLevel,
                previousQuestions: questionHistory,
            }),
        });

        if (!response.ok) {
            const apiError = await getApiError(response);

            if (apiError.status === 429) {
                setIsFallbackMode(true);
                return createFallbackQuestion(
                    questionHistory,
                    interviewType,
                    role
                );
            }

            throw apiError;
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
        setIsLoading(true);
        setError("");
        sessionEndedRef.current = false;
        setIsTimerRunning(false);
        setElapsedSeconds(0);
        setIsFallbackMode(false);

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
        if (!currentQuestion) return;

        stopListening();

        setIsEvaluating(true);
        setError("");

        try {
            let questionFeedback: Feedback;

            if (isFallbackMode) {
                questionFeedback = createFallbackFeedback(
                    answer,
                    interviewType
                );
            } else {
                const response = await fetch("/api/interview-feedback", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        role,
                        interviewType,
                        experienceLevel,
                        question: currentQuestion.question,
                        answer,
                    }),
                });

                if (!response.ok) {
                    const apiError = await getApiError(response);

                    if (apiError.status === 429) {
                        setIsFallbackMode(true);
                        questionFeedback = createFallbackFeedback(
                            answer,
                            interviewType
                        );
                    } else {
                        throw apiError;
                    }
                } else {
                    questionFeedback = (await response.json()) as Feedback;
                }
            }

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
        setIsFallbackMode(false);
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
            (total, result) =>
                total + result.feedback!.overall,
            0
        ) / answeredResults.length
        : null;

    const averageFormula = answeredResults.length
        ? `(${answeredResults
            .map((result) => result.feedback!.overall)
            .join(" + ")}) / ${answeredResults.length} = ${averageScore!.toFixed(
                1
            )}`
        : "No answered questions were available for calculation.";

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
            <div className="space-y-5">
                <h2 className="text-2xl font-bold text-slate-900">
                    Set Up Your Interview
                </h2>

                <input
                    type="text"
                    placeholder="Enter your job role"
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-black"
                />

                <input
                    type="text"
                    placeholder="Enter company name (optional)"
                    value={company}
                    onChange={(event) => setCompany(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-black"
                />

                <div>
                    <label className="font-medium text-slate-700">
                        Interview Type
                    </label>

                    <br />

                    <select
                        value={interviewType}
                        onChange={(event) =>
                            setInterviewType(event.target.value)
                        }
                        className="mt-1 rounded border border-slate-300 p-2"
                    >
                        <option value="Technical">Technical</option>
                        <option value="Behavioral">Behavioral</option>
                        <option value="System Design">System Design</option>
                        <option value="Mixed">Mixed</option>
                    </select>
                </div>

                <div>
                    <label className="font-medium text-slate-700">
                        Experience Level
                    </label>

                    <br />

                    <select
                        value={experienceLevel}
                        onChange={(event) =>
                            setExperienceLevel(event.target.value)
                        }
                        className="mt-1 rounded border border-slate-300 p-2"
                    >
                        <option value="Fresher">Fresher</option>
                        <option value="Junior">Junior</option>
                        <option value="Mid-Level">Mid-Level</option>
                        <option value="Senior">Senior</option>
                    </select>
                </div>

                <div>
                    <label className="font-medium text-slate-700">
                        Number of Questions
                    </label>

                    <br />

                    <input
                        type="range"
                        min="3"
                        max="10"
                        value={questionCount}
                        onChange={(event) =>
                            setQuestionCount(event.target.value)
                        }
                    />

                    <p>Number of Questions: {questionCount}</p>
                </div>

                <button
                    type="button"
                    onClick={startInterview}
                    disabled={isLoading}
                    className={primaryButton}
                >
                    {isLoading
                        ? "GENERATING QUESTION..."
                        : "START INTERVIEW"}
                </button>

                {error && (
                    <p className="text-red-600">{error}</p>
                )}
            </div>
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
                                Average Score{" "}
                                <span className="group relative inline-block">
                                    <button
                                        type="button"
                                        className="rounded-full border border-slate-400 px-1 text-xs"
                                        aria-describedby="average-score-tooltip"
                                    >
                                        i
                                    </button>

                                    <span
                                        id="average-score-tooltip"
                                        role="tooltip"
                                        className="invisible absolute bottom-full left-1/2 z-10 mb-2 w-64 -translate-x-1/2 rounded bg-slate-900 p-2 text-xs text-white opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
                                    >
                                        Calculated using the overall scores from
                                        answered questions only.{" "}
                                        {averageFormula}
                                    </span>
                                </span>
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
                                                <strong>
                                                    Improvements:
                                                </strong>{" "}
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
            {isFallbackMode && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Demo fallback mode is active because the AI request limit was reached. Questions and feedback are local placeholders for testing and should not be presented as Gemini-generated results.
                </div>
            )}

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
                        className="h-full rounded-full bg-blue-600 transition-all duration-500"
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

                <div className="mt-4 flex flex-wrap gap-2">
                    {currentQuestion.tips.map((tip) => (
                        <span
                            key={tip}
                            className="rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-700"
                        >
                            {tip}
                        </span>
                    ))}
                </div>
            </div>

            {!answerSubmitted ? (
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <label className="font-semibold text-slate-800">
                            Your Answer
                        </label>

                        {!isListening ? (
                            <button
                                type="button"
                                onClick={startListening}
                                disabled={isEvaluating}
                                className="rounded-lg bg-red-500 px-4 py-2 font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                🎙️ Start Speaking
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={stopListening}
                                className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-white transition hover:bg-slate-900"
                            >
                                🔴 Stop Listening
                            </button>
                        )}
                    </div>

                    {isListening && (
                        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                            🔴 Listening... Speak your answer clearly.
                        </div>
                    )}

                    <textarea
                        placeholder="Type your answer here or use voice input..."
                        rows={10}
                        value={answer}
                        onChange={(event) => setAnswer(event.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-black"
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
                                ? "EVALUATING ANSWER..."
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
                            {"◆".repeat(feedback.overall)}
                            <span className="text-slate-300">
                                {"◇".repeat(10 - feedback.overall)}
                            </span>
                        </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                        <StarScore
                            label="Clarity"
                            score={feedback.clarity}
                        />
                        <StarScore
                            label="Depth"
                            score={feedback.depth}
                        />
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

                    <div className="rounded-lg border border-blue-200 bg-white p-4">
                        <h3 className="font-bold text-blue-800">
                            Better Answer Hint
                        </h3>

                        <p className="mt-2 text-slate-700">
                            {feedback.model_answer_hint}
                        </p>
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
                                ? "GENERATING QUESTION..."
                                : "Next Question"}
                        </button>
                    )}
                </div>
            ) : null}

            {error && <p className="text-red-600">{error}</p>}
        </section>
    );
}


