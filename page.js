"use client";

import { useMemo, useState } from "react";

const initial = [
  {
    role: "assistant",
    content: "Merhaba, ben HDI Sigorta Dijital Asistanı. Size nasıl yardımcı olabilirim?"
  }
];

export default function Home() {
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState(null);
  const [showDemo, setShowDemo] = useState(false);
  const [showOps, setShowOps] = useState(false);

  const examples = useMemo(() => [
    "Merhaba",
    "Hasar dosyamın durumunu öğrenmek istiyorum",
    "Eksik evrak var mı?",
    "Eksper raporu geldi mi?"
  ], []);

  async function send(content = text) {
    const value = String(content || "").trim();
    if (!value || loading) return;
    const next = [...messages, { role: "user", content: value }];
    setMessages(next);
    setText("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "İstek başarısız");
      setMessages((m) => [...m, { role: "assistant", content: data.message }]);
      setMeta(data);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: `Şu anda yanıt oluşturamadım. Teknik detay: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setMessages(initial);
    setMeta(null);
    setText("");
  }

  return (
    <main className="shell">
      <section className="appCard">
        <header className="topbar">
          <div className="brand">
            <div className="logo">HDI</div>
            <div>
              <strong>Dijital Asistan</strong>
              <span>Dosya Bilgi PoC · Canlı yapay zekâ</span>
            </div>
          </div>
          <div className="status"><i /> Çevrimiçi</div>
        </header>

        <div className="toolbar">
          <button onClick={() => setShowDemo((v) => !v)}>Demo doğrulama bilgileri</button>
          <button onClick={() => setShowOps((v) => !v)}>Operasyon görünümü</button>
          <button className="ghost" onClick={reset}>Yeni sohbet</button>
        </div>

        {showDemo && (
          <div className="demoBox">
            <b>Test için sentetik bilgiler</b>
            <p><b>Sigortalı:</b> TCKN 11111111111 + dosya 294551</p>
            <p><b>Mağdur:</b> TCKN 22222222222 + dosya 294551</p>
            <p><b>Servis:</b> servis kodu 3840 + dosya 294551</p>
            <p><b>Acente:</b> partaj 7693 + dosya 294551</p>
            <small>Gerçek kişi verisi değildir; response yapısı korunarak maskelenmiş PoC verisidir.</small>
          </div>
        )}

        {showOps && meta && (
          <div className="opsBox">
            <div><span>Niyet</span><b>{meta.intent}</b></div>
            <div><span>Doğrulama</span><b>{meta.verification?.status || "-"}</b></div>
            <div><span>Rol</span><b>{meta.verification?.role || "-"}</b></div>
            <div><span>Kayıt Türü</span><b>{meta.task?.kayitTuru || "-"}</b></div>
            <div><span>Kategori</span><b>{[meta.task?.anaKategori, meta.task?.altKategori, meta.task?.altAltKategori].filter(Boolean).join(" › ") || "-"}</b></div>
            <div><span>Model</span><b>{meta.model || "-"}</b></div>
          </div>
        )}

        <div className="messages">
          {messages.map((m, idx) => (
            <div key={idx} className={`row ${m.role}`}>
              {m.role === "assistant" && <div className="avatar">AI</div>}
              <div className="bubble">{m.content}</div>
            </div>
          ))}
          {loading && (
            <div className="row assistant">
              <div className="avatar">AI</div>
              <div className="bubble typing"><span/><span/><span/></div>
            </div>
          )}
        </div>

        {messages.length === 1 && (
          <div className="suggestions">
            {examples.map((x) => <button key={x} onClick={() => send(x)}>{x}</button>)}
          </div>
        )}

        <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Mesajınızı yazın..."
            rows={1}
          />
          <button type="submit" disabled={loading || !text.trim()}>Gönder</button>
        </form>
        <footer>Bu ekran PoC amaçlıdır. Canlı sistemlerde kimlik doğrulama ve veri paylaşımı backend güvenlik katmanlarıyla uygulanmalıdır.</footer>
      </section>
    </main>
  );
}
