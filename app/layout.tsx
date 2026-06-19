import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Xpense • Travel Expenses",
  description: "Simple shared travel expense tracking. No passwords — just name + phone.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[#f8fafc] text-[#0f172a] min-h-screen">
        <div className="max-w-2xl mx-auto min-h-screen flex flex-col">
          {children}
        </div>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
