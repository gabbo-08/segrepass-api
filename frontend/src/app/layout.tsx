import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Piano di Studi',
  description: 'Gestione carriera e piano di studi',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body suppressHydrationWarning className="bg-zinc-950 text-zinc-100">
        {children}
      </body>
    </html>
  );
}