import type { Metadata } from "next";

import Providers from "./providers";
import ErrorBoundary from "@/components/ErrorBoundary";
import Header from "@/components/Header";
import { ToastProvider } from "@/context/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "NSW Bus Delays",
  description: "Monitor real-time bus delays for Transport for NSW services",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <ToastProvider>
            <Header />
            <main>
              <ErrorBoundary>{children}</ErrorBoundary>
            </main>
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
