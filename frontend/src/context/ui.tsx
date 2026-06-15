"use client";

import { createContext, useContext, useState } from "react";

import type { Period } from "@/types";

interface UIContextValue {
  selectedPeriod: Period;
  setSelectedPeriod: (p: Period) => void;
}

const UIContext = createContext<UIContextValue>({
  selectedPeriod: "day",
  setSelectedPeriod: () => {},
});

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("day");
  return (
    <UIContext.Provider value={{ selectedPeriod, setSelectedPeriod }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  return useContext(UIContext);
}
