import type { Metadata } from "next";
import "./globals.css";
import {I18nProvider} from '../components/I18n';

export const metadata: Metadata = {
  title: "家庭财务中心",
  description: "管理资产、现金流与每一项生活计划。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased"><I18nProvider>{children}</I18nProvider></body>
    </html>
  );
}
