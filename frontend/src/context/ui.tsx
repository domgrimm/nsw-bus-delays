"use client";

import { createContext, useContext, useState } from "react";

import type { Period } from "@/types";

interface UIContextValue {
  selectedPeriod: Period;
  setSelectedPeriod: (p: Period) => void;
  customFrom: string;
  setCustomFrom: (v: string) => void;
  customTo: string;
  setCustomTo: (v: string) => void;
}

const UIContext = createContext<UIContextValue>({
  selectedPeriod: "day",
  setSelectedPeriod: () => {},
  customFrom: "",
  setCustomFrom: () => {},
  customTo: "",
  setCustomTo: () => {},
});

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("day");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  return (
    <UIContext.Provider
      value={{
        selectedPeriod,
        setSelectedPeriod,
        customFrom,
        setCustomFrom,
        customTo,
        setCustomTo,
      }}
    >
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  return useContext(UIContext);
}
