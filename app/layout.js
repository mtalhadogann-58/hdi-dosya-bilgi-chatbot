import "./globals.css";

export const metadata = {
  title: "TalhaGPT · HDI Dijital Asistan",
  description: "HDI Dosya Bilgi AI Agent V5 PoC"
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
