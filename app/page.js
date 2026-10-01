"use client";

import { useEffect, useMemo, useState } from "react";

function getClientContext() {
  const now = new Date();
  return {
    locale: navigator.language || "tr-TR",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Istanbul",
    localIso: now.toISOString(),
    localHour: now.getHours(),
    localDay: now.toLocaleDateString("tr-TR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
  };
}

function fallbackGreeting(hour) {
  const salutation = hour < 5 ? "İyi geceler" : hour < 11 ? "Günaydın" : hour < 17 ? "İyi günler" : hour < 23 ? "İyi akşamlar";
  return `${salutation}, ben HDI Sigorta Dijital Asistanı TalhaGPT. Size nasıl yardımcı olabilirim?`;
}

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState({});
  const [meta, setMeta] = useState(null);
  const [quickActions, setQuickActions] = useState([]);
  const [showDemo, setShowDemo] = useState(false);
  const [showOps, setShowOps] = useState(false);

  const examples = useMemo(() => [
    "Hasar dosyamın durumunu öğrenmek istiyorum"
  ], []);

  async function bootstrap() {
    const clientContext = getClientContext();
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bootstrap: true, clientContext })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Karşılama oluşturulamadı");
      setMessages([{ role: "assistant", content: data.message }]);
      setSession(data.session || {});
      setMeta(data);
    } catch {
      setMessages([{ role: "assistant", content: fallbackGreeting(clientContext.localHour) }]);
      setSession({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { bootstrap(); }, []);

  async function send(content = text) {
    const value = String(content || "").trim();
    if (!value || loading) return;

    const nextMessages = [...messages, { role: "user", content: value }];
    setMessages(nextMessages);
    setText("");
    setQuickActions([]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, session, clientContext: getClientContext() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "İstek başarısız");

      setMessages((m) => [...m, { role: "assistant", content: data.message }]);
      setSession(data.session || {});
      setMeta(data);
      setQuickActions(Array.isArray(data.quickActions) ? data.quickActions : []);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: `Şu anda yanıt oluşturamadım. Teknik detay: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  async function reset() {
    setMessages([]);
    setText("");
    setSession({});
    setMeta(null);
    setQuickActions([]);
    await bootstrap();
  }

  return (
    <main className="shell">
      <section className="appCard">
        <header className="topbar">
          <div className="brand">
            <div className="logo">HDI</div>
            <div>
              <strong>TalhaGPT · Dijital Asistan</strong>
              <span>Dosya Bilgi PoC · AI Orchestration V5</span>
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
            <b>Sentetik PoC verileri</b>
            <p><b>Sigortalı:</b> TCKN 11111111111 · dosya 294551 / 281204 · poliçe 2000294688416 / 2000294000001 · plaka 16AD630</p>
            <p><b>Mağdur:</b> TCKN 22222222222 · dosya 294551 · plaka 16CAF273</p>
            <p><b>Servis:</b> servis kodu 3840 · VKN 6360039002 · dosya 294551 / 281204</p>
            <p><b>Acente:</b> partaj 7693 · dosya 294551 / 281204 · plaka 16AD630</p>
            <p><b>Claim selection:</b> 15 Mart 2026 → 281204 · 2 Temmuz 2026 → 294551</p>
            <small>Gerçek kişi verisi değildir. İkinci dosya, çoklu dosya seçim davranışını test etmek için sentetik olarak eklenmiştir.</small>
          </div>
        )}

        {showOps && meta && (
          <div className="opsBox">
            <div><span>Diyalog</span><b>{meta.plan?.dialogueAct || "-"}</b></div>
            <div><span>Niyet</span><b>{(meta.plan?.intents || []).join(", ") || "-"}</b></div>
            <div><span>Rol</span><b>{meta.session?.role || "-"}</b></div>
            <div><span>Doğrulama</span><b>{meta.session?.verification?.status || "-"}</b></div>
            <div><span>Kanıt</span><b>{Object.keys(meta.session?.verification?.verifiedFields || {}).join(", ") || "-"}</b></div>
            <div><span>Aktif Dosya</span><b>{meta.session?.activeClaimNo || "-"}</b></div>
            <div><span>Aday Dosya</span><b>{meta.session?.candidateClaims?.length ?? 0}</b></div>
            <div><span>Tool</span><b>{(meta.toolTrace || []).map((x) => x.name).join(" → ") || "-"}</b></div>
            <div><span>Kayıt Türü</span><b>{meta.task?.kayitTuru || "-"}</b></div>
            <div><span>Model</span><b>{meta.model || "-"}</b></div>
          </div>
        )}

        <div className="messages">
          {messages.map((m, i) => (
            <div key={i} className={`row ${m.role}`}>
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

        {!loading && quickActions.length > 0 && (
          <div className="quickActions">
            {quickActions.map((a) => <button key={`${a.label}-${a.value}`} onClick={() => send(a.value)}>{a.label}</button>)}
          </div>
        )}

        {messages.length === 1 && quickActions.length === 0 && (
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

        <footer>AI konuşmayı planlar · Tool'lar gerçeği doğrular · Guardrail'ler sınırı çizer · AI doğal cevabı üretir</footer>
      </section>
    </main>
  );
}
