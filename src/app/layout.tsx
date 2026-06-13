import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '직무테스트 | 화물맨',
  description: '화물맨 CS팀 직무테스트 시스템',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-gray-50 antialiased">
        {children}
      </body>
    </html>
  );
}
