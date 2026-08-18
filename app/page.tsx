import SetupForm from "@/components/SetupForm";
import ThemeToggle from "@/components/ThemeToggle";

export default function Home() {
  return (
    <main className="dino-world relative min-h-screen overflow-hidden">
      {/* Decorative sky */}
      <div className="pixel-sun" aria-hidden="true" />
      <div className="pixel-moon" aria-hidden="true" />

      <div className="pixel-cloud pixel-cloud-one" aria-hidden="true" />
      <div className="pixel-cloud pixel-cloud-two" aria-hidden="true" />
      <div className="pixel-cloud pixel-cloud-three" aria-hidden="true" />

      {/* Decorative night stars */}
      <div className="pixel-stars" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>

      {/* Desert landscape */}
      <div className="desert-landscape" aria-hidden="true">
        <div className="mountain mountain-left" />
        <div className="mountain mountain-center" />
        <div className="mountain mountain-right" />

        <div className="land-cactus cactus-one">🌵</div>
        <div className="land-cactus cactus-two">🌵</div>
        <div className="land-cactus cactus-three">🌵</div>
        <div className="land-cactus cactus-four">🌵</div>

        <div className="desert-rock rock-one" />
        <div className="desert-rock rock-two" />
      </div>

      {/* Main app */}
      <div className="relative z-10 mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="dino-header mb-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="hud-label">AI INTERVIEW SIMULATOR</p>

              <h1 className="dino-title">
                INTERVIEW QUEST
              </h1>

              <p className="hud-subtitle">
                TRAIN • ANSWER • LEVEL UP
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="hud-status">
                <span className="status-dot" />
                READY
              </div>

              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Your existing working app */}
        <SetupForm />
      </div>
    </main>
  );
}