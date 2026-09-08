import SetupForm from "@/components/SetupForm";
import ThemeToggle from "@/components/ThemeToggle";

export default function Home() {
  return (
    <main className="quest-world">
      {/* Space background */}
      <div className="quest-stars" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>

      {/* Decorative HUD corners */}
      <div className="hud-corner hud-corner-top-left" aria-hidden="true" />
      <div className="hud-corner hud-corner-top-right" aria-hidden="true" />
      <div
        className="hud-corner hud-corner-bottom-left"
        aria-hidden="true"
      />
      <div
        className="hud-corner hud-corner-bottom-right"
        aria-hidden="true"
      />

      <div className="quest-shell">
        {/* HEADER */}
        <header className="quest-header">
          <div className="quest-brand">
            <p className="terminal-label">
              AI INTERVIEW SIMULATOR
            </p>

            <h1 className="quest-title">
              INTERVIEW QUEST
            </h1>

            <p className="quest-subtitle">
              TRAIN <span>•</span> ANSWER <span>•</span> IMPROVE
            </p>
          </div>

          <div className="quest-header-right">
            <div className="terminal-status">
              <div className="signal-bars" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>

              <div>
                <p>TERMINAL_01</p>
                <span>
                  STATUS: <strong>READY</strong>
                </span>
              </div>
            </div>

            <ThemeToggle />
          </div>
        </header>

        {/* SYSTEM DIVIDER */}
        <div
          className="system-divider"
          aria-hidden="true"
        >
          <span />
          <b>✦</b>
          <span />
        </div>

        {/* MAIN APPLICATION */}
        <section className="quest-console">
          <div
            className="console-corner console-corner-tl"
            aria-hidden="true"
          />
          <div
            className="console-corner console-corner-tr"
            aria-hidden="true"
          />
          <div
            className="console-corner console-corner-bl"
            aria-hidden="true"
          />
          <div
            className="console-corner console-corner-br"
            aria-hidden="true"
          />

          <SetupForm />
        </section>

        {/* Bottom HUD */}
        <div
          className="bottom-hud"
          aria-hidden="true"
        >
          <span />
          <span />
          <span />
        </div>
      </div>
    </main>
  );
}