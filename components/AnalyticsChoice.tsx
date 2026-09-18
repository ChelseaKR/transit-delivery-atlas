"use client";

import { useState, useSyncExternalStore } from "react";
import {
  OPT_OUT_MESSAGES,
  analyticsEnabled,
  choiceSnapshot,
  readStorage,
  setOptedOut,
  type ChoiceSnapshot,
} from "@/lib/analytics";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function snapshot(): ChoiceSnapshot {
  return choiceSnapshot(window);
}

/** The prerendered page cannot know this browser's choice, so it renders none. */
function serverSnapshot(): ChoiceSnapshot | null {
  return null;
}

const STANDING_MESSAGE: Record<ChoiceSnapshot, string> = {
  signal: OPT_OUT_MESSAGES.signal,
  "no-storage": OPT_OUT_MESSAGES.noStorage,
  out: OPT_OUT_MESSAGES.isOut,
  in: "",
};

/**
 * The footer's "Opt out of analytics" / "Opt back in" control (ADR 0003).
 *
 * A button, not a link, because it changes a setting rather than going anywhere.
 * It appears only after hydration: the static HTML cannot know what this browser
 * chose, and rendering a guess would be a hydration mismatch. The status line is
 * always present so a screen reader hears each change. Under GPC or DNT, or with
 * storage blocked, there is no button and the status line says why.
 */
export function AnalyticsChoice() {
  const state = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const [said, setSaid] = useState<string | null>(null);

  if (!analyticsEnabled()) return null;

  function toggle() {
    const storage = readStorage(window);
    try {
      if (storage === null) throw new Error("storage blocked");
      const optingOut = state !== "out";
      setOptedOut(storage, window, optingOut);
      setSaid(optingOut ? OPT_OUT_MESSAGES.optedOut : OPT_OUT_MESSAGES.backIn);
    } catch {
      setSaid(OPT_OUT_MESSAGES.noStorage);
    }
    for (const listener of listeners) listener();
  }

  const showButton = state === "in" || state === "out";
  return (
    <p className="site-footer__analytics">
      {showButton ? (
        <button type="button" className="site-footer__analytics-toggle" onClick={toggle}>
          {state === "out" ? "Opt back in" : "Opt out of analytics"}
        </button>
      ) : null}{" "}
      <span role="status">{said ?? (state === null ? "" : STANDING_MESSAGE[state])}</span>
    </p>
  );
}
