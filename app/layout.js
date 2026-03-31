import './globals.css'
import MainLayout from './components/layout/MainLayout.jsx'
import { AuthProvider } from './components/auth/AuthProvider.jsx'
import { SpeedInsights } from '@vercel/speed-insights/next'

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
        <script
          dangerouslySetInnerHTML={{
            __html: `(function () {
  try {
    if (typeof window === 'undefined') return;
    if (window.__aaRuntimeNoiseGuardInstalled) return;
    window.__aaRuntimeNoiseGuardInstalled = true;
    var EXTENSION_ORIGIN = 'chrome-extension://';
    var toErrorText = function (value) {
      if (!value) return '';
      if (typeof value === 'string') return value;
      if (typeof value.message === 'string') return value.message;
      if (value.reason && typeof value.reason.message === 'string') return value.reason.message;
      if (value.error && typeof value.error.message === 'string') return value.error.message;
      return '';
    };
    var toStack = function (value) {
      if (!value) return '';
      if (typeof value.stack === 'string') return value.stack;
      if (value.reason && typeof value.reason.stack === 'string') return value.reason.stack;
      if (value.error && typeof value.error.stack === 'string') return value.error.stack;
      return '';
    };
    var toFilename = function (value) {
      if (!value) return '';
      return String(value.filename || value.fileName || (value.reason && value.reason.fileName) || '').trim();
    };
    var isExtensionRuntimeNoise = function (event) {
      var stack = toStack(event);
      var filename = toFilename(event);
      return (
        filename.indexOf(EXTENSION_ORIGIN) === 0 ||
        stack.indexOf(EXTENSION_ORIGIN) !== -1
      );
    };
    var handleError = function (event) {
      if (!isExtensionRuntimeNoise(event)) return;
      if (event.preventDefault) event.preventDefault();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      return true;
    };
    var handleUnhandledRejection = function (event) {
      if (!isExtensionRuntimeNoise(event)) return;
      if (event.preventDefault) event.preventDefault();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    };
    window.addEventListener('error', handleError, true);
    window.addEventListener('unhandledrejection', handleUnhandledRejection, true);
    var previousOnError = window.onerror;
    window.onerror = function (message, source, lineno, colno, error) {
      if (
        isExtensionRuntimeNoise({
          message: message,
          filename: source,
          error: error,
        })
      ) {
        return true;
      }
      if (typeof previousOnError === 'function') {
        return previousOnError(message, source, lineno, colno, error);
      }
      return false;
    };
  } catch (_ignored) {}
})();`,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          <MainLayout>
            {children}
          </MainLayout>
        </AuthProvider>
        <SpeedInsights />
      </body>
    </html>
  )
}
