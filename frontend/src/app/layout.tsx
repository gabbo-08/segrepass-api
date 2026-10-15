import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Segrepass 2.0",
  description: "Dashboard Carriera Universitaria",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body className="min-h-full flex flex-col antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}