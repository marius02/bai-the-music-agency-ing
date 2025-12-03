import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ING Music Experience | Your Financial Journey Soundtrack',
  description: 'Transform your ING banking experience into personalized music. Create unique soundtracks that capture your financial journey with ING.',
  keywords: ['ING', 'Music Generation', 'Banking Experience', 'Financial Journey'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        {/* Floating Bubbles Background */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          {[...Array(15)].map((_, i) => (
            <div
              key={i}
              className="bubble"
              style={{
                left: `${Math.random() * 100}%`,
                width: `${Math.random() * 60 + 20}px`,
                height: `${Math.random() * 60 + 20}px`,
                animationDuration: `${Math.random() * 10 + 10}s`,
                animationDelay: `${Math.random() * 5}s`,
              }}
            />
          ))}
        </div>
      </body>
    </html>
  )
}
