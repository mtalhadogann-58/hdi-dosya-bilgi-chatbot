"use client";

import { useEffect, useRef, useState } from "react";

const EMPTY_UI = {
  quickActions: [],
  claimCards: [],
  documentCards: [],
  verification: null,
  uploadedFiles: [],
};

const FIELD_LABELS = {
  dosyaNo: "Dosya No",
  policeNo: "Poliçe No",
  plaka: "Plaka",
  tckn: "TCKN",
  vkn: "VKN",
  telefon: "Telefon",
  dogumTarihi: "Doğum Tarihi",
  partajNo: "Partaj Kodu",
  servisKodu: "Servis Anlaşma Kodu",
  eksperKodu: "Eksper Anlaşma Kodu",
};

const ROLE_LABELS = {
  sigortali: "Sigortalı",
  magdur: "Mağdur",
  acente: "Acente",
  servis: "Servis",
  eksper: "Eksper",
  avukat: "Avukat",
  firma_yetkilisi: "Firma Yetkilisi",
};

const VERIFICATION_GUIDES = {
  sigortali: {
    priority: null,
    fields: [
      "Dosya No",
      "Poliçe No",
      "Plaka",
      "TCKN",
      "Doğum Tarihi",
      "Telefon",
    ],
  },

  magdur: {
    priority: null,
    fields: [
      "Dosya No",
      "Poliçe No",
      "Plaka",
      "TCKN",
      "Doğum Tarihi",
      "Telefon",
    ],
  },

  acente: {
    priority: "Partaj Kodu",
    fields: [
      "Partaj Kodu",
      "Dosya No",
      "Poliçe No",
      "Plaka",
      "TCKN / VKN",
    ],
  },

  servis: {
    priority: "Servis Anlaşma Kodu",
    fields: [
      "Servis Anlaşma Kodu",
      "Dosya No",
      "Poliçe No",
      "Plaka",
      "TCKN / VKN",
    ],
  },

  eksper: {
    priority: "Eksper Anlaşma Kodu",
    fields: [
      "Eksper Anlaşma Kodu",
      "Dosya No",
      "Poliçe No",
      "Plaka",
      "TCKN / VKN",
    ],
  },

  avukat: {
    priority: null,
    fields: [
      "Dosya No",
      "Poliçe No",
      "Plaka",
      "TCKN / VKN",
    ],
  },

  firma_yetkilisi: {
    priority: "VKN",
    fields: [
      "VKN",
      "Dosya No",
      "Poliçe No",
      "Plaka",
      "Telefon",
    ],
  },
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
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      "Europe/Istanbul",
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
    const timer = setTimeout(() => {
      reject(new Error("Ses bağlantısı zaman aşımına uğradı."));
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
        reject(new Error("Ses bağlantısı açılamadı."));
      },
      { once: true }
    );
  });
}

function isRealtimeSmallTalk(value = "") {
  const text = String(value)
    .toLocaleLowerCase("tr-TR")
    .replace(/[?.!,;:]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const businessWords =
    /(dosya|hasar|poliçe|police|plaka|tckn|vkn|partaj|servis kod|eksper kod|ödeme|odeme|evrak|belge|kasko|trafik)/;

  if (businessWords.test(text)) {
    return false;
  }

  if (text.length > 100) {
    return false;
  }

  return /(selam|merhaba|naber|ne haber|nasılsın|ne yapıyorsun|orada mısın|duyuyor musun|duyabiliyor musun|sesim geliyor mu|ses geliyor mu|konuşuyor musun|neden konuşmuyorsun|niye konuşmuyorsun)/.test(
    text
  );
}

function Waveform({
  values,
  title,
  subtitle,
  active,
  type,
}) {
  return (
    <div className={`waveBox ${active ? "active" : ""} ${type}`}>
      <div className="waveTitle">
        <b>{title}</b>
        <span>{subtitle}</span>
      </div>

      <div className="waveBars">
        {values.map((value, index) => (
          <i
            key={index}
            style={{
              height: `${Math.max(7, value)}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function PanelButton({
  active,
  onClick,
  icon,
  label,
  badge,
}) {
  return (
    <button
      className={`panelButton ${active ? "active" : ""}`}
      onClick={onClick}
      type="button"
    >
      <span className="panelIcon">{icon}</span>
      <span>{label}</span>

      {badge !== undefined && badge !== null && badge !== "" && (
        <b className="panelBadge">{badge}</b>
      )}

      <span className="panelChevron">
        {active ? "⌃" : "⌄"}
      </span>
    </button>
  );
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

  const [activePanel, setActivePanel] = useState(null);

  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const [customerWave, setCustomerWave] = useState(
    Array(18).fill(7)
  );

  const [talhaWave, setTalhaWave] = useState(
    Array(18).fill(7)
  );

  const conversationRef = useRef([]);
  const sessionRef = useRef({});
  const uploadedFilesRef = useRef([]);

  const fileInputRef = useRef(null);
  const bottomRef = useRef(null);

  const pcRef = useRef(null);
  const dcRef = useRef(null);

  const microphoneRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const responseActiveRef = useRef(false);
  const voiceConnectedRef = useRef(false);
  const busyRef = useRef(false);

  const lastTurnRef = useRef({
    key: "",
    time: 0,
  });

  const processedItemsRef = useRef(new Set());
  const userItemMapRef = useRef(new Map());

  const currentSpeechRef = useRef({
    messageId: null,
    target: "",
    transcript: "",
    mode: null,
    saved: false,
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

  function togglePanel(name) {
    setActivePanel((current) =>
      current === name ? null : name
    );
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

  function setMicrophoneEnabled(enabled) {
    if (!microphoneRef.current) return;

    for (const track of microphoneRef.current.getAudioTracks()) {
      track.enabled = enabled;
    }
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
          data.error || "Karşılama oluşturulamadı."
        );
      }

      const greeting = String(data.message || "").trim();

      conversationRef.current = [
        {
          role: "assistant",
          content: greeting,
        },
      ];

      syncSession(data.session || {});
      syncUi(data.ui || {});
      setMeta(data);

      upsertMessage(
        "opening",
        "assistant",
        greeting
      );
    } catch (error) {
      console.error(error);

      const greeting =
        "İyi günler, TEST TEST TEST Sigorta'dan Talha ben. Nasıl yardımcı olabilirim?";

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
    const lower = String(value).toLocaleLowerCase("tr-TR");

    if (/ödeme|odeme/.test(lower)) {
      return "Ödeme bilgisi kontrol ediliyor";
    }

    if (/evrak|belge|doküman|dokuman/.test(lower)) {
      return "Belge bilgisi kontrol ediliyor";
    }

    if (/dosya|hasar|plaka|poliçe|police/.test(lower)) {
      return "Dosya bilgisi kontrol ediliyor";
    }

    return "Yanıt hazırlanıyor";
  }

  async function submitTurn(
    content,
    options = {}
  ) {
    const value = String(content || "").trim();

    if (!value) return;

    const {
      source = "chat",
      displayUser = true,
      files = null,
    } = options;

    const normalized = value
      .toLocaleLowerCase("tr-TR")
      .replace(/\s+/g, " ")
      .trim();

    const now = Date.now();

    if (
      lastTurnRef.current.key === normalized &&
      now - lastTurnRef.current.time < 2200
    ) {
      return;
    }

    lastTurnRef.current = {
      key: normalized,
      time: now,
    };

    if (busyRef.current) {
      return;
    }

    busyRef.current = true;
    setBusy(true);

    if (displayUser) {
      upsertMessage(
        uid("user"),
        "user",
        value,
        { files }
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

    setUi((current) => ({
      ...current,
      quickActions: [],
      claimCards: [],
      documentCards: [],
    }));

    const activityTimer = setTimeout(() => {
      setActivity(chooseActivity(value));
    }, 350);

    try {
      const voiceActive =
        voiceConnectedRef.current ||
        source === "voice";

      const response = await fetch("/api/chat", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          messages: conversationRef.current,
          session: sessionRef.current,
          uploadedFiles: uploadedFilesRef.current,

          clientContext: getClientContext(
            voiceActive ? "voice" : "chat"
          ),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Yanıt alınamadı."
        );
      }

      syncSession(data.session || {});
      syncUi(
        data.ui || {
          quickActions: data.quickActions || [],
        }
      );

      setMeta(data);

      const answer = String(data.message || "").trim();

      conversationRef.current = [
        ...conversationRef.current,
        {
          role: "assistant",
          content: answer,
        },
      ];

      if (voiceConnectedRef.current) {
        speakRealtime(answer);
      } else {
        upsertMessage(
          uid("assistant"),
          "assistant",
          answer
        );
      }
    } catch (error) {
      console.error(error);

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

  async function handleFiles(event) {
    const files = Array.from(
      event.target.files || []
    );

    event.target.value = "";

    if (!files.length) return;

    setUploading(true);

    const received = [];

    try {
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);

        const response = await fetch("/api/uploads", {
          method: "POST",
          body: form,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || `${file.name} yüklenemedi.`
          );
        }

        received.push({
          ...data.file,
          localUrl: URL.createObjectURL(file),
        });
      }

      const nextFiles = [
        ...uploadedFilesRef.current,
        ...received,
      ];

      uploadedFilesRef.current = nextFiles;
      setUploadedFiles(nextFiles);

      const names = received
        .map((item) => item.name)
        .join(", ");

      const message =
        received.length === 1
          ? `${names} dosyasını yükledim.`
          : `${names} dosyalarını yükledim.`;

      upsertMessage(
        uid("file"),
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
      upsertMessage(
        uid("error"),
        "assistant",
        `Dosya yüklenemedi: ${error.message}`
      );
    } finally {
      setUploading(false);
    }
  }

  function attachMeter(stream, setter) {
    const AudioContext =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContext) {
      return () => {};
    }

    const context = new AudioContext();

    const source =
      context.createMediaStreamSource(stream);

    const analyser =
      context.createAnalyser();

    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.7;

    source.connect(analyser);

    const data =
      new Uint8Array(analyser.frequencyBinCount);

    const interval = setInterval(() => {
      analyser.getByteFrequencyData(data);

      const bars = Array.from({
        length: 18,
      }).map((_, index) => {
        const position = Math.min(
          data.length - 1,
          Math.floor(
            (index / 18) * data.length
          )
        );

        return Math.min(
          100,
          Math.max(
            7,
            Math.round(
              ((data[position] || 0) / 255) * 100
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

      context.close().catch(() => {});

      setter(Array(18).fill(7));
    };
  }

  function cancelRealtimeResponse() {
    if (!responseActiveRef.current) {
      return;
    }

    const dc = dcRef.current;

    if (!dc || dc.readyState !== "open") {
      return;
    }

    try {
      dc.send(
        JSON.stringify({
          type: "response.cancel",
        })
      );
    } catch {}

    responseActiveRef.current = false;
  }

  function prepareAssistantAudio() {
    /*
     * Talha konuşurken mikrofonu geçici kapatıyoruz.
     *
     * Böylece hoparlörden çıkan Talha sesi tekrar
     * mikrofon tarafından kullanıcı konuşması gibi
     * algılanıp kendi yanıtını kesmiyor.
     */
    setMicrophoneEnabled(false);

    if (remoteAudioRef.current) {
      remoteAudioRef.current
        .play()
        .catch(() => {});
    }
  }

  function finishAssistantAudio() {
    setTimeout(() => {
      if (voiceConnectedRef.current) {
        setMicrophoneEnabled(true);
        setVoiceStatus("Dinliyorum");
      }
    }, 120);
  }

  function speakRealtime(content) {
    const clean = String(content || "").trim();

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

    if (responseActiveRef.current) {
      cancelRealtimeResponse();
    }

    prepareAssistantAudio();

    const messageId =
      uid("assistant-live");

    currentSpeechRef.current = {
      messageId,
      target: clean,
      transcript: "",
      mode: "backend",
      saved: true,
    };

    upsertMessage(
      messageId,
      "assistant",
      "",
      {
        live: true,
      }
    );

    setVoiceStatus("Talha konuşuyor");

    dc.send(
      JSON.stringify({
        type: "response.create",

        response: {
          output_modalities: ["audio"],

          instructions: `
Aşağıdaki cevabı Türkçe seslendir.

Sen Talha'sın.

Genç yetişkin erkek bir HDI Sigorta dijital asistanısın.

Bir müşteri temsilcisi gibi doğal, rahat, net ve profesyonel konuş.

Normal konuşma temposundan biraz hızlı konuş.

IVR veya anons gibi okuma.

Kelime kelime vurgu yapma.

Gereksiz duraklama yapma.

Kullanıcının jargonunu taklit etme.

ASLA şu hitapları kullanma:
abi
kanka
bro
reis
dostum
kardeşim

Metindeki bilgiyi değiştirme.
Yeni bilgi ekleme.
Bilgi çıkarma.

CEVAP:

${clean}
`.trim(),
        },
      })
    );
  }

  function realtimeSmallTalk(userText) {
    const dc = dcRef.current;

    if (!dc || dc.readyState !== "open") {
      return false;
    }

    if (responseActiveRef.current) {
      cancelRealtimeResponse();
    }

    prepareAssistantAudio();

    const messageId =
      uid("assistant-live");

    currentSpeechRef.current = {
      messageId,
      target: "",
      transcript: "",
      mode: "smalltalk",
      saved: false,
    };

    upsertMessage(
      messageId,
      "assistant",
      "",
      {
        live: true,
      }
    );

    setVoiceStatus("Talha konuşuyor");

    dc.send(
      JSON.stringify({
        type: "response.create",

        response: {
          output_modalities: ["audio"],

          instructions: `
Kullanıcı şunu söyledi:

"${userText}"

Bu yalnızca gündelik bir konuşma turudur.

Türkçe cevap ver.

En fazla 1 kısa cümle söyle.

Sen Talha'sın.
Genç yetişkin erkek bir dijital asistansın.

Sıcak ama profesyonel ol.

Kullanıcının jargonunu taklit etme.

ASLA:
abi
kanka
bro
reis
dostum
kardeşim

gibi hitaplar kullanma.

"Sesim geliyor mu?" deniyorsa kısa biçimde duyduğunu söyle.

Teknik problem veya cihaz ayarı uydurma.

"Nasılsın?" deniyorsa kısa ve doğal karşılık ver.

Hemen cevap ver.
`.trim(),
        },
      })
    );

    return true;
  }

  function handleRealtimeEvent(event) {
    switch (event.type) {
      case "input_audio_buffer.speech_started": {
        setVoiceStatus("Dinliyorum");
        break;
      }

      case "input_audio_buffer.speech_stopped": {
        setVoiceStatus("Anlıyorum");
        break;
      }

      case "conversation.item.input_audio_transcription.delta": {
        const itemId = event.item_id;

        let messageId =
          userItemMapRef.current.get(itemId);

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

      case "conversation.item.input_audio_transcription.completed": {
        const itemId = event.item_id;

        const finalText = String(
          event.transcript || ""
        ).trim();

        if (!finalText) {
          break;
        }

        const messageId =
          userItemMapRef.current.get(itemId) ||
          `user-live-${itemId}`;

        upsertMessage(
          messageId,
          "user",
          finalText,
          {
            live: false,
          }
        );

        removeLiveFlag(messageId);

        if (
          processedItemsRef.current.has(itemId)
        ) {
          break;
        }

        processedItemsRef.current.add(itemId);

        if (isRealtimeSmallTalk(finalText)) {
          conversationRef.current = [
            ...conversationRef.current,
            {
              role: "user",
              content: finalText,
            },
          ];

          realtimeSmallTalk(finalText);
        } else {
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

      case "response.created": {
        responseActiveRef.current = true;

        setVoiceStatus("Talha konuşuyor");

        remoteAudioRef.current
          ?.play()
          .catch(() => {});

        break;
      }

      case "response.output_audio_transcript.delta": {
        const current =
          currentSpeechRef.current;

        if (
          !current.messageId ||
          !event.delta
        ) {
          break;
        }

        current.transcript += event.delta;

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

          if (
            current.mode === "smalltalk" &&
            !current.saved
          ) {
            conversationRef.current = [
              ...conversationRef.current,
              {
                role: "assistant",
                content: finalText,
              },
            ];

            current.saved = true;
          }
        }

        break;
      }

      case "response.done": {
        responseActiveRef.current = false;

        const current =
          currentSpeechRef.current;

        if (
          current.messageId &&
          !current.transcript &&
          current.target
        ) {
          upsertMessage(
            current.messageId,
            "assistant",
            current.target
          );
        }

        if (current.messageId) {
          removeLiveFlag(
            current.messageId
          );
        }

        currentSpeechRef.current = {
          messageId: null,
          target: "",
          transcript: "",
          mode: null,
          saved: false,
        };

        finishAssistantAudio();

        break;
      }

      case "error": {
        console.error(
          "Realtime error:",
          event
        );

        responseActiveRef.current = false;

        setMicrophoneEnabled(true);

        setVoiceError(
          event.error?.message ||
            "Ses bağlantısında hata oluştu."
        );

        if (voiceConnectedRef.current) {
          setVoiceStatus("Dinliyorum");
        }

        break;
      }

      default:
        break;
    }
  }

  async function startVoice() {
    if (voiceConnectedRef.current) {
      return;
    }

    setVoiceError("");
    setVoiceStatus("Bağlanıyor");

    processedItemsRef.current =
      new Set();

    userItemMapRef.current =
      new Map();

    responseActiveRef.current =
      false;

    try {
      const tokenResponse = await fetch(
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
          "Realtime bağlantı anahtarı alınamadı."
        );
      }

      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

      microphoneRef.current = stream;

      localMeterCleanupRef.current =
        attachMeter(
          stream,
          setCustomerWave
        );

      const pc =
        new RTCPeerConnection();

      pcRef.current = pc;

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

      pc.ontrack = async (event) => {
        const remoteStream =
          event.streams?.[0];

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
          console.error(error);

          setVoiceError(
            "Talha'nın sesi oynatılamadı."
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

      const dc =
        pc.createDataChannel(
          "oai-events"
        );

      dcRef.current = dc;

      dc.addEventListener(
        "message",
        (message) => {
          try {
            handleRealtimeEvent(
              JSON.parse(message.data)
            );
          } catch (error) {
            console.error(error);
          }
        }
      );

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
        throw new Error(
          await sdpResponse.text()
        );
      }

      const answer =
        await sdpResponse.text();

      await pc.setRemoteDescription({
        type: "answer",
        sdp: answer,
      });

      await waitForDataChannel(dc);

      voiceConnectedRef.current = true;

      setVoiceConnected(true);
      setVoiceStatus("Dinliyorum");

      /*
       * Çok kısa sesli başlangıç.
       */
      speakRealtime(
        "Sizi dinliyorum."
      );
    } catch (error) {
      console.error(error);

      setVoiceError(
        error.message ||
          "Sesli görüşme başlatılamadı."
      );

      closeVoice();
    }
  }

  function closeVoice() {
    voiceConnectedRef.current = false;

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

    if (microphoneRef.current) {
      for (const track of microphoneRef.current.getTracks()) {
        track.stop();
      }

      microphoneRef.current = null;
    }

    if (remoteAudioRef.current) {
      try {
        remoteAudioRef.current.pause();
        remoteAudioRef.current.srcObject = null;
      } catch {}
    }

    localMeterCleanupRef.current?.();
    remoteMeterCleanupRef.current?.();

    localMeterCleanupRef.current = null;
    remoteMeterCleanupRef.current = null;

    responseActiveRef.current = false;

    setVoiceConnected(false);
    setVoiceStatus("Kapalı");

    setCustomerWave(
      Array(18).fill(7)
    );

    setTalhaWave(
      Array(18).fill(7)
    );
  }

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
    setMeta(null);
    setText("");
    setActivity("");
    setVoiceError("");
    setActivePanel(null);

    syncUi(EMPTY_UI);

    await bootstrap();
  }

  const verification =
    session?.verification || {};

  const evidence =
    verification.evidenceCandidates || {};

  const verificationStatus =
    verification.status || "UNVERIFIED";

  const matchedCount =
    verification.matchedCount || 0;

  const activeRole =
    session?.role || null;

  const activeClaim =
    session?.activeClaimNo || null;

  const candidateClaims =
    session?.candidateClaims || [];

  const task =
    meta?.task ||
    meta?.plan?.task ||
    {};

  const intents =
    meta?.plan?.intents || [];

  const toolTrace =
    meta?.toolTrace || [];

  const guide =
    VERIFICATION_GUIDES[activeRole] || {
      priority: null,

      fields: [
        "Dosya No",
        "Poliçe No",
        "Plaka",
        "TCKN / VKN",
        "Doğum Tarihi",
        "Telefon",
      ],
    };

  const matchedFields =
    ui?.verification?.matchedFields || [];

  const rejectedCandidates =
    ui?.verification?.rejectedCandidates || [];

  return (
    <main className="workspace">
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        className="remoteAudio"
      />

      <section className="appShell">
        {/* TOPBAR */}

        <header className="topbar">
          <div className="brand">
            <div className="hdiLogo">
              58
            </div>

            <div>
              <b>Talha AI</b>
              <span>
                TEST TEST TEST AI ASSISTANT
              </span>
            </div>
          </div>

          <div className="topActions">
            <div
              className={`connectionStatus ${
                voiceConnected ? "on" : ""
              }`}
            >
              <i />

              {voiceConnected
                ? voiceStatus
                : "Chat"}
            </div>

            <button
              className={`voiceButton ${
                voiceConnected ? "active" : ""
              }`}
              onClick={
                voiceConnected
                  ? closeVoice
                  : startVoice
              }
            >
              {voiceConnected
                ? "■ Görüşmeyi Bitir"
                : "◉ Sesli Görüşme"}
            </button>

            <button
              className="iconButton"
              onClick={
                resetConversation
              }
              title="Yeni oturum"
            >
              ↻
            </button>
          </div>
        </header>

        {/* VOICE STRIP */}

        <section className="voiceStrip">
          <Waveform
            title="SİZ"
            subtitle={
              voiceConnected
                ? voiceStatus === "Dinliyorum"
                  ? "Sizi duyuyorum"
                  : "Mikrofon açık"
                : "Ses kapalı"
            }
            values={customerWave}
            active={
              voiceConnected &&
              voiceStatus === "Dinliyorum"
            }
            type="customer"
          />

          <div
            className={`voiceCore ${
              voiceConnected ? "connected" : ""
            } ${
              voiceStatus === "Talha konuşuyor"
                ? "speaking"
                : ""
            }`}
          >
            <div>T</div>
            <span>
              {voiceConnected
                ? voiceStatus
                : "Talha"}
            </span>
          </div>

          <Waveform
            title="TALHA"
            subtitle={
              voiceStatus === "Talha konuşuyor"
                ? "Konuşuyor"
                : voiceConnected
                ? "Hazır"
                : "Ses kapalı"
            }
            values={talhaWave}
            active={
              voiceConnected &&
              voiceStatus === "Talha konuşuyor"
            }
            type="talha"
          />
        </section>

        {/* CONTEXT MENUS */}

        <section className="contextMenu">
          <PanelButton
            active={
              activePanel === "verification"
            }
            onClick={() =>
              togglePanel("verification")
            }
            icon="✓"
            label="KVKK / Doğrulama"
            badge={`${matchedCount}/2`}
          />

          <PanelButton
            active={
              activePanel === "claim"
            }
            onClick={() =>
              togglePanel("claim")
            }
            icon="#"
            label="Dosya"
            badge={
              activeClaim
                ? activeClaim
                : candidateClaims.length ||
                  ""
            }
          />

          <PanelButton
            active={
              activePanel === "operations"
            }
            onClick={() =>
              togglePanel("operations")
            }
            icon="⌘"
            label="Operasyon"
            badge={
              task.kayitTuru
                ? task.kayitTuru
                : ""
            }
          />

          <PanelButton
            active={
              activePanel === "files"
            }
            onClick={() =>
              togglePanel("files")
            }
            icon="+"
            label="Dosyalar"
            badge={
              uploadedFiles.length || ""
            }
          />
        </section>

        {/* EXPANDABLE DRAWER */}

        {activePanel && (
          <section className="contextDrawer">
            {activePanel === "verification" && (
              <div className="verificationPanel">
                <div className="drawerHeader">
                  <div>
                    <span className="drawerEyebrow">
                      KVKK / KİMLİK DOĞRULAMA
                    </span>

                    <h3>
                      {verificationStatus === "VERIFIED"
                        ? "Doğrulama tamamlandı"
                        : "2 bağımsız bilgi eşleşmesi gerekli"}
                    </h3>
                  </div>

                  <div
                    className={`verificationState ${verificationStatus.toLowerCase()}`}
                  >
                    {verificationStatus === "VERIFIED"
                      ? "✓ DOĞRULANDI"
                      : `${matchedCount} / 2`}
                  </div>
                </div>

                <div className="verificationGrid">
                  <div className="infoCard">
                    <span>Arayan Rolü</span>

                    <b>
                      {ROLE_LABELS[activeRole] ||
                        "Henüz belirlenmedi"}
                    </b>

                    <small>
                      Rol, paylaşılabilecek bilgi
                      kapsamını belirler.
                    </small>
                  </div>

                  <div className="infoCard">
                    <span>Doğrulama Kuralı</span>

                    <b>
                      Herhangi 2 farklı bilgi
                    </b>

                    <small>
                      İki farklı bilgi tipi aynı
                      hasar dosyasıyla eşleşmelidir.
                    </small>
                  </div>

                  <div className="infoCard accent">
                    <span>
                      Öncelikli Kolay Bilgi
                    </span>

                    <b>
                      {guide.priority ||
                        "Özel öncelik yok"}
                    </b>

                    <small>
                      {guide.priority
                        ? "Zorunlu değildir; müşterinin işini kolaylaştırmak için önce sorulur."
                        : "Mevcut bilgilerden herhangi ikisi kullanılabilir."}
                    </small>
                  </div>
                </div>

                <div className="verificationColumns">
                  <div>
                    <span className="subTitle">
                      Kullanılabilecek bilgiler
                    </span>

                    <div className="fieldChips">
                      {guide.fields.map(
                        (field) => (
                          <span key={field}>
                            {field}
                          </span>
                        )
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="subTitle">
                      Görüşmede alınan bilgiler
                    </span>

                    {Object.keys(evidence).length ===
                    0 ? (
                      <div className="emptyMini">
                        Henüz doğrulama bilgisi
                        alınmadı.
                      </div>
                    ) : (
                      <div className="evidenceGrid">
                        {Object.entries(evidence).map(
                          ([field, values]) => (
                            <div
                              className={`evidenceItem ${
                                matchedFields.includes(
                                  field
                                )
                                  ? "matched"
                                  : ""
                              }`}
                              key={field}
                            >
                              <span>
                                {FIELD_LABELS[field] ||
                                  field}
                              </span>

                              <b>
                                {(values || []).join(
                                  " · "
                                )}
                              </b>

                              {matchedFields.includes(
                                field
                              ) && <i>✓</i>}
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {rejectedCandidates.length > 0 && (
                  <div className="rejectedInfo">
                    <b>
                      Eşleşmeyen alternatifler
                    </b>

                    <span>
                      {rejectedCandidates
                        .map(
                          (item) =>
                            `${
                              FIELD_LABELS[
                                item.field
                              ] || item.field
                            }: ${item.value}`
                        )
                        .join(" · ")}
                    </span>

                    <small>
                      Bir adayın eşleşmemesi,
                      başka iki bağımsız doğru
                      bilgi eşleşmişse doğrulamayı
                      bozmaz.
                    </small>
                  </div>
                )}
              </div>
            )}

            {activePanel === "claim" && (
              <div>
                <div className="drawerHeader">
                  <div>
                    <span className="drawerEyebrow">
                      DOSYA BAĞLAMI
                    </span>

                    <h3>
                      {activeClaim
                        ? `Aktif dosya #${activeClaim}`
                        : "Aktif dosya seçilmedi"}
                    </h3>
                  </div>
                </div>

                {candidateClaims.length === 0 ? (
                  <div className="emptyDrawer">
                    Doğrulama tamamlandıktan sonra
                    eşleşen hasar dosyaları burada
                    görünür.
                  </div>
                ) : (
                  <div className="miniClaimGrid">
                    {candidateClaims.map(
                      (claim) => (
                        <button
                          key={claim.claimNo}
                          className={`miniClaim ${
                            activeClaim ===
                            claim.claimNo
                              ? "selected"
                              : ""
                          }`}
                          onClick={() =>
                            submitTurn(
                              `${claim.claimNo} numaralı dosyayla devam edelim`
                            )
                          }
                        >
                          <span>
                            {claim.date ||
                              "Tarih yok"}
                          </span>

                          <b>
                            #{claim.claimNo}
                          </b>

                          <small>
                            {claim.branch} ·{" "}
                            {claim.reason}
                          </small>
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            )}

            {activePanel === "operations" && (
              <div>
                <div className="drawerHeader">
                  <div>
                    <span className="drawerEyebrow">
                      OPERASYON GÖRÜNÜMÜ
                    </span>

                    <h3>
                      AI Task Etiketleme
                    </h3>
                  </div>

                  <span className="aiBadge">
                    AUTO TAGGING
                  </span>
                </div>

                <div className="tagGrid">
                  <div>
                    <span>Kayıt Türü</span>
                    <b>
                      {task.kayitTuru || "—"}
                    </b>
                  </div>

                  <div>
                    <span>Ana Kategori</span>
                    <b>
                      {task.anaKategori || "—"}
                    </b>
                  </div>

                  <div>
                    <span>Alt Kategori</span>
                    <b>
                      {task.altKategori || "—"}
                    </b>
                  </div>

                  <div>
                    <span>Alt Alt Kategori</span>
                    <b>
                      {task.altAltKategori || "—"}
                    </b>
                  </div>

                  <div>
                    <span>Branş</span>
                    <b>
                      {task.brans || "—"}
                    </b>
                  </div>

                  <div className="wide">
                    <span>Konu</span>
                    <b>
                      {task.konu || "—"}
                    </b>
                  </div>
                </div>

                <div className="opsDetail">
                  <div>
                    <span>Dialogue Act</span>
                    <b>
                      {meta?.plan?.dialogueAct ||
                        "—"}
                    </b>
                  </div>

                  <div>
                    <span>Intent</span>
                    <b>
                      {intents.join(", ") ||
                        "—"}
                    </b>
                  </div>

                  <div>
                    <span>Rol</span>
                    <b>
                      {ROLE_LABELS[activeRole] ||
                        "—"}
                    </b>
                  </div>

                  <div>
                    <span>Verification</span>
                    <b>
                      {verificationStatus}
                    </b>
                  </div>

                  <div>
                    <span>Aktif Dosya</span>
                    <b>
                      {activeClaim || "—"}
                    </b>
                  </div>

                  <div>
                    <span>Model</span>
                    <b>
                      {meta?.model || "—"}
                    </b>
                  </div>

                  <div>
                    <span>Service Tier</span>
                    <b>
                      {meta?.serviceTier ||
                        "—"}
                    </b>
                  </div>

                  <div className="wide">
                    <span>Tool Trace</span>
                    <b>
                      {toolTrace
                        .map(
                          (item) =>
                            item.name
                        )
                        .join(" → ") ||
                        "—"}
                    </b>
                  </div>
                </div>
              </div>
            )}

            {activePanel === "files" && (
              <div>
                <div className="drawerHeader">
                  <div>
                    <span className="drawerEyebrow">
                      DOSYA ALIŞVERİŞİ
                    </span>

                    <h3>
                      Müşteri ↔ Talha
                    </h3>
                  </div>
                </div>

                <div className="fileDrawerGrid">
                  <button
                    className="uploadArea"
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                  >
                    <strong>+</strong>
                    <b>Müşteri dosya yüklesin</b>
                    <small>
                      PDF, JPG, PNG veya DOCX
                    </small>
                  </button>

                  <div className="fileListCompact">
                    {uploadedFiles.length === 0 ? (
                      <div className="emptyMini">
                        Henüz dosya yüklenmedi.
                      </div>
                    ) : (
                      uploadedFiles.map(
                        (file) => (
                          <div
                            key={file.id}
                            className="fileCompact"
                          >
                            <span>↑</span>

                            <div>
                              <b>{file.name}</b>
                              <small>
                                {formatBytes(
                                  file.size
                                )}
                              </small>
                            </div>
                          </div>
                        )
                      )
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {voiceError && (
          <div className="errorBar">
            {voiceError}
          </div>
        )}

        {activity && (
          <div className="activityBar">
            <i />
            {activity}
          </div>
        )}

        {/* CONVERSATION */}

        <section className="conversation">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`message ${
                message.role
              }`}
            >
              {message.role === "assistant" && (
                <div className="assistantAvatar">
                  T
                </div>
              )}

              <div className="messageBody">
                <div className="messageName">
                  {message.role === "assistant"
                    ? "Talha"
                    : "Siz"}

                  {message.live && (
                    <span>CANLI</span>
                  )}
                </div>

                <div
                  className={`bubble ${
                    message.live ? "live" : ""
                  }`}
                >
                  {message.content || "…"}


                  {message.live && (
                    <i className="cursor" />
                  )}
                </div>

                {Array.isArray(
                  message.files
                ) &&
                  message.files.length > 0 && (
                    <div className="messageFiles">
                      {message.files.map(
                        (file) => (
                          <a
                            key={file.id}
                            href={
                              file.localUrl ||
                              "#"
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="messageFile"
                          >
                            <span>↑</span>

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
                          </a>
                        )
                      )}
                    </div>
                  )}
              </div>
            </div>
          ))}

          {ui.quickActions?.length > 0 && (
            <div className="quickActions">
              <span>Hızlı seçim</span>

              <div>
                {ui.quickActions.map(
                  (action, index) => (
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

          {ui.claimCards?.length > 0 && (
            <div className="richCard">
              <div className="richTitle">
                <div>
                  <span>
                    EŞLEŞEN DOSYALAR
                  </span>

                  <b>
                    Hangi dosyayla devam
                    edelim?
                  </b>
                </div>

                <i>
                  {
                    ui.claimCards
                      .length
                  }
                </i>
              </div>

              <div className="claimCards">
                {ui.claimCards.map(
                  (claim) => (
                    <button
                      key={claim.id}
                      onClick={() =>
                        submitTurn(
                          claim.action
                            .value
                        )
                      }
                    >
                      <span>
                        {claim.title}
                      </span>

                      <b>
                        {claim.subtitle}
                      </b>

                      <small>
                        {claim.meta}
                      </small>

                      <em>
                        {claim.status}
                      </em>
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {ui.documentCards?.length >
            0 && (
            <div className="richCard">
              <div className="richTitle">
                <div>
                  <span>
                    TALHA'DAN DOSYALAR
                  </span>

                  <b>
                    Güvenli belgeler
                  </b>
                </div>

                <i>✓</i>
              </div>

              <div className="botFiles">
                {ui.documentCards.map(
                  (document) => (
                    <a
                      key={
                        document.id
                      }
                      href={`/api/demo-document/${document.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span className="pdfIcon">
                        PDF
                      </span>

                      <div>
                        <b>
                          {document.label}
                        </b>

                        <small>
                          Dosya{" "}
                          {
                            document.claimNo
                          }
                        </small>
                      </div>

                      <strong>
                        ↓
                      </strong>
                    </a>
                  )
                )}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </section>

        {/* COMPOSER */}

        <footer className="composerDock">
          <input
            ref={fileInputRef}
            type="file"
            hidden
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
            onChange={handleFiles}
          />

          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
              submitTurn(text);
            }}
          >
            <button
              type="button"
              className="attachButton"
              onClick={() =>
                fileInputRef.current?.click()
              }
              disabled={uploading}
            >
              {uploading ? "…" : "+"}
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
                  event.key === "Enter" &&
                  !event.shiftKey
                ) {
                  event.preventDefault();
                  submitTurn(text);
                }
              }}
              placeholder={
                voiceConnected
                  ? "Konuşabilir veya yazabilirsiniz…"
                  : "Talha'ya yazın…"
              }
              rows={1}
            />

            <button
              type="button"
              className={`micButton ${
                voiceConnected
                  ? "active"
                  : ""
              }`}
              onClick={
                voiceConnected
                  ? closeVoice
                  : startVoice
              }
            >
              ◉
            </button>

            <button
              type="submit"
              className="sendButton"
              disabled={
                busy ||
                !text.trim()
              }
            >
              ↑
            </button>
          </form>

          <span className="footerNote">
            AI destekli  · Ses ve
            veriler demo amaçlıdır
          </span>
        </footer>
      </section>
    </main>
  );
}
