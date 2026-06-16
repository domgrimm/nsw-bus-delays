"use client";

import { createContext, useContext, useState } from "react";

import type { Period } from "@/types";

interface UIContextValue {
  selectedPeriod: Period;
  setSelectedPeriod: (p: Period) => void;
  useMock: boolean;
  setUseMock: (v: boolean) => void;
}

const UIContext = createContext<UIContextValue>({
  selectedPeriod: "day",
  setSelectedPeriod: () => {},
  useMock: true,
  setUseMock: () => {},
});

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("day");
  const [useMock, setUseMock] = useState(true);
  return (
    <UIContext.Provider value={{ selectedPeriod, setSelectedPeriod, useMock, setUseMock }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  return useContext(UIContext);
}
