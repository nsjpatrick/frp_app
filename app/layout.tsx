import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProviderWrapper } from "@/components/SessionProviderWrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'JobCalc Neo | Plas-Tanks Industries, Inc.',
  description: 'FRP tank quoting and engineering configurator for Plas-Tanks Industries.',
  // Safari ignores @media queries inside an SVG favicon, so we split the
  // mark into light + dark files and route between them with media-
  // qualified <link> tags. Chrome/Edge/Firefox all respect this too.
  icons: {
    icon: [
      { url: '/icon-light.svg', type: 'image/svg+xml', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark.svg',  type: 'image/svg+xml', media: '(prefers-color-scheme: dark)'  },
    ],
  },
};

// Runs synchronously before hydration so <html data-theme="dark"> is set
// before any pixels paint — avoids a white flash for dark-mode users.
// We target `data-theme` (attribute) rather than a class because React's
// hydration reconciles JSX-declared className properties back to the
// server-rendered value, which briefly strips a class added here.
// Attributes not declared in JSX survive untouched.
//
// Stored preference is 'system' | 'light' | 'dark'; we resolve 'system'
// to the OS's prefers-color-scheme and write the concrete value.
const themeInit = `
(function(){try{var t=localStorage.getItem('theme')||'system';var r=t==='dark'?'dark':t==='light'?'light':matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=r;document.documentElement.dataset.themePreference=t;}catch(e){}})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // The pre-hydration theme script below mutates this element's
      // className + data-theme before React hydrates, producing a
      // server/client mismatch. The warning is the documented price of
      // doing theme detection without a flash of unstyled content.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full flex flex-col">
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  );
}
