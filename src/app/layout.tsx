import type { Metadata, Viewport } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const fontDisplay = Inter({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["600", "700"],
});

const fontMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vvexplore",
  description: "Interactive Vvexplore map and run-of-show schedule.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Vvexplore",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", sizes: "100x100" },
      { url: "/icon-192.png", sizes: "192x192" },
      { url: "/icon-512.png", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable}`}
    >
      {/* suppressHydrationWarning: the inline script below swaps the theme
          class from localStorage before hydration, on every route (admin
          included) — the SSR default is portal-dark. */}
      <body className="portal-dark" suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("portal-theme");if(t==="letterpress"||t==="light"){document.body.classList.remove("portal-dark","portal-dusk");document.body.classList.add("portal-light");}else if(t==="dusk"){document.body.classList.remove("portal-dark","portal-light");document.body.classList.add("portal-dusk");}else{document.body.classList.add("portal-dark");document.body.classList.remove("portal-light","portal-dusk");}}catch(e){}})();`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
