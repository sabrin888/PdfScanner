import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { I18nProvider } from "@/context/I18nContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF Editor | Tafatiraha PDF",
  description: "Edit, annotate, OCR and sign PDF files — supports English and Somali",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-slate-50 dark:bg-slate-900 min-h-screen">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <I18nProvider>
            {children}
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
