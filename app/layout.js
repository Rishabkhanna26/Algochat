import './globals.css'
import MainLayout from './components/layout/MainLayout.jsx'
import { AuthProvider } from './components/auth/AuthProvider.jsx'

export const metadata = {
  title: 'AlgoChat - WhatsApp CRM Dashboard',
  description: 'Manage your WhatsApp conversations, leads, and broadcasts',
  icons: {
    icon: '/cropped_image-2026-03-09T09-25-38.png',
    shortcut: '/cropped_image-2026-03-09T09-25-38.png',
    apple: '/cropped_image-2026-03-09T09-25-38.png',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="preload"
          as="image"
          href="/cropped_image-2026-03-09T09-25-38.png"
        />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          <MainLayout>
            {children}
          </MainLayout>
        </AuthProvider>
      </body>
    </html>
  )
}
