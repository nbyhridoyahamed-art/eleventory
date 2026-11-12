"use client";

import { create } from "zustand";

interface ThemePreviewState {
  /** Logo of the draft theme while previewing, so the header shows it before it is published. */
  logoUrl: string | null;
  active: boolean;
  set: (active: boolean, logoUrl: string | null) => void;
}

export const useThemePreviewStore = create<ThemePreviewState>((set) => ({
  logoUrl: null,
  active: false,
  set: (active, logoUrl) => set({ active, logoUrl }),
}));
