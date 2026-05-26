"use client";

import React, { createContext, useContext, useCallback } from "react";
import { en } from "@/i18n/en";

interface I18nContextValue {
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue>({ t: (k) => k });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const t = useCallback((key: string) => en[key] ?? key, []);
  return <I18nContext.Provider value={{ t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
