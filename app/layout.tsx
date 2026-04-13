import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Closer Simulator Pro',
  description: 'Aggressive real estate roleplay coaching simulator powered by OpenAI GPT-4o.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
