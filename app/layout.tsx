'use client'

import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'
import { useEffect } from 'react'
import { initializeDummyData } from '@/lib/dummy-data'

// Note: Cannot export metadata in Client Components
// Moving to separate root layout if needed

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  useEffect(() => {
    initializeDummyData()
  }, [])

  return (
    <html lang="en" className="bg-background">
      <head>
        <title>ZATUC - Zanzibar Trade Union Congress</title>
        <link rel="icon" href="/zatuc-logo.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Zanzibar Trade Union Congress — a united voice for workers across Unguja and Pemba." />
      </head>
      <body className="antialiased bg-background">
        <AuthProvider>
          {children}
          {process.env.NODE_ENV === 'production' && <Analytics />}
        </AuthProvider>
      </body>
    </html>
  )
}
