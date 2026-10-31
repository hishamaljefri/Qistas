"use client";
import { useEffect, useRef, useState } from "react";
import { ScaleMark } from "@/components/brand/Logo";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";
import { text } from "@/lib/text";

const t = text.waiting;
const LAST = t.steps.length; // step index LAST = all done

// The backend gives no live progress, so the first steps advance on a timer and "تحليل حالتك" (the
// long Gemini call) stays active until the answer arrives; checking citations and computing amounts
// happen right after it on the server, so they are ticked off quickly once the response is in.
const TIMED_STEPS = [1200, 3600]; // ms after start -> steps 1 and 2 become active
const FINISH_TICK_MS = 400;
const SWING_IN_MS = 1200; // matches the q-tilt-in / q-swing keyframes in globals.css
const SWING_MS = 2400;

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The wait between "send" and the result: the scale swings, the steps advance, then the scale settles. */
export function WaitingScreen({
  status,
  error,
  onRetry,
  onEdit,
  onDone,
}: {
  status: "loading" | "success" | "error";
  error?: string;
  onRetry: () => void;
  onEdit: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const [settled, setSettled] = useState(false);
  const started = useRef(0);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    started.current = Date.now();
    const timers = TIMED_STEPS.map((ms, i) => window.setTimeout(() => setStep((s) => Math.max(s, i + 1)), ms));
    return () => timers.forEach(clearTimeout);
  }, []);

  // answer received: tick off the remaining steps
  useEffect(() => {
    if (status !== "success") return;
    const timer = window.setInterval(() => setStep((s) => Math.min(s + 1, LAST)), FINISH_TICK_MS);
    return () => clearInterval(timer);
  }, [status]);

  // all steps done: start settling on the next swing boundary (beam at +9°), so there is no jump
  useEffect(() => {
    if (status !== "success" || step < LAST) return;
    const elapsed = Date.now() - started.current;
    const wait = prefersReducedMotion()
      ? 0
      : elapsed < SWING_IN_MS
        ? SWING_IN_MS - elapsed
        : (SWING_MS - ((elapsed - SWING_IN_MS) % SWING_MS)) % SWING_MS;
    const timer = window.setTimeout(() => setSettled(true), wait);
    return () => clearTimeout(timer);
  }, [status, step]);

  // settled: open the result once the scale is still
  useEffect(() => {
    if (!settled) return;
    const timer = window.setTimeout(() => done.current(), prefersReducedMotion() ? 800 : SWING_MS);
    return () => clearTimeout(timer);
  }, [settled]);

  const failed = status === "error";
  const phase = failed ? "q-phase-error" : settled ? "q-phase-settle" : "q-phase-swing";

  return (
    <section
      aria-labelledby="wait-title"
      className={`mx-auto flex w-full max-w-[760px] flex-col items-center gap-7 px-14 py-12 text-center max-md:px-[18px] max-md:py-7 ${cardClass}`}
    >
      <div className={phase}>
        <ScaleMark className="size-[210px] max-md:size-[170px]" label={failed ? t.tilted : settled ? t.settled : t.swinging} />
      </div>

      {failed ? (
        <>
          <div className="flex flex-col items-center gap-2.5">
            <h1 id="wait-title" className="text-[28px] leading-[1.4] font-semibold max-md:text-2xl">
              {t.errorTitle}
            </h1>
            <p className="max-w-[520px] text-[17px] leading-[1.8] text-muted">{t.errorLine}</p>
          </div>
          <Alert tone="danger" title={t.errorLead} className="w-full text-start">
            {error}
          </Alert>
          <div className="flex flex-wrap justify-center gap-3">
            <Button size="lg" onClick={onRetry}>
              {t.retry}
            </Button>
            <Button size="lg" variant="secondary" onClick={onEdit}>
              {t.edit}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col items-center gap-2.5">
            <h1 id="wait-title" className="text-[28px] leading-[1.4] font-semibold max-md:text-2xl">
              {settled ? t.doneTitle : t.title}
            </h1>
            <p aria-live="polite" className="max-w-[520px] text-[17px] leading-[1.8] text-muted">
              {settled ? t.doneLine : t.stepOf(Math.min(step + 1, LAST), LAST)}
            </p>
          </div>

          <ol aria-label={t.stepsLabel} className="flex w-full max-w-[440px] flex-col gap-1.5 text-start">
            {t.steps.map((label, i) => {
              const isDone = i < step;
              const active = i === step;
              return (
                <li key={label} className={`flex min-h-12 items-center gap-3.5 rounded-control px-3.5 ${active ? "bg-surface-muted" : ""}`}>
                  <span className="flex size-7 shrink-0 items-center justify-center">
                    {isDone ? (
                      <span className="flex size-7 items-center justify-center rounded-full bg-success-bg text-success">
                        <Icon name="check" className="size-4" />
                      </span>
                    ) : active ? (
                      <Spinner className="size-5 text-primary" />
                    ) : (
                      <span className="size-3.5 rounded-full border-2 border-line-strong" />
                    )}
                  </span>
                  <span className={`${active ? "font-semibold" : ""} ${isDone || active ? "text-text" : "text-muted"}`}>
                    {label}
                    <span className="sr-only">{isDone ? t.state.done : active ? t.state.active : t.state.pending}</span>
                  </span>
                </li>
              );
            })}
          </ol>

          {settled ? (
            <Button size="lg" onClick={onDone}>
              {t.showResult}
              <Icon name="arrowForward" />
            </Button>
          ) : (
            <p className="text-sm leading-[1.7] text-muted">{t.stay}</p>
          )}
        </>
      )}
    </section>
  );
}
