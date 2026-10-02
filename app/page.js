"use client";

import {
  useEffect,
  useRef,
  useState
} from "react";

function getClientContext() {
  const now = new Date();

  return {
    locale:
      navigator.language || "tr-TR",

    timeZone:
      Intl.DateTimeFormat()
        .resolvedOptions()
        .timeZone || "Europe/Istanbul",

    localIso: now.toISOString(),

    localHour: now.getHours(),

    localDay:
      now.toLocaleDateString(
        "tr-TR",
        {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric"
        }
      )
  };
}

function fallbackGreeting(hour) {
  const salutation =
    hour < 5
      ? "İyi geceler"
      : hour < 11
      ? "Günaydın"
      : hour < 18
      ? "İyi günler"
      : "İyi akşamlar";

  return `${salutation}, ben HDI Sigorta Dijital Asistanı TalhaGPT. Size nasıl yardımcı olabilirim?`;
}

function looksLikeCriticalIdentifier(
  text = ""
) {
  const compact =
    String(text)
      .toLocaleUpperCase("tr-TR")
      .replace(/\s+/g, " ")
      .trim();

  const keywordHit =
    /(TCKN|TC K[İI]ML[İI]K|VKN|PARTAJ|DOSYA NUMARA|POL[İI]ÇE NUMARA|PLAKA)/i
      .test(compact);

  const longNumber =
    /\b\d[\d\s-]{5,}\d\b/
      .test(compact);

  const plateLike =
    /\b\d{2}\s*[A-ZÇĞİÖŞÜ]{1,3}\s*\d{2,5}\b/u
      .test(compact);

  return (
    keywordHit ||
    longNumber ||
    plateLike
  );
}

function pickRecordingMimeType() {
  if (
    typeof MediaRecorder ===
    "undefined"
  ) {
    return "";
  }

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4"
  ];

  return (
    candidates.find(
      (x) =>
        MediaRecorder
          .isTypeSupported?.(x)
    ) || ""
  );
}

export default function Home() {
  const [
    messages,
    setMessages
  ] = useState([]);

  const [
    text,
    setText
  ] = useState("");

  const [
    loading,
    setLoading
  ] = useState(false);

  const [
    session,
    setSession
  ] = useState({});

  const [
    meta,
    setMeta
  ] = useState(null);

  const [
    quickActions,
    setQuickActions
  ] = useState([]);

  const [
    showDemo,
    setShowDemo
  ] = useState(false);

  const [
    showOps,
    setShowOps
  ] = useState(false);

  const [
    voiceMode,
    setVoiceMode
  ] = useState(false);

  const [
    recording,
    setRecording
  ] = useState(false);

  const [
    transcribing,
    setTranscribing
  ] = useState(false);

  const [
    speaking,
    setSpeaking
  ] = useState(false);

  const [
    voiceError,
    setVoiceError
  ] = useState("");

  const [
    lastTranscript,
    setLastTranscript
  ] = useState("");

  const [
    pendingTranscript,
    setPendingTranscript
  ] = useState("");

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const audioRef = useRef(null);
  const audioUrlRef = useRef(null);

  async function bootstrap() {
    const clientContext =
      getClientContext();

    setLoading(true);

    try {
      const res =
        await fetch(
          "/api/chat",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                bootstrap: true,
                clientContext
              })
          }
        );

      const data =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
          "Karşılama oluşturulamadı"
        );
      }

      setMessages([
        {
          role: "assistant",
          content: data.message
        }
      ]);

      setSession(
        data.session || {}
      );

      setMeta(data);

    } catch {
      setMessages([
        {
          role: "assistant",
          content:
            fallbackGreeting(
              clientContext.localHour
            )
        }
      ]);

      setSession({});

    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    bootstrap();

    return () => {
      stopCurrentAudio();
      stopMicrophoneStream();
    };
  }, []);

  function stopMicrophoneStream() {
    if (streamRef.current) {
      for (
        const track of
        streamRef.current.getTracks()
      ) {
        track.stop();
      }

      streamRef.current = null;
    }
  }

  function stopCurrentAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(
        audioUrlRef.current
      );

      audioUrlRef.current = null;
    }

    setSpeaking(false);
  }

  async function speakText(
    content,
    options = {}
  ) {
    const value =
      String(content || "")
        .trim();

    const force =
      Boolean(options.force);

    if (
      !value ||
      (!voiceMode && !force)
    ) {
      return;
    }

    stopCurrentAudio();
    setVoiceError("");

    try {
      setSpeaking(true);

      const res =
        await fetch(
          "/api/voice/speak",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                text: value
              })
          }
        );

      if (!res.ok) {
        const detail =
          await res
            .json()
            .catch(() => ({}));

        throw new Error(
          detail.error ||
          "Ses üretilemedi"
        );
      }

      const blob =
        await res.blob();

      const url =
        URL.createObjectURL(blob);

      audioUrlRef.current = url;

      const audio =
        new Audio(url);

      audioRef.current = audio;

      audio.onended = () => {
        setSpeaking(false);

        URL.revokeObjectURL(url);

        if (
          audioUrlRef.current ===
          url
        ) {
          audioUrlRef.current =
            null;
        }

        audioRef.current = null;
      };

      audio.onerror = () => {
        setSpeaking(false);

        setVoiceError(
          "Ses oynatılamadı."
        );
      };

      await audio.play();

    } catch (e) {
      setSpeaking(false);

      setVoiceError(
        e.message ||
        "Ses üretilemedi."
      );
    }
  }

  async function send(
    content = text,
    options = {}
  ) {
    const value =
      String(content || "")
        .trim();

    if (!value || loading) {
      return;
    }

    const shouldSpeak =
      options.speak ??
      voiceMode;

    const nextMessages = [
      ...messages,
      {
        role: "user",
        content: value
      }
    ];

    setMessages(nextMessages);
    setText("");
    setQuickActions([]);
    setLoading(true);

    try {
      const res =
        await fetch(
          "/api/chat",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                messages:
                  nextMessages,

                session,

                clientContext: {
                  ...getClientContext(),

                  channel:
                    shouldSpeak
                      ? "voice"
                      : "chat"
                }
              })
          }
        );

      const data =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
          "İstek başarısız"
        );
      }

      setMessages(
        (m) => [
          ...m,
          {
            role: "assistant",
            content: data.message
          }
        ]
      );

      setSession(
        data.session || {}
      );

      setMeta(data);

      setQuickActions(
        Array.isArray(
          data.quickActions
        )
          ? data.quickActions
          : []
      );

      if (shouldSpeak) {
        await speakText(
          data.message
        );
      }

    } catch (e) {
      const errorText =
        `Şu anda yanıt oluşturamadım. Teknik detay: ${e.message}`;

      setMessages(
        (m) => [
          ...m,
          {
            role: "assistant",
            content: errorText
          }
        ]
      );

    } finally {
      setLoading(false);
    }
  }

  async function processRecordedAudio(
    blob,
    mimeType
  ) {
    setTranscribing(true);
    setVoiceError("");

    try {
      const ext =
        mimeType.includes("mp4")
          ? "m4a"
          : "webm";

      const form =
        new FormData();

      form.append(
        "audio",
        blob,
        `talhagpt-${Date.now()}.${ext}`
      );

      const res =
        await fetch(
          "/api/voice/transcribe",
          {
            method: "POST",
            body: form
          }
        );

      const data =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
          "Ses çözümlenemedi"
        );
      }

      const transcript =
        String(
          data.text || ""
        ).trim();

      if (!transcript) {
        throw new Error(
          "Söylediğinizi net biçimde duyamadım. Tekrar deneyebilir misiniz?"
        );
      }

      setLastTranscript(
        transcript
      );

      /*
       * TCKN / VKN / dosya no /
       * poliçe no / partaj / plaka
       * gibi kritik bilgi geldiyse
       * önce insana teyit ettiriyoruz.
       */
      if (
        looksLikeCriticalIdentifier(
          transcript
        )
      ) {
        setPendingTranscript(
          transcript
        );

        return;
      }

      await send(
        transcript,
        {
          speak: true
        }
      );

    } catch (e) {
      setVoiceError(
        e.message ||
        "Ses çözümlenemedi."
      );

    } finally {
      setTranscribing(false);
    }
  }

  async function startRecording() {
    if (
      loading ||
      transcribing
    ) {
      return;
    }

    setVoiceError("");
    setPendingTranscript("");

    /*
     * Kullanıcı konuşmaya
     * başladığında TalhaGPT'nin
     * mevcut sesini kesiyoruz.
     */
    stopCurrentAudio();

    if (
      !navigator
        .mediaDevices
        ?.getUserMedia
    ) {
      setVoiceError(
        "Bu tarayıcı mikrofon erişimini desteklemiyor."
      );

      return;
    }

    if (
      typeof MediaRecorder ===
      "undefined"
    ) {
      setVoiceError(
        "Bu tarayıcı ses kaydı özelliğini desteklemiyor."
      );

      return;
    }

    try {
      const stream =
        await navigator
          .mediaDevices
          .getUserMedia({
            audio: {
              echoCancellation:
                true,

              noiseSuppression:
                true,

              autoGainControl:
                true
            }
          });

      streamRef.current =
        stream;

      const mimeType =
        pickRecordingMimeType();

      const recorder =
        mimeType
          ? new MediaRecorder(
              stream,
              { mimeType }
            )
          : new MediaRecorder(
              stream
            );

      recorderRef.current =
        recorder;

      chunksRef.current = [];

      recorder.ondataavailable =
        (event) => {
          if (
            event.data?.size
          ) {
            chunksRef.current.push(
              event.data
            );
          }
        };

      recorder.onstop =
        async () => {
          const finalMime =
            recorder.mimeType ||
            mimeType ||
            "audio/webm";

          const blob =
            new Blob(
              chunksRef.current,
              {
                type:
                  finalMime
              }
            );

          chunksRef.current = [];

          stopMicrophoneStream();

          if (
            blob.size < 1200
          ) {
            setVoiceError(
              "Çok kısa bir ses aldım. Biraz daha uzun konuşup tekrar deneyin."
            );

            return;
          }

          await processRecordedAudio(
            blob,
            finalMime
          );
        };

      recorder.start();

      setRecording(true);

    } catch (e) {
      stopMicrophoneStream();

      setVoiceError(
        e?.name ===
        "NotAllowedError"
          ? "Mikrofon izni verilmedi. Tarayıcıdaki mikrofon iznini açıp tekrar deneyin."
          : "Mikrofon başlatılamadı."
      );
    }
  }

  function stopRecording() {
    const recorder =
      recorderRef.current;

    if (
      recorder &&
      recorder.state !==
        "inactive"
    ) {
      recorder.stop();
    }

    recorderRef.current =
      null;

    setRecording(false);
  }

  async function toggleRecording() {
    if (recording) {
      stopRecording();
    } else {
      await startRecording();
    }
  }

  async function enableVoiceMode() {
    if (voiceMode) {
      stopRecording();
      stopCurrentAudio();
      stopMicrophoneStream();

      setVoiceMode(false);

      setPendingTranscript("");

      return;
    }

    setVoiceMode(true);
    setVoiceError("");

    const lastAssistant =
      [...messages]
        .reverse()
        .find(
          (m) =>
            m.role ===
            "assistant"
        );

    /*
     * Butona kullanıcı dokunduğu için
     * ilk karşılama sesini burada
     * güvenli şekilde başlatıyoruz.
     */
    if (
      lastAssistant?.content
    ) {
      setTimeout(
        () =>
          speakText(
            lastAssistant.content,
            { force: true }
          ),
        0
      );
    }
  }

  async function approveTranscript() {
    const approved =
      pendingTranscript;

    setPendingTranscript("");

    if (approved) {
      await send(
        approved,
        {
          speak: true
        }
      );
    }
  }

  function retryTranscript() {
    setPendingTranscript("");
    setLastTranscript("");
    setVoiceError("");
  }

  async function reset() {
    stopRecording();
    stopCurrentAudio();
    stopMicrophoneStream();

    setMessages([]);
    setText("");
    setSession({});
    setMeta(null);

    setQuickActions([]);

    setPendingTranscript("");
    setLastTranscript("");
    setVoiceError("");

    await bootstrap();
  }

  const voiceStatus =
    recording
      ? "Dinliyorum…"
      : transcribing
      ? "Söylediğinizi anlıyorum…"
      : speaking
      ? "TalhaGPT konuşuyor…"
      : pendingTranscript
      ? "Kritik bilgiyi onaylamanızı bekliyorum"
      : "Hazır";

  return (
    <main className="shell">

      <section className="appCard">

        <header className="topbar">

          <div className="brand">

            <div className="logo">
              HDI
            </div>

            <div>
              <strong>
                TalhaGPT · Dijital Asistan
              </strong>

              <span>
                Dosya Bilgi PoC · AI Orchestration V5 · Voice Demo
              </span>
            </div>

          </div>

          <div className="status">
            <i />
            Çevrimiçi
          </div>

        </header>

        <div className="toolbar">

          <button
            onClick={() =>
              setShowDemo(
                (v) => !v
              )
            }
          >
            Demo doğrulama bilgileri
          </button>

          <button
            onClick={() =>
              setShowOps(
                (v) => !v
              )
            }
          >
            Operasyon görünümü
          </button>

          <button
            className={
              voiceMode
                ? "voiceToggle active"
                : "voiceToggle"
            }

            onClick={
              enableVoiceMode
            }
          >
            {voiceMode
              ? "🎙 Sesli Mod Açık"
              : "🎙 Sesli Demoyu Başlat"}
          </button>

          <button
            className="ghost"
            onClick={reset}
          >
            Yeni sohbet
          </button>

        </div>

        {showDemo && (
          <div className="demoBox">

            <b>
              Sentetik PoC verileri
            </b>

            <p>
              <b>Sigortalı:</b>{" "}
              TCKN 11111111111 ·
              dosya 294551 / 281204 ·
              poliçe 2000294688416 /
              2000294000001 ·
              plaka 16AD630
            </p>

            <p>
              <b>Mağdur:</b>{" "}
              TCKN 22222222222 ·
              dosya 294551 ·
              plaka 16CAF273
            </p>

            <p>
              <b>Servis:</b>{" "}
              servis kodu 3840 ·
              VKN 6360039002 ·
              dosya 294551 / 281204
            </p>

            <p>
              <b>Acente:</b>{" "}
              partaj 7693 ·
              dosya 294551 / 281204 ·
              plaka 16AD630
            </p>

            <p>
              <b>
                Claim selection:
              </b>{" "}
              15 Mart 2026 → 281204 ·
              2 Temmuz 2026 → 294551
            </p>

            <small>
              Gerçek kişi verisi değildir.
              İkinci dosya çoklu dosya
              seçim davranışını test
              etmek için sentetik olarak
              eklenmiştir.
            </small>

          </div>
        )}

        {showOps && meta && (
          <div className="opsBox">

            <div>
              <span>Diyalog</span>
              <b>
                {meta.plan
                  ?.dialogueAct ||
                  "-"}
              </b>
            </div>

            <div>
              <span>Niyet</span>
              <b>
                {(meta.plan
                  ?.intents ||
                  [])
                  .join(", ") ||
                  "-"}
              </b>
            </div>

            <div>
              <span>Rol</span>
              <b>
                {meta.session
                  ?.role ||
                  "-"}
              </b>
            </div>

            <div>
              <span>
                Doğrulama
              </span>

              <b>
                {meta.session
                  ?.verification
                  ?.status ||
                  "-"}
              </b>
            </div>

            <div>
              <span>Kanıt</span>

              <b>
                {Object.keys(
                  meta.session
                    ?.verification
                    ?.verifiedFields ||
                    {}
                ).join(", ") ||
                  "-"}
              </b>
            </div>

            <div>
              <span>
                Aktif Dosya
              </span>

              <b>
                {meta.session
                  ?.activeClaimNo ||
                  "-"}
              </b>
            </div>

            <div>
              <span>
                Aday Dosya
              </span>

              <b>
                {meta.session
                  ?.candidateClaims
                  ?.length ??
                  0}
              </b>
            </div>

            <div>
              <span>Tool</span>

              <b>
                {(meta.toolTrace ||
                  [])
                  .map(
                    (x) =>
                      x.name
                  )
                  .join(" → ") ||
                  "-"}
              </b>
            </div>

            <div>
              <span>
                Kayıt Türü
              </span>

              <b>
                {meta.task
                  ?.kayitTuru ||
                  "-"}
              </b>
            </div>

            <div>
              <span>Model</span>

              <b>
                {meta.model ||
                  "-"}
              </b>
            </div>

          </div>
        )}

        {voiceMode && (
          <div className="voicePanel">

            <div className="voicePanelTop">

              <div>
                <b>
                  Sesli Görüşme
                </b>

                <span>
                  {voiceStatus}
                </span>
              </div>

              <button
                className={`micButton ${
                  recording
                    ? "recording"
                    : ""
                }`}

                onClick={
                  toggleRecording
                }

                disabled={
                  loading ||
                  transcribing ||
                  Boolean(
                    pendingTranscript
                  )
                }
              >
                {recording
                  ? "■ Bitir"
                  : "🎙 Konuş"}
              </button>

            </div>

            {lastTranscript &&
              !pendingTranscript && (
                <div className="transcriptPreview">

                  <span>
                    Son duyduğum
                  </span>

                  <b>
                    {lastTranscript}
                  </b>

                </div>
              )}

            {pendingTranscript && (
              <div className="transcriptConfirm">

                <span>
                  Kritik bilgiyi şöyle anladım:
                </span>

                <strong>
                  {pendingTranscript}
                </strong>

                <div>

                  <button
                    onClick={
                      approveTranscript
                    }
                  >
                    Doğru, gönder
                  </button>

                  <button
                    className="secondary"
                    onClick={
                      retryTranscript
                    }
                  >
                    Tekrar söyle
                  </button>

                </div>

              </div>
            )}

            {voiceError && (
              <div className="voiceError">
                {voiceError}
              </div>
            )}

            <small className="aiVoiceDisclosure">

              Duyduğunuz ses yapay zekâ
              tarafından üretilir.

              TCKN, VKN, partaj,
              dosya/poliçe numarası
              ve plaka gibi kritik
              bilgiler agent'a
              gönderilmeden önce
              ekranda teyit edilir.

            </small>

          </div>
        )}

        <div className="messages">

          {messages.map(
            (m, i) => (
              <div
                key={i}
                className={`row ${m.role}`}
              >

                {m.role ===
                  "assistant" && (
                    <div className="avatar">
                      AI
                    </div>
                  )}

                <div className="bubble">
                  {m.content}
                </div>

              </div>
            )
          )}

          {loading && (
            <div className="row assistant">

              <div className="avatar">
                AI
              </div>

              <div className="bubble typing">
                <span />
                <span />
                <span />
              </div>

            </div>
          )}

        </div>

        {!loading &&
          quickActions.length >
            0 && (
            <div className="quickActions">

              {quickActions.map(
                (a) => (
                  <button
                    key={`${a.label}-${a.value}`}

                    onClick={() =>
                      send(
                        a.value,
                        {
                          speak:
                            voiceMode
                        }
                      )
                    }
                  >
                    {a.label}
                  </button>
                )
              )}

            </div>
          )}

        <form
          className="composer"

          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >

          <textarea
            value={text}

            onChange={(e) =>
              setText(
                e.target.value
              )
            }

            onKeyDown={(e) => {
              if (
                e.key ===
                  "Enter" &&
                !e.shiftKey
              ) {
                e.preventDefault();
                send();
              }
            }}

            placeholder="Mesajınızı yazın..."

            rows={1}
          />

          <button
            type="submit"

            disabled={
              loading ||
              !text.trim()
            }
          >
            Gönder
          </button>

        </form>

        <footer>
          AI konuşmayı planlar ·
          Tool'lar gerçeği doğrular ·
          Guardrail'ler sınırı çizer ·
          AI doğal cevabı üretir
        </footer>

      </section>

    </main>
  );
}
