"use client";

import {
  useEffect,
  useRef,
  useState
} from "react";

function uid(prefix = "m") {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function getClientContext() {
  const now = new Date();

  return {
    locale: navigator.language || "tr-TR",

    timeZone:
      Intl.DateTimeFormat()
        .resolvedOptions()
        .timeZone || "Europe/Istanbul",

    localIso: now.toISOString(),

    localHour: now.getHours(),

    localDay: now.toLocaleDateString(
      "tr-TR",
      {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      }
    ),

    channel: "voice"
  };
}

function waitForDataChannel(dc) {
  if (dc.readyState === "open") {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          "VoiceBot veri kanalı zaman aşımına uğradı."
        )
      );
    }, 12000);

    dc.addEventListener(
      "open",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );

    dc.addEventListener(
      "error",
      () => {
        clearTimeout(timer);
        reject(
          new Error(
            "VoiceBot veri kanalı açılamadı."
          )
        );
      },
      { once: true }
    );
  });
}

export default function VoiceBotPage() {
  const [messages, setMessages] =
    useState([]);

  const [text, setText] =
    useState("");

  const [session, setSession] =
    useState({});

  const [meta, setMeta] =
    useState(null);

  const [status, setStatus] =
    useState("Hazır");

  const [connected, setConnected] =
    useState(false);

  const [voiceError, setVoiceError] =
    useState("");

  const [showDemo, setShowDemo] =
    useState(false);

  const [showOps, setShowOps] =
    useState(false);

  /*
   * HDI V5 brain'in final konuşma geçmişi.
   * Partial realtime transcriptleri buraya girmiyoruz.
   */
  const conversationRef =
    useRef([]);

  const sessionRef =
    useRef({});

  const greetingRef =
    useRef("");

  /*
   * Realtime bağlantısı.
   */
  const pcRef =
    useRef(null);

  const dcRef =
    useRef(null);

  const micStreamRef =
    useRef(null);

  const audioElRef =
    useRef(null);

  const connectedRef =
    useRef(false);

  /*
   * Aynı completed transcription event'ini
   * iki kere işlememek için.
   */
  const processedInputItemsRef =
    useRef(new Set());

  /*
   * Her kullanıcının Realtime item_id'sini
   * UI mesajına bağlıyoruz.
   */
  const userMessageIdsRef =
    useRef(new Map());

  /*
   * O sırada Talha'nın seslendirdiği mesaj.
   */
  const assistantSpeechRef =
    useRef({
      messageId: null,
      responseId: null,
      transcript: "",
      target: ""
    });

  /*
   * Kullanıcı çok hızlı arka arkaya konuşursa
   * brain çağrılarını sıraya sokuyoruz.
   */
  const brainQueueRef =
    useRef(Promise.resolve());

  function syncSession(next) {
    const value =
      next && typeof next === "object"
        ? next
        : {};

    sessionRef.current = value;
    setSession(value);
  }

  function upsertMessage(
    id,
    role,
    value,
    mode = "replace"
  ) {
    setMessages((current) => {
      const index =
        current.findIndex(
          (m) => m.id === id
        );

      if (index === -1) {
        return [
          ...current,
          {
            id,
            role,
            content: value
          }
        ];
      }

      const next = [...current];

      next[index] = {
        ...next[index],

        content:
          mode === "append"
            ? `${next[index].content}${value}`
            : value
      };

      return next;
    });
  }

  async function bootstrap() {
    try {
      const res = await fetch(
        "/api/chat",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            bootstrap: true,
            clientContext:
              getClientContext()
          })
        }
      );

      const data =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
            "Karşılama oluşturulamadı."
        );
      }

      const greeting =
        String(
          data.message || ""
        ).trim();

      greetingRef.current =
        greeting;

      conversationRef.current = [
        {
          role: "assistant",
          content: greeting
        }
      ];

      syncSession(
        data.session || {}
      );

      setMeta(data);

      upsertMessage(
        "opening",
        "assistant",
        greeting
      );
    } catch (error) {
      const greeting =
        "Merhaba, ben TEST TEST TEST Sigorta Dijital Asistanı TalhaGPT. Nasıl yardımcı olabilirim? MOCK DATA İLE ÇALIŞAN DEMO SÜRÜMÜNÜN BETASIYIM :) ";

      greetingRef.current =
        greeting;

      conversationRef.current = [
        {
          role: "assistant",
          content: greeting
        }
      ];

      upsertMessage(
        "opening",
        "assistant",
        greeting
      );
    }
  }

  useEffect(() => {
    bootstrap();

    return () => {
      closeVoicebot();
    };
  }, []);

  async function callV5Brain(
    userText
  ) {
    const clean =
      String(userText || "")
        .trim();

    if (!clean) return;

    conversationRef.current = [
      ...conversationRef.current,
      {
        role: "user",
        content: clean
      }
    ];

    setStatus(
      "Talha düşünüyor…"
    );

    try {
      const res = await fetch(
        "/api/chat",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            messages:
              conversationRef.current,

            session:
              sessionRef.current,

            clientContext:
              getClientContext()
          })
        }
      );

      const data =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
            "Agent yanıt veremedi."
        );
      }

      syncSession(
        data.session || {}
      );

      setMeta(data);

      const answer =
        String(
          data.message || ""
        ).trim();

      /*
       * Brain geçmişine final cevabı ekliyoruz.
       */
      conversationRef.current = [
        ...conversationRef.current,
        {
          role: "assistant",
          content: answer
        }
      ];

      if (
        connectedRef.current
      ) {
        speakWithRealtime(
          answer
        );
      } else {
        upsertMessage(
          uid("assistant"),
          "assistant",
          answer
        );

        setStatus("Hazır");
      }
    } catch (error) {
      const message =
        `Şu anda yanıt oluşturamadım: ${error.message}`;

      upsertMessage(
        uid("assistant"),
        "assistant",
        message
      );

      setStatus(
        connectedRef.current
          ? "Dinliyorum…"
          : "Hazır"
      );
    }
  }

  function queueBrainTurn(
    userText
  ) {
    brainQueueRef.current =
      brainQueueRef.current
        .then(() =>
          callV5Brain(
            userText
          )
        )
        .catch((error) => {
          console.error(
            "Brain queue:",
            error
          );
        });
  }

  function cancelCurrentSpeech() {
    const dc =
      dcRef.current;

    if (
      !dc ||
      dc.readyState !== "open"
    ) {
      return;
    }

    try {
      dc.send(
        JSON.stringify({
          type: "response.cancel"
        })
      );
    } catch {
      // Sessiz geç.
    }
  }

  function speakWithRealtime(
    text,
    options = {}
  ) {
    const dc =
      dcRef.current;

    const clean =
      String(text || "")
        .trim();

    if (
      !clean ||
      !dc ||
      dc.readyState !== "open"
    ) {
      if (!options.messageId) {
        upsertMessage(
          uid("assistant"),
          "assistant",
          clean
        );
      }

      return;
    }

    cancelCurrentSpeech();

    const messageId =
      options.messageId ||
      uid("assistant");

    assistantSpeechRef.current = {
      messageId,
      responseId: null,
      transcript: "",
      target: clean
    };

    /*
     * Output transcript ekranda
     * Talha konuşurken oluşacak.
     */
    upsertMessage(
      messageId,
      "assistant",
      ""
    );

    setStatus(
      "Talha konuşuyor…"
    );

    dc.send(
      JSON.stringify({
        type: "response.create",

        response: {
          /*
           * Realtime model burada bilgi üretmiyor.
           * Yalnız V5'in cevabını seslendiriyor.
           */
          input: [],

          output_modalities: [
            "audio"
          ],

          instructions: `
Aşağıdaki HDI TalhaGPT cevabını Türkçe olarak seslendir.

Bu bir telefon görüşmesi.
Anons veya IVR gibi okuma.

Genç yetişkin erkek bir dijital asistan gibi,
rahat, doğal, akıcı ve kendinden emin konuş.

Normal insan konuşmasından biraz hızlı konuş.
Gereksiz duraklama yapma.
Her kelimeyi ayrı ayrı vurgulama.
Cümle sonlarını yapay biçimde uzatma.

Metindeki bilgileri değiştirme.
Yeni bilgi ekleme.
Bilgi çıkarma.

METİN:
${clean}
`.trim()
        }
      })
    );
  }

  function handleRealtimeEvent(
    event
  ) {
    switch (event.type) {
      /*
       * Kullanıcı konuşmaya başladı.
       *
       * Talha konuşuyorsa susturuyoruz:
       * telefon görüşmesindeki barge-in.
       */
      case "input_audio_buffer.speech_started": {
        if (
          assistantSpeechRef
            .current
            .messageId
        ) {
          cancelCurrentSpeech();
        }

        setStatus(
          "Dinliyorum…"
        );

        break;
      }

      case "input_audio_buffer.speech_stopped": {
        setStatus(
          "Sizi anlıyorum…"
        );

        break;
      }

      /*
       * Kullanıcının söylediği şey
       * KELİME KELİME ekrana düşer.
       */
      case "conversation.item.input_audio_transcription.delta": {
        const itemId =
          event.item_id;

        let messageId =
          userMessageIdsRef
            .current
            .get(itemId);

        if (!messageId) {
          messageId =
            `user-${itemId}`;

          userMessageIdsRef
            .current
            .set(
              itemId,
              messageId
            );

          upsertMessage(
            messageId,
            "user",
            ""
          );
        }

        if (event.delta) {
          upsertMessage(
            messageId,
            "user",
            event.delta,
            "append"
          );
        }

        break;
      }

      /*
       * Final STT.
       *
       * BURADAKİ transcript aynen
       * V5 agent'a gidiyor.
       */
      case "conversation.item.input_audio_transcription.completed": {
        const itemId =
          event.item_id;

        const finalText =
          String(
            event.transcript || ""
          ).trim();

        const messageId =
          userMessageIdsRef
            .current
            .get(itemId) ||
          `user-${itemId}`;

        upsertMessage(
          messageId,
          "user",
          finalText
        );

        if (
          finalText &&
          !processedInputItemsRef
            .current
            .has(itemId)
        ) {
          processedInputItemsRef
            .current
            .add(itemId);

          queueBrainTurn(
            finalText
          );
        }

        break;
      }

      /*
       * Talha'nın ses cevabı başladı.
       */
      case "response.created": {
        assistantSpeechRef.current.responseId =
          event.response?.id ||
          null;

        setStatus(
          "Talha konuşuyor…"
        );

        break;
      }

      /*
       * Talha konuşurken söylediği
       * metin KELİME KELİME ekranda.
       */
      case "response.output_audio_transcript.delta": {
        const current =
          assistantSpeechRef.current;

        if (
          !current.messageId ||
          !event.delta
        ) {
          break;
        }

        current.transcript +=
          event.delta;

        upsertMessage(
          current.messageId,
          "assistant",
          event.delta,
          "append"
        );

        break;
      }

      case "response.output_audio_transcript.done": {
        const current =
          assistantSpeechRef.current;

        if (
          !current.messageId
        ) {
          break;
        }

        const finalTranscript =
          String(
            event.transcript ||
              current.transcript ||
              current.target ||
              ""
          ).trim();

        if (finalTranscript) {
          upsertMessage(
            current.messageId,
            "assistant",
            finalTranscript
          );
        }

        break;
      }

      case "response.done": {
        const current =
          assistantSpeechRef.current;

        /*
         * Transcript event gelmediyse
         * V5'in orijinal metnini fallback
         * olarak ekranda bırak.
         */
        if (
          current.messageId &&
          !current.transcript
        ) {
          upsertMessage(
            current.messageId,
            "assistant",
            current.target
          );
        }

        assistantSpeechRef.current = {
          messageId: null,
          responseId: null,
          transcript: "",
          target: ""
        };

        setStatus(
          "Dinliyorum…"
        );

        break;
      }

      case "error": {
        console.error(
          "Realtime error:",
          event
        );

        setVoiceError(
          event.error?.message ||
            "VoiceBot bağlantısında hata oluştu."
        );

        break;
      }

      default:
        break;
    }
  }

  async function startVoicebot() {
    if (
      connectedRef.current
    ) {
      return;
    }

    setVoiceError("");
    setStatus(
      "VoiceBot bağlanıyor…"
    );

    try {
      /*
       * Greeting henüz gelmediyse bekle.
       */
      if (
        !greetingRef.current
      ) {
        await bootstrap();
      }

      /*
       * 1) Kısa ömürlü Realtime token.
       */
      const tokenResponse =
        await fetch(
          "/api/realtime/session",
          {
            method: "POST"
          }
        );

      const tokenData =
        await tokenResponse.json();

      if (!tokenResponse.ok) {
        throw new Error(
          tokenData.error ||
            "Realtime token alınamadı."
        );
      }

      const ephemeralKey =
        tokenData.value;

      if (!ephemeralKey) {
        throw new Error(
          "Realtime client secret dönmedi."
        );
      }

      /*
       * 2) Mikrofon.
       */
      const microphone =
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

      micStreamRef.current =
        microphone;

      /*
       * 3) WebRTC.
       */
      const pc =
        new RTCPeerConnection();

      pcRef.current =
        pc;

      const audio =
        new Audio();

      audio.autoplay = true;
      audio.playsInline = true;

      audioElRef.current =
        audio;

      pc.ontrack = (event) => {
        audio.srcObject =
          event.streams[0];

        audio.play().catch(
          () => {}
        );
      };

      const track =
        microphone
          .getAudioTracks()[0];

      pc.addTrack(
        track,
        microphone
      );

      /*
       * JSON event channel.
       */
      const dc =
        pc.createDataChannel(
          "oai-events"
        );

      dcRef.current =
        dc;

      dc.addEventListener(
        "message",
        (message) => {
          try {
            handleRealtimeEvent(
              JSON.parse(
                message.data
              )
            );
          } catch (error) {
            console.error(
              "Realtime event parse:",
              error
            );
          }
        }
      );

      /*
       * 4) SDP handshake.
       */
      const offer =
        await pc.createOffer();

      await pc.setLocalDescription(
        offer
      );

      const sdpResponse =
        await fetch(
          "https://api.openai.com/v1/realtime/calls",
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${ephemeralKey}`,

              "Content-Type":
                "application/sdp"
            },

            body:
              offer.sdp
          }
        );

      if (!sdpResponse.ok) {
        throw new Error(
          await sdpResponse.text()
        );
      }

      const answerSdp =
        await sdpResponse.text();

      await pc.setRemoteDescription({
        type: "answer",
        sdp: answerSdp
      });

      await waitForDataChannel(
        dc
      );

      connectedRef.current =
        true;

      setConnected(true);

      setStatus(
        "VoiceBot bağlı"
      );

      /*
       * Gerçek telefon görüşmesi gibi:
       * bağlantı kurulur kurulmaz
       * Talha karşılar.
       *
       * Sonrasında mikrofon açık kalır.
       */
      const opening =
        greetingRef.current;

      if (opening) {
        speakWithRealtime(
          opening,
          {
            messageId:
              "opening"
          }
        );
      }
    } catch (error) {
      console.error(
        "Start VoiceBot:",
        error
      );

      setVoiceError(
        error.message ||
          "VoiceBot başlatılamadı."
      );

      closeVoicebot();
    }
  }

  function closeVoicebot() {
    try {
      cancelCurrentSpeech();
    } catch {}

    if (
      dcRef.current
    ) {
      try {
        dcRef.current.close();
      } catch {}

      dcRef.current = null;
    }

    if (
      pcRef.current
    ) {
      try {
        pcRef.current.close();
      } catch {}

      pcRef.current = null;
    }

    if (
      micStreamRef.current
    ) {
      for (
        const track of
        micStreamRef.current
          .getTracks()
      ) {
        track.stop();
      }

      micStreamRef.current =
        null;
    }

    if (
      audioElRef.current
    ) {
      audioElRef.current.pause();
      audioElRef.current.srcObject =
        null;

      audioElRef.current =
        null;
    }

    connectedRef.current =
      false;

    setConnected(false);

    setStatus("Hazır");
  }

  async function sendTypedMessage(
    event
  ) {
    event.preventDefault();

    const value =
      text.trim();

    if (!value) return;

    const messageId =
      uid("user");

    upsertMessage(
      messageId,
      "user",
      value
    );

    setText("");

    queueBrainTurn(value);
  }

  const statusColor =
    status.includes("Dinliyorum")
      ? "#07884f"
      : status.includes("konuşuyor")
      ? "#2563eb"
      : status.includes("düşünüyor") ||
        status.includes("anlıyorum")
      ? "#b7791f"
      : "#68766f";

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
                TalhaGPT · VoiceBot
              </strong>

              <span>
                HDI Dosya Bilgi PoC ·
                Realtime AI Voice
              </span>
            </div>
          </div>

          <div
            className="status"
            style={{
              color:
                connected
                  ? "#07884f"
                  : "#68766f"
            }}
          >
            <i />

            {connected
              ? "Görüşme aktif"
              : "Hazır"}
          </div>
        </header>

        <div className="toolbar">

          {!connected ? (
            <button
              onClick={
                startVoicebot
              }
              style={{
                fontWeight: 750,
                borderColor:
                  "#8fc9aa",
                background:
                  "#edf9f2",
                color:
                  "#076b40"
              }}
            >
              ☎️ VoiceBot'u Başlat
            </button>
          ) : (
            <button
              onClick={
                closeVoicebot
              }
              style={{
                fontWeight: 750,
                borderColor:
                  "#efb6b2",
                background:
                  "#fff3f2",
                color:
                  "#a61b14"
              }}
            >
              ⏹ Görüşmeyi Bitir
            </button>
          )}

          <button
            onClick={() =>
              setShowDemo(
                (v) => !v
              )
            }
          >
            Demo verileri
          </button>

          <button
            onClick={() =>
              setShowOps(
                (v) => !v
              )
            }
          >
            Operasyon
          </button>

        </div>

        <div
          style={{
            margin:
              "10px 20px 0",
            padding:
              "11px 14px",
            borderRadius: 13,
            border:
              "1px solid #e2e9e5",
            background:
              "#fbfcfb",
            display: "flex",
            alignItems:
              "center",
            justifyContent:
              "space-between",
            gap: 12
          }}
        >
          <div>
            <b
              style={{
                fontSize: 12
              }}
            >
              VoiceBot durumu
            </b>

            <div
              style={{
                fontSize: 12,
                marginTop: 3,
                color:
                  statusColor
              }}
            >
              ● {status}
            </div>
          </div>

          {connected && (
            <div
              style={{
                fontSize: 11,
                color:
                  "#68766f"
              }}
            >
              Mikrofon sürekli açık ·
              Konuşmaya başlayabilirsiniz
            </div>
          )}
        </div>

        {showDemo && (
          <div className="demoBox">
            <b>
              Sentetik PoC verileri
            </b>

            <p>
              <b>Sigortalı:</b>{" "}
              TCKN 11111111111 ·
              dosya 294551 /
              281204 ·
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
              VKN 6360039002
            </p>

            <p>
              <b>Acente:</b>{" "}
              partaj 7693
            </p>
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
                  []).join(", ") ||
                  "-"}
              </b>
            </div>

            <div>
              <span>Rol</span>
              <b>
                {session.role ||
                  "-"}
              </b>
            </div>

            <div>
              <span>
                Doğrulama
              </span>

              <b>
                {session
                  ?.verification
                  ?.status ||
                  "-"}
              </b>
            </div>

            <div>
              <span>
                Aktif Dosya
              </span>

              <b>
                {session
                  ?.activeClaimNo ||
                  "-"}
              </b>
            </div>
          </div>
        )}

        {voiceError && (
          <div
            style={{
              margin:
                "10px 20px 0",
              padding:
                "10px 12px",
              background:
                "#fff3f2",
              color:
                "#a61b14",
              border:
                "1px solid #efc4c0",
              borderRadius: 12,
              fontSize: 12
            }}
          >
            {voiceError}
          </div>
        )}

        <div
          style={{
            padding:
              "12px 20px 0",
            color:
              "#68766f",
            fontSize: 10,
            fontWeight: 700,
            textTransform:
              "uppercase",
            letterSpacing:
              ".04em"
          }}
        >
          Canlı görüşme dökümü
        </div>

        <div className="messages">
          {messages.map(
            (m) => (
              <div
                key={m.id}
                className={`row ${m.role}`}
              >
                {m.role ===
                  "assistant" && (
                    <div className="avatar">
                      AI
                    </div>
                  )}

                <div className="bubble">
                  {m.content ||
                    (m.role ===
                    "assistant"
                      ? "…"
                      : "")}
                </div>
              </div>
            )
          )}
        </div>

        <form
          className="composer"
          onSubmit={
            sendTypedMessage
          }
        >
          <textarea
            value={text}

            onChange={(e) =>
              setText(
                e.target.value
              )
            }

            placeholder="İsterseniz yazarak da devam edebilirsiniz..."

            rows={1}
          />

          <button
            type="submit"
            disabled={
              !text.trim()
            }
          >
            Gönder
          </button>
        </form>

        <footer>
          VoiceBot · Canlı STT ·
          V5 AI Orchestration ·
          Realtime ses
        </footer>

      </section>
    </main>
  );
}
