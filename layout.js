import "./globals.css";

export const metadata = {
  title: "HDI Dijital Asistan",
  description: "Dosya Bilgi Chatbot PoC"
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
