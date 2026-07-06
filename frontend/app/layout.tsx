import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const noto = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "デートプラン",
  description: "出発地と行きたい場所から、1日のデートプランを自動で作ります",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className={`${noto.variable} font-sans antialiased`}>
        <header className="glass mx-4 mt-4 px-5 py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <h1 className="text-lg font-bold tracking-wide text-[#5c4030]">Date Planner</h1>
            <p className="text-sm text-[#7a6555]">1日のデートプランを自動作成</p>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
