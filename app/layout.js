import "./globals.css";

export const metadata = {
  title: "Dijital Asistan",
  description: "Dosya Bilgi AI Assistant TEST SÜRÜMÜ"
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
