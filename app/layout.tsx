import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Instagram Analyzer",
  description: "Analyze public Instagram metrics and compare accounts",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <header className="header">
            <h1>Instagram Analyzer</h1>
            <p>Compare public metrics for multiple Instagram accounts</p>
          </header>
          <main>{children}</main>
          <footer className="footer">Built for analysis of public data</footer>
        </div>
      </body>
    </html>
  );
}
