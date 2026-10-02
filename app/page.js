"use client";

import { useEffect, useRef, useState } from "react";

const EMPTY_UI = {
  quickActions: [],
  claimCards: [],
  documentCards: [],
  verification: null,
  uploadedFiles: [],
};

function uid(prefix = "item") {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function getClientContext(channel = "chat") {
  const now = new Date();

  return {
    locale: navigator.language || "tr-TR",
    timeZone:
      Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Istanbul",
    localIso: now.toISOString(),
    localHour: now.getHours(),
    localDay: now.toLocaleDateString("tr-TR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    channel,
  };
}

function formatBytes(bytes = 0) {
  if (!bytes) return "0 KB";

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function waitForDataChannel(dc) {
  if (dc.readyState === "open") {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Ses bağlantısı zaman aşımına uğradı."));
    }, 12000);

    dc.addEventListener(
      "open",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true }
    );

    dc.addEventListener(
      "error",
      () => {
        clearTimeout(timeout);
        reject(new Error("Ses bağlantısı kurulamadı."));
      },
      { once: true }
    );
  });
}

function Waveform({
  values = [],
  label,
  sublabel,
  active,
  variant = "customer",
}) {
  return (
    <div className={`waveCard ${variant} ${active ? "active" : ""}`}>
      <div className="waveIdentity">
        <span className="waveLabel">{label}</span>
        <span className="waveSub">{sublabel}</span>
      </div>

      <div className="waveBars">
        {values.map((value, index) => (
          <span
            key={index}
            style={{
              height: `${Math.max(4, value)}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    VERIFIED: {
      label: "Doğrulandı",
      className: "verified",
    },
    IN_PROGRESS: {
      label: "Doğrulama sürüyor",
      className: "progress",
    },
    UNVERIFIED: {
      label: "Doğrulanmadı",
      className: "muted",
    },
  };

  const item = map[status] || map.UNVERIFIED;

  return (
    <span className={`statePill ${item.className}`}>
      {item.label}
    </span>
  );
}

const FIELD_LABELS = {
  dosyaNo: "Dosya",
  policeNo: "Poliçe",
  plaka: "Plaka",
  tckn: "TCKN",
  vkn: "VKN",
  telefon: "Telefon",
  dogumTarihi: "Doğum Tarihi",
  partajNo: "Partaj",
  servisKodu: "Servis Kodu",
  eksperKodu: "Eksper Kodu",
};

/*
 * Tool gerektirmeyen basit sesli konuşmalar.
 *
 * Bunlar /api/chat üzerinden iki ayrı AI çağrısını beklemez.
 * Realtime model doğrudan cevap verir.
 */
function isRealtimeSmallTalk(value = "") {
  const text = String(value)
    .toLocaleLowerCase("tr-TR")
    .replace(/[?.!,;:]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const patterns = [
    /^selam$/,
    /^merhaba$/,
    /^günaydın$/,
    /^iyi akşamlar$/,
    /^iyi günler$/,
    /^nasılsın$/,
    /^naber$/,
    /^ne haber$/,
    /^ne yapıyorsun$/,
    /^orada mısın$/,
    /^beni duyuyor musun$/,
    /^sesim geliyor mu$/,
    /^sesimi duyuyor musun$/,
    /^konuşuyor musun$/,
    /^neden konuşmuyorsun$/,
    /^niye konuşmuyorsun$/,
    /^ses geliyor mu$/,
    /^ses geliyor mu bana$/,
    /^beni duyabiliyor musun$/,
  ];

  return patterns.some((pattern) => pattern.test(text));
}

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [session, setSession] = useState({});
  const [ui, setUi] = useState(EMPTY_UI);
  const [meta, setMeta] = useState(null);

  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState("");

  const [voiceConnected, setVoiceConnected] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("Kapalı");
  const [voiceError, setVoiceError] = useState("");

  const [showOps, setShowOps] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const [customerWave, setCustomerWave] = useState(
    Array(22).fill(5)
  );

  const [talhaWave, setTalhaWave] = useState(
    Array(22).fill(5)
  );

  /*
   * CHAT / SESSION REFS
   */
  const conversationRef = useRef([]);
  const sessionRef = useRef({});
  const uploadedFilesRef = useRef([]);
  const greetingRef = useRef("");

  const fileInputRef = useRef(null);
  const bottomRef = useRef(null);

  /*
   * REALTIME REFS
   */
  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const microphoneRef = useRef(null);

  /*
   * Bu artık gerçek DOM <audio> elementi.
   */
  const remoteAudioRef = useRef(null);

  const responseActiveRef = useRef(false);

  /*
   * React closure kaynaklı voiceConnected bug'ını engeller.
   */
  const voiceConnectedRef = useRef(false);

  /*
   * Birden fazla backend request'in aynı anda açılmasını engeller.
   */
  const busyRef = useRef(false);

  /*
   * Aynı transcript birkaç eventten gelirse tekrar işlenmez.
   */
  const lastTurnRef = useRef({
    key: "",
    time: 0,
  });

  const userItemMapRef = useRef(new Map());
  const processedItemsRef = useRef(new Set());

  const currentSpeechRef = useRef({
    messageId: null,
    target: "",
    transcript: "",
    mode: null,
  });

  const localMeterCleanupRef = useRef(null);
  const remoteMeterCleanupRef = useRef(null);

  function syncSession(next) {
    const value =
      next && typeof next === "object"
        ? next
        : {};

    sessionRef.current = value;
    setSession(value);
  }

  function syncUi(next) {
    setUi({
      ...EMPTY_UI,
      ...(next || {}),
    });
  }

  function upsertMessage(
    id,
    role,
    content,
    options = {}
  ) {
    const {
      append = false,
      live = false,
      files = null,
    } = options;

    setMessages((current) => {
      const index = current.findIndex(
        (item) => item.id === id
      );

      if (index === -1) {
        return [
          ...current,
          {
            id,
            role,
            content,
            live,
            files,
          },
        ];
      }

      const next = [...current];

      next[index] = {
        ...next[index],
        role,
        content: append
          ? `${next[index].content || ""}${content}`
          : content,
        live,
        files: files || next[index].files,
      };

      return next;
    });
  }

  function removeLiveFlag(id) {
    setMessages((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              live: false,
            }
          : item
      )
    );
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [
    messages,
    ui.quickActions,
    ui.claimCards,
    ui.documentCards,
  ]);

  async function bootstrap() {
    try {
      const response = await fetch("/api/chat", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          bootstrap: true,
          clientContext: getClientContext("chat"),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Karşılama oluşturulamadı."
        );
      }

      const greeting = String(
        data.message || ""
      ).trim();

      greetingRef.current = greeting;

      conversationRef.current = [
        {
          role: "assistant",
          content: greeting,
        },
      ];

      syncSession(data.session || {});
      setMeta(data);
      syncUi(data.ui);

      upsertMessage(
        "opening",
        "assistant",
        greeting
      );
    } catch (error) {
      console.error("Bootstrap:", error);

      const greeting =
        "İyi günler, TEST TEST TEST Sigorta'dan Talha ben. Nasıl yardımcı olabilirim? SADECE MOCK DATA İLE ÇALIŞAN DEMO BİR BOTUM :) ";

      greetingRef.current = greeting;

      conversationRef.current = [
        {
          role: "assistant",
          content: greeting,
        },
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
      closeVoice();
    };
  }, []);

  function chooseActivity(value) {
    const lower = String(value).toLocaleLowerCase(
      "tr-TR"
    );

    if (
      /dosya|hasar|plaka|poliçe|police/.test(
        lower
      )
    ) {
      return "Dosya bilgileri kontrol ediliyor";
    }

    if (
      /evrak|belge|doküman|dokuman/.test(
        lower
      )
    ) {
      return "Belge bilgileri kontrol ediliyor";
    }

    if (/ödeme|odeme/.test(lower)) {
      return "Ödeme bilgileri kontrol ediliyor";
    }

    return "Yanıt hazırlanıyor";
  }

  /*
   * ============================
   * BUSINESS / CHAT TURN
   * ============================
   */

  async function submitTurn(
    content,
    options = {}
  ) {
    const value = String(content || "").trim();

    if (!value) {
      return;
    }

    const {
      source = "chat",
      displayUser = true,
      files = null,
    } = options;

    /*
     * Aynı cümle birkaç event tarafından
     * milisaniyeler içinde gönderilmişse engelle.
     */
    const normalized = value
      .toLocaleLowerCase("tr-TR")
      .replace(/\s+/g, " ")
      .trim();

    const now = Date.now();

    if (
      lastTurnRef.current.key === normalized &&
      now - lastTurnRef.current.time < 2200
    ) {
      console.log(
        "Duplicate turn ignored:",
        value
      );

      return;
    }

    lastTurnRef.current = {
      key: normalized,
      time: now,
    };

    /*
     * Önceki business turn hâlâ çalışıyorsa
     * aynı anda yeni backend turn açma.
     */
    if (busyRef.current) {
      console.log(
        "Turn ignored because previous turn is busy:",
        value
      );

      return;
    }

    busyRef.current = true;
    setBusy(true);

    const userMessageId = uid("user");

    if (displayUser) {
      upsertMessage(
        userMessageId,
        "user",
        value,
        {
          files,
        }
      );
    }

    conversationRef.current = [
      ...conversationRef.current,
      {
        role: "user",
        content: value,
      },
    ];

    setText("");

    /*
     * Önceki turn'ün contextual butonlarını
     * yeni cevap gelene kadar gizle.
     */
    setUi((current) => ({
      ...current,
      quickActions: [],
      claimCards: [],
      documentCards: [],
    }));

    const activityTimer = setTimeout(() => {
      setActivity(
        chooseActivity(value)
      );
    }, 400);

    try {
      /*
       * KRİTİK:
       * voiceConnected React state'i değil,
       * güncel REF okunuyor.
       */
      const voiceActive =
        voiceConnectedRef.current;

      const response = await fetch(
        "/api/chat",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            messages:
              conversationRef.current,

            session:
              sessionRef.current,

            uploadedFiles:
              uploadedFilesRef.current,

            clientContext:
              getClientContext(
                voiceActive ||
                  source === "voice"
                  ? "voice"
                  : "chat"
              ),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Yanıt alınamadı."
        );
      }

      syncSession(data.session || {});

      syncUi(
        data.ui || {
          quickActions:
            data.quickActions || [],
        }
      );

      setMeta(data);

      const answer = String(
        data.message || ""
      ).trim();

      conversationRef.current = [
        ...conversationRef.current,
        {
          role: "assistant",
          content: answer,
        },
      ];

      /*
       * Voice açıksa text cevabı ayrıca
       * normal bubble olarak basmıyoruz.
       *
       * Realtime output transcript,
       * Talha konuşurken bubble'ı oluşturacak.
       */
      if (
        voiceConnectedRef.current
      ) {
        speakRealtime(answer);
      } else {
        upsertMessage(
          uid("assistant"),
          "assistant",
          answer
        );
      }
    } catch (error) {
      console.error("submitTurn:", error);

      upsertMessage(
        uid("assistant"),
        "assistant",
        `Şu anda işlemi tamamlayamadım. ${error.message}`
      );
    } finally {
      clearTimeout(activityTimer);

      setActivity("");

      busyRef.current = false;
      setBusy(false);
    }
  }

  /*
   * =========================
   * FILE UPLOAD
   * =========================
   */

  async function handleFiles(event) {
    const files = Array.from(
      event.target.files || []
    );

    event.target.value = "";

    if (!files.length) {
      return;
    }

    setUploading(true);

    const received = [];

    try {
      for (const file of files) {
        const form = new FormData();

        form.append(
          "file",
          file
        );

        const response = await fetch(
          "/api/uploads",
          {
            method: "POST",
            body: form,
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              `${file.name} yüklenemedi.`
          );
        }

        received.push({
          ...data.file,

          /*
           * Demo için browser preview.
           */
          localUrl:
            URL.createObjectURL(file),
        });
      }

      const nextFiles = [
        ...uploadedFilesRef.current,
        ...received,
      ];

      uploadedFilesRef.current =
        nextFiles;

      setUploadedFiles(nextFiles);

      const names = received
        .map((item) => item.name)
        .join(", ");

      const message =
        received.length === 1
          ? `${names} dosyasını yükledim.`
          : `${names} dosyalarını yükledim.`;

      upsertMessage(
        uid("user-file"),
        "user",
        message,
        {
          files: received,
        }
      );

      await submitTurn(message, {
        displayUser: false,
        files: received,
      });
    } catch (error) {
      console.error(
        "File upload:",
        error
      );

      upsertMessage(
        uid("system"),
        "assistant",
        `Dosya yükleme sırasında hata oluştu: ${error.message}`
      );
    } finally {
      setUploading(false);
    }
  }

  /*
   * =========================
   * AUDIO LEVEL METERS
   * =========================
   */

  function attachMeter(
    stream,
    setter
  ) {
    const AudioContext =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContext) {
      return () => {};
    }

    const context =
      new AudioContext();

    const source =
      context.createMediaStreamSource(
        stream
      );

    const analyser =
      context.createAnalyser();

    analyser.fftSize = 128;

    analyser.smoothingTimeConstant =
      0.72;

    source.connect(analyser);

    const data =
      new Uint8Array(
        analyser.frequencyBinCount
      );

    const interval = setInterval(() => {
      analyser.getByteFrequencyData(data);

      const bars = Array.from({
        length: 22,
      }).map((_, index) => {
        const position = Math.min(
          data.length - 1,
          Math.floor(
            (index / 22) *
              data.length
          )
        );

        const value =
          data[position] || 0;

        return Math.min(
          100,
          Math.max(
            5,
            Math.round(
              (value / 255) *
                100
            )
          )
        );
      });

      setter(bars);
    }, 55);

    return () => {
      clearInterval(interval);

      try {
        source.disconnect();
      } catch {}

      try {
        analyser.disconnect();
      } catch {}

      context
        .close()
        .catch(() => {});

      setter(
        Array(22).fill(5)
      );
    };
  }

  /*
   * =========================
   * REALTIME VOICE
   * =========================
   */

  function cancelRealtimeResponse() {
    /*
     * Önceki "Cancellation failed:
     * no active response found"
     * hatasını bu kontrol engelliyor.
     */
    if (
      !responseActiveRef.current
    ) {
      return;
    }

    const dc = dcRef.current;

    if (
      !dc ||
      dc.readyState !== "open"
    ) {
      return;
    }

    try {
      dc.send(
        JSON.stringify({
          type: "response.cancel",
        })
      );
    } catch (error) {
      console.error(
        "response.cancel:",
        error
      );
    }

    responseActiveRef.current =
      false;
  }

  /*
   * Backend V6 cevabını yalnızca
   * seslendiren Realtime turn.
   */
  function speakRealtime(content) {
    const clean = String(
      content || ""
    ).trim();

    const dc = dcRef.current;

    if (
      !clean ||
      !dc ||
      dc.readyState !== "open"
    ) {
      upsertMessage(
        uid("assistant"),
        "assistant",
        clean
      );

      return;
    }

    if (
      responseActiveRef.current
    ) {
      cancelRealtimeResponse();
    }

    const messageId = uid(
      "assistant-live"
    );

    currentSpeechRef.current = {
      messageId,
      target: clean,
      transcript: "",
      mode: "backend",
    };

    upsertMessage(
      messageId,
      "assistant",
      "",
      {
        live: true,
      }
    );

    setVoiceStatus(
      "Talha konuşuyor"
    );

    dc.send(
      JSON.stringify({
        type: "response.create",

        response: {
          output_modalities: [
            "audio",
          ],

          instructions: `
Aşağıdaki HDI Talha cevabını Türkçe seslendir.

Sen Talha'sın.

Genç yetişkin ERKEK bir dijital asistansın.

Profesyonel ama doğal bir müşteri temsilcisi gibi konuş.

Kullanıcının jargonunu TAKLİT ETME.

ASLA şu hitapları kullanma:
- abi
- kanka
- bro
- reis
- dostum
- kardeşim

IVR veya kurumsal anons gibi konuşma.

Rahat, net, sıcak ve kendinden emin ol.

Normal konuşma hızından hafif hızlı konuş.

Gereksiz duraklama yapma.

Her kelimeyi ayrı vurgulama.

Cümle sonlarını uzatma.

Metindeki bilgiyi değiştirme.

Yeni bilgi ekleme.

Bilgi çıkarma.

SESLENDİRİLECEK METİN:

${clean}
`.trim(),
        },
      })
    );
  }

  /*
   * Selam / nasılsın / ses geliyor mu
   * gibi business tool gerektirmeyen
   * basit konuşmalara doğrudan
   * Realtime cevap verir.
   *
   * Böylece Sol planner + composer
   * zinciri beklenmez.
   */
  function realtimeSmallTalk(
    userText
  ) {
    const dc = dcRef.current;

    if (
      !dc ||
      dc.readyState !== "open"
    ) {
      return false;
    }

    if (
      responseActiveRef.current
    ) {
      cancelRealtimeResponse();
    }

    const messageId = uid(
      "assistant-live"
    );

    currentSpeechRef.current = {
      messageId,
      target: "",
      transcript: "",
      mode: "smalltalk",
    };

    upsertMessage(
      messageId,
      "assistant",
      "",
      {
        live: true,
      }
    );

    setVoiceStatus(
      "Talha konuşuyor"
    );

    dc.send(
      JSON.stringify({
        type: "response.create",

        response: {
          output_modalities: [
            "audio",
          ],

          instructions: `
Kullanıcının son söylediği şey:

"${userText}"

Bu yalnızca gündelik ve güvenli bir konuşma turudur.

HDI müşteri verisi veya iş kuralı gerektirmiyor.

Türkçe cevap ver.

EN FAZLA 1 kısa cümle kullan.

Sen Talha'sın.

Genç yetişkin ERKEK bir dijital asistansın.

Sıcak ama profesyonel ol.

Kullanıcının konuşma tarzını veya jargonunu taklit etme.

ASLA şu hitapları kullanma:
- abi
- kanka
- bro
- reis
- dostum
- kardeşim

"Sesim geliyor mu?" veya benzeri bir soruysa sadece duyduğunu kısa ve doğal biçimde söyle.

Teknik sebep uydurma.

Cihaz veya uygulama ayarları hakkında kanıtsız teşhis yapma.

"Nasılsın?" denirse doğal ve kısa karşılık ver.

Hemen cevap ver.
`.trim(),
        },
      })
    );

    return true;
  }

  function handleRealtimeEvent(event) {
    switch (event.type) {
      /*
       * Kullanıcı konuşmaya başladı.
       */
      case "input_audio_buffer.speech_started": {
        setVoiceStatus(
          "Dinliyorum"
        );

        break;
      }

      /*
       * Kullanıcı sustu / VAD turn kapattı.
       */
      case "input_audio_buffer.speech_stopped": {
        setVoiceStatus(
          "Anlıyorum"
        );

        break;
      }

      /*
       * KULLANICI PARTIAL TRANSCRIPT
       */
      case "conversation.item.input_audio_transcription.delta": {
        const itemId =
          event.item_id;

        let messageId =
          userItemMapRef.current.get(
            itemId
          );

        if (!messageId) {
          messageId =
            `user-live-${itemId}`;

          userItemMapRef.current.set(
            itemId,
            messageId
          );

          upsertMessage(
            messageId,
            "user",
            "",
            {
              live: true,
            }
          );
        }

        if (event.delta) {
          upsertMessage(
            messageId,
            "user",
            event.delta,
            {
              append: true,
              live: true,
            }
          );
        }

        break;
      }

      /*
       * KULLANICI FINAL TRANSCRIPT
       *
       * Partial text final transcript ile
       * tamamen replace edilir.
       */
      case "conversation.item.input_audio_transcription.completed": {
        const itemId =
          event.item_id;

        const finalText = String(
          event.transcript || ""
        ).trim();

        if (!finalText) {
          break;
        }

        const messageId =
          userItemMapRef.current.get(
            itemId
          ) ||
          `user-live-${itemId}`;

        upsertMessage(
          messageId,
          "user",
          finalText,
          {
            live: false,
          }
        );

        removeLiveFlag(
          messageId
        );

        /*
         * Aynı Realtime item iki kere
         * completed event üretirse
         * ikinciyi tamamen yok say.
         */
        if (
          processedItemsRef.current.has(
            itemId
          )
        ) {
          break;
        }

        processedItemsRef.current.add(
          itemId
        );

        /*
         * Small talk ise direkt Realtime.
         */
        if (
          isRealtimeSmallTalk(
            finalText
          )
        ) {
          realtimeSmallTalk(
            finalText
          );
        } else {
          /*
           * Business / HDI turn ise
           * V6 backend'e gider.
           */
          submitTurn(
            finalText,
            {
              source: "voice",
              displayUser: false,
            }
          );
        }

        break;
      }

      /*
       * Talha'nın ses cevabı oluşturuldu.
       */
      case "response.created": {
        responseActiveRef.current =
          true;

        setVoiceStatus(
          "Talha konuşuyor"
        );

        break;
      }

      /*
       * TALHA CANLI OUTPUT TRANSCRIPT
       */
      case "response.output_audio_transcript.delta": {
        const current =
          currentSpeechRef.current;

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
          {
            append: true,
            live: true,
          }
        );

        break;
      }

      /*
       * TALHA FINAL OUTPUT TRANSCRIPT
       */
      case "response.output_audio_transcript.done": {
        const current =
          currentSpeechRef.current;

        if (!current.messageId) {
          break;
        }

        const finalText = String(
          event.transcript ||
            current.transcript ||
            current.target ||
            ""
        ).trim();

        if (finalText) {
          upsertMessage(
            current.messageId,
            "assistant",
            finalText,
            {
              live: false,
            }
          );

          /*
           * Realtime small talk backend
           * history'sine girmemişti.
           *
           * İstersek burada sadece
           * assistant cevabını eklemiyoruz;
           * Realtime kendi conversation
           * state'ini zaten tutuyor.
           */
        }

        break;
      }

      case "response.done": {
        responseActiveRef.current =
          false;

        const current =
          currentSpeechRef.current;

        /*
         * Transcript event hiç gelmezse
         * backend cevabını fallback olarak
         * göster.
         */
        if (
          current.messageId &&
          !current.transcript &&
          current.target
        ) {
          upsertMessage(
            current.messageId,
            "assistant",
            current.target,
            {
              live: false,
            }
          );
        }

        if (
          current.messageId
        ) {
          removeLiveFlag(
            current.messageId
          );
        }

        currentSpeechRef.current = {
          messageId: null,
          target: "",
          transcript: "",
          mode: null,
        };

        if (
          voiceConnectedRef.current
        ) {
          setVoiceStatus(
            "Dinliyorum"
          );
        }

        break;
      }

      case "error": {
        console.error(
          "Realtime event error:",
          event
        );

        responseActiveRef.current =
          false;

        setVoiceError(
          event.error?.message ||
            "Ses bağlantısında hata oluştu."
        );

        if (
          voiceConnectedRef.current
        ) {
          setVoiceStatus(
            "Dinliyorum"
          );
        }

        break;
      }

      default:
        break;
    }
  }

  async function startVoice() {
    if (
      voiceConnectedRef.current
    ) {
      return;
    }

    setVoiceError("");

    setVoiceStatus(
      "Bağlanıyor"
    );

    /*
     * Yeni bağlantıda event cache'lerini temizle.
     */
    processedItemsRef.current =
      new Set();

    userItemMapRef.current =
      new Map();

    responseActiveRef.current =
      false;

    currentSpeechRef.current = {
      messageId: null,
      target: "",
      transcript: "",
      mode: null,
    };

    try {
      /*
       * 1 — Ephemeral Realtime token
       */
      const tokenResponse =
        await fetch(
          "/api/realtime/session",
          {
            method: "POST",
          }
        );

      const tokenData =
        await tokenResponse.json();

      if (!tokenResponse.ok) {
        throw new Error(
          tokenData.error ||
            "Ses oturumu oluşturulamadı."
        );
      }

      const secret =
        tokenData.value;

      if (!secret) {
        throw new Error(
          "Geçici Realtime anahtarı alınamadı."
        );
      }

      /*
       * 2 — Mikrofon
       */
      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          }
        );

      microphoneRef.current =
        stream;

      localMeterCleanupRef.current =
        attachMeter(
          stream,
          setCustomerWave
        );

      /*
       * 3 — PeerConnection
       */
      const pc =
        new RTCPeerConnection();

      pcRef.current =
        pc;

      /*
       * JSX içindeki gerçek audio elementi.
       */
      const audio =
        remoteAudioRef.current;

      if (!audio) {
        throw new Error(
          "Ses çıkış elementi hazırlanamadı."
        );
      }

      audio.autoplay = true;
      audio.playsInline = true;
      audio.muted = false;
      audio.volume = 1;

      /*
       * Realtime'ın remote audio track'i.
       */
      pc.ontrack =
        async (trackEvent) => {
          const remoteStream =
            trackEvent.streams?.[0];

          if (!remoteStream) {
            return;
          }

          audio.srcObject =
            remoteStream;

          remoteMeterCleanupRef.current?.();

          remoteMeterCleanupRef.current =
            attachMeter(
              remoteStream,
              setTalhaWave
            );

          try {
            await audio.play();
          } catch (error) {
            console.error(
              "Remote audio play:",
              error
            );

            setVoiceError(
              "Talha'nın sesi tarayıcı tarafından oynatılamadı."
            );
          }
        };

      const micTrack =
        stream.getAudioTracks()[0];

      if (!micTrack) {
        throw new Error(
          "Mikrofon ses kanalı bulunamadı."
        );
      }

      pc.addTrack(
        micTrack,
        stream
      );

      /*
       * 4 — Realtime JSON event channel
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
            const event =
              JSON.parse(
                message.data
              );

            handleRealtimeEvent(
              event
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
       * 5 — WebRTC SDP handshake
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
                `Bearer ${secret}`,

              "Content-Type":
                "application/sdp",
            },

            body: offer.sdp,
          }
        );

      if (!sdpResponse.ok) {
        const detail =
          await sdpResponse.text();

        throw new Error(
          detail ||
            "Realtime bağlantısı kurulamadı."
        );
      }

      const answer =
        await sdpResponse.text();

      await pc.setRemoteDescription({
        type: "answer",
        sdp: answer,
      });

      await waitForDataChannel(
        dc
      );

      /*
       * REF state'ten ÖNCE set edilir.
       *
       * Böylece callback eski React
       * render'ını tutsa bile ses cevabı
       * kaybolmaz.
       */
      voiceConnectedRef.current =
        true;

      setVoiceConnected(true);

      setVoiceStatus(
        "Dinliyorum"
      );

      /*
       * Uzun IVR anonsu yok.
       * Kullanıcı bağlantının hazır olduğunu
       * kısa biçimde duyar.
       */
      speakRealtime(
        "Buradayım, sizi dinliyorum."
      );
    } catch (error) {
      console.error(
        "startVoice:",
        error
      );

      setVoiceError(
        error.message ||
          "Sesli görüşme başlatılamadı."
      );

      closeVoice();
    }
  }

  function closeVoice() {
    /*
     * Önce REF kapanır.
     */
    voiceConnectedRef.current =
      false;

    cancelRealtimeResponse();

    if (dcRef.current) {
      try {
        dcRef.current.close();
      } catch {}

      dcRef.current = null;
    }

    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {}

      pcRef.current = null;
    }

    if (
      microphoneRef.current
    ) {
      for (const track of
        microphoneRef.current.getTracks()) {
        track.stop();
      }

      microphoneRef.current =
        null;
    }

    /*
     * remoteAudioRef artık DOM ref.
     * NULL YAPMIYORUZ.
     */
    if (
      remoteAudioRef.current
    ) {
      try {
        remoteAudioRef.current.pause();

        remoteAudioRef.current.srcObject =
          null;
      } catch {}
    }

    localMeterCleanupRef.current?.();
    remoteMeterCleanupRef.current?.();

    localMeterCleanupRef.current =
      null;

    remoteMeterCleanupRef.current =
      null;

    responseActiveRef.current =
      false;

    currentSpeechRef.current = {
      messageId: null,
      target: "",
      transcript: "",
      mode: null,
    };

    setVoiceConnected(false);
    setVoiceStatus("Kapalı");

    setCustomerWave(
      Array(22).fill(5)
    );

    setTalhaWave(
      Array(22).fill(5)
    );
  }

  /*
   * =========================
   * RESET
   * =========================
   */

  async function resetConversation() {
    closeVoice();

    conversationRef.current = [];
    sessionRef.current = {};
    uploadedFilesRef.current = [];

    processedItemsRef.current =
      new Set();

    userItemMapRef.current =
      new Map();

    lastTurnRef.current = {
      key: "",
      time: 0,
    };

    busyRef.current = false;

    setMessages([]);
    setSession({});
    setUploadedFiles([]);

    syncUi(
      EMPTY_UI
    );

    setMeta(null);

    setText("");
    setActivity("");
    setVoiceError("");

    await bootstrap();
  }

  /*
   * =========================
   * DERIVED UI STATE
   * =========================
   */

  const verification =
    session?.verification || {};

  const evidence =
    verification?.evidenceCandidates ||
    {};

  const verificationStatus =
    verification?.status ||
    "UNVERIFIED";

  const matchedCount =
    verification?.matchedCount || 0;

  const activeClaim =
    session?.activeClaimNo || null;

  const activeRole =
    session?.role || null;

  const intents =
    meta?.plan?.intents || [];

  const voiceCustomerActive =
    voiceConnected &&
    voiceStatus === "Dinliyorum";

  const voiceTalhaActive =
    voiceConnected &&
    voiceStatus === "Talha konuşuyor";

  return (
    <main className="workspace">
      {/*
       * GERÇEK WEBRTC AUDIO OUTPUT.
       * CSS ile görünmez olacak.
       */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        className="remoteAudio"
      />

      {/* ================= LEFT RAIL ================= */}

      <aside className="rail">
        <div className="railBrand">
          <div className="hdiMark">
            58
          </div>

          <div>
            <strong>
              Talha AI
            </strong>

            <span>
              Customer Relations
            </span>
          </div>
        </div>

        <div className="railDivider" />

        <button
          className={`voiceMainButton ${
            voiceConnected
              ? "connected"
              : ""
          }`}
          onClick={
            voiceConnected
              ? closeVoice
              : startVoice
          }
        >
          <span className="voiceMainIcon">
            {voiceConnected
              ? "■"
              : "●"}
          </span>

          <span>
            {voiceConnected
              ? "Görüşmeyi Bitir"
              : "Sesli Görüşme"}
          </span>
        </button>

        <div className="railStatus">
          <span
            className={`statusDot ${
              voiceConnected
                ? "online"
                : ""
            }`}
          />

          <div>
            <b>
              {voiceConnected
                ? voiceStatus
                : "Chat aktif"}
            </b>

            <small>
              {voiceConnected
                ? "Mikrofon açık"
                : "Ses kapalı"}
            </small>
          </div>
        </div>

        <nav className="railNav">
          <button className="active">
            <span>✦</span>
            Görüşme
          </button>

          <button
            onClick={() =>
              setShowOps(
                (value) =>
                  !value
              )
            }
          >
            <span>⌘</span>
            Operasyon
          </button>

          <button
            onClick={
              resetConversation
            }
          >
            <span>↻</span>
            Yeni Oturum
          </button>
        </nav>

        <div className="railBottom">
          <span className="modelTag">
            V6
          </span>

          <small>
            GPT-5.6 Sol
          </small>
        </div>
      </aside>

      {/* ================= CENTER ================= */}

      <section className="conversation">
        <header className="conversationHeader">
          <div>
            <span className="eyebrow">
              TEST TEST TEST SIGORTA · AI ASSISTANT
            </span>

            <h1>
              Müşteri Görüşmesi
            </h1>
          </div>

          <div className="headerActions">
            <div className="secureState">
              <span className="secureIcon">
                ◈
              </span>

              <div>
                <small>
                  Güvenlik
                </small>

                <b>
                  KVKK kontrollü
                </b>
              </div>
            </div>
          </div>
        </header>

        {/* ================= AUDIO ================= */}

        <div className="audioDeck">
          <Waveform
            label="SİZ"
            sublabel={
              voiceConnected
                ? voiceStatus ===
                    "Dinliyorum"
                  ? "Sizi duyuyorum"
                  : "Mikrofon açık"
                : "Ses kapalı"
            }
            values={
              customerWave
            }
            active={
              voiceCustomerActive
            }
            variant="customer"
          />

          <div className="audioCenter">
            <div
              className={`voiceOrb ${
                voiceConnected
                  ? "enabled"
                  : ""
              } ${
                voiceTalhaActive
                  ? "speaking"
                  : ""
              }`}
            >
              <div className="orbCore">
                T
              </div>
            </div>

            <span>
              {voiceConnected
                ? voiceStatus
                : "Chat modu"}
            </span>
          </div>

          <Waveform
            label="TALHA"
            sublabel={
              voiceTalhaActive
                ? "Konuşuyor"
                : voiceConnected
                ? "Hazır"
                : "Ses kapalı"
            }
            values={
              talhaWave
            }
            active={
              voiceTalhaActive
            }
            variant="talha"
          />
        </div>

        {voiceError && (
          <div className="inlineError">
            <b>
              Ses bağlantısı
            </b>

            {voiceError}
          </div>
        )}

        {activity && (
          <div className="activityLine">
            <span className="activitySpinner" />

            {activity}
          </div>
        )}

        {/* ================= TIMELINE ================= */}

        <div className="timeline">
          {messages.map(
            (message) => (
              <div
                key={message.id}
                className={`messageRow ${message.role}`}
              >
                {message.role ===
                  "assistant" && (
                  <div className="talhaAvatar">
                    T
                  </div>
                )}

                <div className="messageStack">
                  <div className="messageMeta">
                    {message.role ===
                    "assistant"
                      ? "Talha"
                      : "Siz"}

                    {message.live && (
                      <span className="liveTag">
                        CANLI
                      </span>
                    )}
                  </div>

                  <div
                    className={`messageBubble ${
                      message.live
                        ? "live"
                        : ""
                    }`}
                  >
                    {message.content ||
                      "…"}

                    {message.live && (
                      <span className="liveCursor" />
                    )}
                  </div>

                  {Array.isArray(
                    message.files
                  ) &&
                    message.files
                      .length >
                      0 && (
                      <div className="messageFiles">
                        {message.files.map(
                          (file) => (
                            <a
                              key={
                                file.id
                              }
                              className="attachmentCard userAttachment"
                              href={
                                file.localUrl ||
                                "#"
                              }
                              target="_blank"
                              rel="noreferrer"
                            >
                              <span className="fileIcon">
                                ↑
                              </span>

                              <span className="fileBody">
                                <b>
                                  {file.name}
                                </b>

                                <small>
                                  {formatBytes(
                                    file.size
                                  )}{" "}
                                  ·
                                  Yüklendi
                                </small>
                              </span>

                              <span className="fileState">
                                ✓
                              </span>
                            </a>
                          )
                        )}
                      </div>
                    )}
                </div>
              </div>
            )
          )}

          {/* ================= QUICK ACTIONS ================= */}

          {ui.quickActions?.length >
            0 && (
            <div className="smartActions">
              <div className="smartActionLabel">
                Hızlı seçim
              </div>

              <div className="smartActionButtons">
                {ui.quickActions.map(
                  (
                    action,
                    index
                  ) => (
                    <button
                      key={`${action.value}-${index}`}
                      onClick={() =>
                        submitTurn(
                          action.value
                        )
                      }
                    >
                      {action.label}
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {/* ================= CLAIM CARDS ================= */}

          {ui.claimCards?.length >
            0 && (
            <div className="richBlock">
              <div className="richBlockTitle">
                <div>
                  <span className="eyebrow">
                    EŞLEŞEN DOSYALAR
                  </span>

                  <h3>
                    Hangi dosyayla devam edelim?
                  </h3>
                </div>

                <span className="countBadge">
                  {
                    ui.claimCards
                      .length
                  }
                </span>
              </div>

              <div className="claimGrid">
                {ui.claimCards.map(
                  (claim) => (
                    <button
                      key={
                        claim.id
                      }
                      className="claimCard"
                      onClick={() =>
                        submitTurn(
                          claim.action
                            .value
                        )
                      }
                    >
                      <div className="claimCardTop">
                        <span className="claimDate">
                          {claim.title}
                        </span>

                        <span className="claimArrow">
                          →
                        </span>
                      </div>

                      <b>
                        {claim.subtitle}
                      </b>

                      <small>
                        {claim.meta}
                      </small>

                      <div className="claimStatus">
                        {claim.status}
                      </div>
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {/* ================= TALHA DOCUMENTS ================= */}

          {ui.documentCards?.length >
            0 && (
            <div className="richBlock documentsBlock">
              <div className="richBlockTitle">
                <div>
                  <span className="eyebrow">
                    TALHA'DAN DOSYALAR
                  </span>

                  <h3>
                    Paylaşılabilir belgeler
                  </h3>
                </div>

                <span className="verifiedMini">
                  ✓ KVKK
                </span>
              </div>

              <div className="documentGrid">
                {ui.documentCards.map(
                  (document) => (
                    <a
                      key={
                        document.id
                      }
                      href={`/api/demo-document/${document.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="botDocument"
                    >
                      <div className="documentIcon">
                        PDF
                      </div>

                      <div className="documentInfo">
                        <b>
                          {document.label}
                        </b>

                        <small>
                          Dosya{" "}
                          {
                            document.claimNo
                          }{" "}
                          · Güvenli
                          paylaşım
                        </small>
                      </div>

                      <span>
                        ↓
                      </span>
                    </a>
                  )
                )}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ================= COMPOSER ================= */}

        <div className="composerDock">
          {uploadedFiles.length >
            0 && (
            <div className="uploadTray">
              {uploadedFiles
                .slice(-3)
                .map(
                  (file) => (
                    <div
                      key={
                        file.id
                      }
                      className="uploadChip"
                    >
                      <span>
                        ✓
                      </span>

                      <b>
                        {file.name}
                      </b>
                    </div>
                  )
                )}
            </div>
          )}

          <form
            className="smartComposer"
            onSubmit={(event) => {
              event.preventDefault();

              submitTurn(text);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              hidden
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              onChange={handleFiles}
            />

            <button
              type="button"
              className="composerTool"
              onClick={() =>
                fileInputRef.current?.click()
              }
              disabled={uploading}
              title="Dosya yükle"
            >
              {uploading
                ? "…"
                : "+"}
            </button>

            <textarea
              value={text}
              onChange={(event) =>
                setText(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key ===
                    "Enter" &&
                  !event.shiftKey
                ) {
                  event.preventDefault();

                  submitTurn(
                    text
                  );
                }
              }}
              placeholder={
                voiceConnected
                  ? "Konuşabilir veya buradan yazabilirsiniz…"
                  : "Talha'ya yazın…"
              }
              rows={1}
            />

            <button
              type="button"
              className={`composerMic ${
                voiceConnected
                  ? "on"
                  : ""
              }`}
              onClick={
                voiceConnected
                  ? closeVoice
                  : startVoice
              }
              title="Sesli görüşme"
            >
              ◉
            </button>

            <button
              type="submit"
              className="composerSend"
              disabled={
                busy ||
                !text.trim()
              }
            >
              ↑
            </button>
          </form>

          <div className="composerHint">
            <span>
              AI destekli görüşme
            </span>

            <span>·</span>

            <span>
              Sesler ve metinler demo amaçlıdır
            </span>
          </div>
        </div>
      </section>

      {/* ================= RIGHT CONTEXT ================= */}

      <aside className="contextPanel">
        <div className="contextHeader">
          <div>
            <span className="eyebrow">
              LIVE CONTEXT
            </span>

            <h2>
              Görüşme Bağlamı
            </h2>
          </div>

          <span className="liveIndicator">
            LIVE
          </span>
        </div>

        {/* ================= VERIFICATION ================= */}

        <section className="contextSection">
          <div className="sectionTitle">
            <span>
              Doğrulama
            </span>

            <StatusPill
              status={
                verificationStatus
              }
            />
          </div>

          <div className="verificationScore">
            <div className="scoreRing">
              <span>
                {matchedCount}
              </span>

              <small>
                / 2
              </small>
            </div>

            <div>
              <b>
                {verificationStatus ===
                "VERIFIED"
                  ? "Kimlik doğrulandı"
                  : matchedCount ===
                    1
                  ? "1 bilgi daha gerekli"
                  : "2 bağımsız bilgi gerekli"}
              </b>

              <small>
                Aynı dosyayla eşleşen farklı bilgi tipleri
              </small>
            </div>
          </div>

          {Object.keys(
            evidence
          ).length > 0 && (
            <div className="evidenceList">
              {Object.entries(
                evidence
              ).map(
                ([
                  field,
                  values,
                ]) => (
                  <div
                    key={field}
                    className="evidenceRow"
                  >
                    <span>
                      {FIELD_LABELS[
                        field
                      ] ||
                        field}
                    </span>

                    <div>
                      {(values || []).map(
                        (value) => (
                          <b key={value}>
                            {value}
                          </b>
                        )
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </section>

        {/* ================= CONTEXT ================= */}

        <section className="contextSection">
          <div className="sectionTitle">
            <span>
              Görüşme
            </span>
          </div>

          <div className="contextFacts">
            <div>
              <small>
                Rol
              </small>

              <b>
                {activeRole ||
                  "Belirlenmedi"}
              </b>
            </div>

            <div>
              <small>
                Aktif Dosya
              </small>

              <b>
                {activeClaim
                  ? `#${activeClaim}`
                  : "Seçilmedi"}
              </b>
            </div>

            <div>
              <small>
                Kanal
              </small>

              <b>
                {voiceConnected
                  ? "Voice + Chat"
                  : "Chat"}
              </b>
            </div>

            <div>
              <small>
                Niyet
              </small>

              <b>
                {intents.length
                  ? intents.join(
                      ", "
                    )
                  : "—"}
              </b>
            </div>
          </div>
        </section>

        {/* ================= FILES ================= */}

        <section className="contextSection">
          <div className="sectionTitle">
            <span>
              Dosyalar
            </span>

            <span className="numberBadge">
              {uploadedFiles.length}
            </span>
          </div>

          {uploadedFiles.length ===
          0 ? (
            <div className="emptyContext">
              Henüz müşteri dosyası yüklenmedi.
            </div>
          ) : (
            <div className="contextFiles">
              {uploadedFiles.map(
                (file) => (
                  <div
                    key={
                      file.id
                    }
                    className="contextFile"
                  >
                    <span>
                      ↑
                    </span>

                    <div>
                      <b>
                        {file.name}
                      </b>

                      <small>
                        {formatBytes(
                          file.size
                        )}
                      </small>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </section>

        {/* ================= OPS ================= */}

        {showOps && (
          <section className="contextSection opsPanel">
            <div className="sectionTitle">
              <span>
                Operasyon Debug
              </span>
            </div>

            <div className="opsRows">
              <div>
                <span>
                  Model
                </span>

                <b>
                  {meta?.model ||
                    "—"}
                </b>
              </div>

              <div>
                <span>
                  Dialogue
                </span>

                <b>
                  {meta?.plan
                    ?.dialogueAct ||
                    "—"}
                </b>
              </div>

              <div>
                <span>
                  Tool
                </span>

                <b>
                  {(meta?.toolTrace ||
                    [])
                    .map(
                      (item) =>
                        item.name
                    )
                    .join(" → ") ||
                    "—"}
                </b>
              </div>
            </div>
          </section>
        )}
      </aside>
    </main>
  );
}
