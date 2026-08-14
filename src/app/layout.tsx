import type { Metadata } from "next";
import { Geist, Geist_Mono, Cairo } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "أورمنال — نظام إدارة موارد المؤسسات ERP",
  description: "نظام إدارة موارد المؤسسات ERP متكامل لإدارة المبيعات والمشتريات والمخزون والمحاسبة والمالية",
  keywords: ["محاسبة", "إدارة", "ERP", "فواتير", "قيود", "مخزون"],
  authors: [{ name: "Ormenal" }],
  icons: {
    icon: "/logo.png",
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined') {
                const removeBis = (node) => {
                  if (node.nodeType === 1 && node.hasAttribute('bis_skin_checked')) {
                    node.removeAttribute('bis_skin_checked');
                  }
                  if (node.children) {
                    for (let i = 0; i < node.children.length; i++) {
                      removeBis(node.children[i]);
                    }
                  }
                };
                const observer = new MutationObserver((mutations) => {
                  for (const m of mutations) {
                    if (m.type === 'attributes' && m.attributeName === 'bis_skin_checked') {
                      m.target.removeAttribute('bis_skin_checked');
                    } else if (m.type === 'childList') {
                      m.addedNodes.forEach(removeBis);
                    }
                  }
                });
                observer.observe(document.documentElement, {
                  attributes: true,
                  childList: true,
                  subtree: true,
                  attributeFilter: ['bis_skin_checked'],
                });
              }
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${cairo.variable} antialiased bg-background text-foreground`}
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
        <Toaster />
        <SonnerToaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
