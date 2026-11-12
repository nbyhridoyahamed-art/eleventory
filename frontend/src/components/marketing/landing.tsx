"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

import "./landing.css";
import { LANDING_HTML } from "./landing-html";
import { initLanding } from "./landing-behaviour";

/**
 * The Eleventory marketing page. The markup and CSS are generated from brand/site.src.html by
 * brand/make-landing.js (static, first-party content, no user input), and landing-behaviour.ts wires
 * the 3D scroll story, seller tabs, language switch and theme button.
 */
export function Landing() {
  const host = useRef<HTMLDivElement>(null);
  const { resolvedTheme, setTheme } = useTheme();
  const theme = useRef(resolvedTheme);

  useEffect(() => {
    theme.current = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    const root = host.current?.querySelector<HTMLElement>("#mk-root");
    if (!root) return;

    return initLanding(root, { toggleTheme: () => setTheme(theme.current === "dark" ? "light" : "dark") });
  }, [setTheme]);

  return <div ref={host} dangerouslySetInnerHTML={{ __html: LANDING_HTML }} />;
}
