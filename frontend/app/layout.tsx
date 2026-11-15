import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Cinzel, Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const cinzel = Cinzel({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-cinzel' })
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' })

export const metadata: Metadata = {
  title: 'ACHILLES · Every app has a weak point',
  description:
    'A security scanner for web apps you own. Achilles runs real tools against your site, shows what they found, and writes fixes you can paste into your AI coding tool.',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0b141f',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${cinzel.variable} ${inter.variable} ${jetbrainsMono.variable} bg-background`}
      suppressHydrationWarning
    >
      {/* Browser extensions add attributes to <html> and <body> before React hydrates. */}
      <body className="antialiased" suppressHydrationWarning>
        {children}
        {process.env.VERCEL && <Analytics />}
      </body>
    </html>
  )
}
