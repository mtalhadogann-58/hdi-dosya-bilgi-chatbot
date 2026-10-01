import "./globals.css";

export const metadata = {
  title: "HDI Dijital Asistan",
  description: "HDI Dosya Bilgi AI Assistant PoC"
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
