import React, { useEffect, useMemo, useRef, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const API_URL = `${API_BASE_URL}/api/display/latest`;
const POLL_INTERVAL_MS = 1000;

const initialData = {
  event_id: null,
  device_id: "trash_sorter_001",
  item: null,
  category: null,
  decision: null,
  status: "waiting",
  guide: "검사 트레이 위에 분리배출할 물건을 올려주세요.",
  tts_message: null,
  led_color: "white",
  weight_g: 0,
  carbon_reduction_gco2e: 0,
  total_carbon_reduction_gco2e: 0,
  created_at: null,
};

const binMap = {
  plastic: { label: "플라스틱함", icon: "recycle" },
  paper: { label: "종이함", icon: "paper" },
  can: { label: "캔함", icon: "can" },
  general: { label: "일반쓰레기함", icon: "trash" },
  hold: { label: "x", icon: "warning" },
};

const binList = [
  { key: "can", label: "캔함", icon: "can" },
  { key: "paper", label: "종이함", icon: "paper" },
  { key: "plastic", label: "플라스틱함", icon: "recycle" },
  { key: "general", label: "일반쓰레기", icon: "trash" },
];

const objectVisuals = {
  plastic: { shape: "bottle", icon: "▯", defaultName: "PET병" },
  paper: { shape: "cup", icon: "◱", defaultName: "종이컵" },
  can: { shape: "can", icon: "◉", defaultName: "캔" },
  general: { shape: "trash", icon: "⌧", defaultName: "일반쓰레기" },
  unknown: { shape: "unknown", icon: "?", defaultName: "검사 대기 중" },
};

const itemPhotos = [
  { key: "petBottleWater", src: "/item-photos/pet-bottle-water-object.png", label: "물 남은 페트병" },
  { key: "canLeftover", src: "/item-photos/can-leftover-object.png", label: "물 남은 캔" },
  { key: "paperCupWet", src: "/item-photos/paper-cup-wet-object.png", label: "젖은 종이컵" },
  { key: "milkCarton", src: "/item-photos/milk-carton.png", label: "우유팩" },
  { key: "toothbrush", src: "/item-photos/toothbrush.png", label: "칫솔" },
  { key: "petBottle", src: "/item-photos/pet-bottle-object.png", label: "페트병" },
  { key: "can", src: "/item-photos/can-object.png", label: "캔" },
  { key: "paperCup", src: "/item-photos/paper-cup-object.png", label: "종이컵" },
];

const scenarioCopy = {
  normal: {
    itemLabel: null,
    photoKey: null,
    title: "배출 가능합니다",
    guide: "분류 결과에 따라 자동 배출을 시작합니다.",
    result: "정상 배출",
    tone: null,
  },
  petBottleWater: {
    itemLabel: "물 남은 페트병",
    photoKey: "petBottleWater",
    title: "현재 상태로는 배출할 수 없습니다",
    guide: "페트병 안의 내용물을 완전히 비워주세요. 비운 후 다시 검사해주세요.",
    result: "배출 보류",
    tone: "danger",
  },
  canLeftover: {
    itemLabel: "물 남은 캔",
    photoKey: "canLeftover",
    title: "현재 상태로는 배출할 수 없습니다",
    guide: "캔 안의 내용물을 완전히 비워주세요. 비운 후 다시 검사해주세요.",
    result: "배출 보류",
    tone: "danger",
  },
  paperCupWet: {
    itemLabel: "젖은 종이컵",
    photoKey: "paperCupWet",
    title: "현재 상태로는 배출할 수 없습니다",
    guide: "종이컵 안의 내용물을 비우고 물기를 제거해주세요. 충분히 말린 후 다시 검사해주세요.",
    result: "배출 보류",
    tone: "danger",
  },
  postProcessed: {
    itemLabel: null,
    photoKey: null,
    title: "후처리가 확인되었습니다",
    guide: "배출 가능한 상태입니다. 자동 배출을 시작합니다.",
    result: "후처리 성공",
    tone: "success",
  },
  receipt: {
    itemLabel: "영수증",
    photoKey: null,
    title: "배출 가능합니다",
    guide: "영수증은 종이류로 재활용하지 않습니다. 일반 쓰레기로 배출합니다.",
    result: "일반 쓰레기",
    tone: "success",
  },
  toothbrush: {
    itemLabel: "칫솔",
    photoKey: "toothbrush",
    title: "배출 가능합니다",
    guide: "칫솔은 복합 재질 품목입니다. 일반 쓰레기로 배출합니다.",
    result: "일반 쓰레기",
    tone: "success",
  },
  milkCarton: {
    itemLabel: "우유팩",
    photoKey: "milkCarton",
    title: "우유팩 배출 방법을 확인해주세요",
    guide: "내용물을 비우고 깨끗이 씻어 펼친 뒤 종이함에 배출해주세요.",
    result: "종이류",
    tone: "success",
  },
  review: {
    itemLabel: null,
    photoKey: null,
    title: "검수 확인이 필요합니다",
    guide: "깨진 유리류 또는 신뢰도가 낮은 품목은 안전을 위해 검수보류로 처리합니다.",
    result: "검수보류",
    tone: "danger",
  },
};

const statusCopy = {
  waiting: { badge: "대기 중", title: "검사 대기 중", result: "대기", tone: "neutral" },
  recognizing: { badge: "객체 인식 중", title: "인식 중", result: "인식 중", tone: "neutral" },
  success: { badge: "객체 인식 완료", title: "분류 성공", result: "분류 성공", tone: "success" },
  hold: { badge: "주의 필요", title: "분류 실패", result: "분류 실패", tone: "danger" },
  retry: { badge: "재시도 필요", title: "재시도", result: "재시도", tone: "danger" },
  fail: { badge: "인식 실패", title: "분류 실패", result: "분류 실패", tone: "danger" },
};

function formatCarbon(value) {
  return `${Number(value || 0).toFixed(1)}gCO2e`;
}

function formatWeight(value) {
  const number = Number(value || 0);
  return `${Number.isInteger(number) ? number : number.toFixed(1)}g`;
}

function normalizeDecision(data) {
  if (data.status !== "success") return "hold";
  return data.decision || data.category || "hold";
}

function inferObjectKind(data) {
  const text = `${data.item || ""} ${data.category || ""} ${data.decision || ""}`.toLowerCase();
  if (text.includes("can") || text.includes("캔")) return "can";
  if (text.includes("paper") || text.includes("종이") || text.includes("컵")) return "paper";
  if (text.includes("plastic") || text.includes("pet") || text.includes("페트")) return "plastic";
  if (text.includes("general") || text.includes("영수증") || text.includes("소주") || text.includes("유리")) return "general";
  return "unknown";
}

function hasAny(text, words) {
  return words.some((word) => text.includes(word));
}

function getScenarioKey(data) {
  const text = `${data.item || ""} ${data.category || ""} ${data.decision || ""} ${data.status || ""} ${data.guide || ""} ${
    data.tts_message || ""
  }`.toLowerCase();
  const isHold = data.status === "hold" || data.status === "retry" || data.decision === "hold";

  if (hasAny(text, ["후처리", "다시 검사", "비운 후 확인", "확인되었습니다"]) && data.status === "success") return "postProcessed";
  if (hasAny(text, ["영수증", "receipt"])) return "receipt";
  if (hasAny(text, ["칫솔", "toothbrush"])) return "toothbrush";
  if (hasAny(text, ["우유팩", "우유 팩", "milk carton"])) return "milkCarton";
  if (data.status === "fail" || hasAny(text, ["깨진 소주병", "깨진 소주잔", "broken glass"])) return "review";
  if (hasAny(text, ["젖은 종이컵", "wet paper cup"]) || (isHold && hasAny(text, ["종이컵", "종이 컵", "paper cup"]) && hasAny(text, ["수분", "젖", "물기", "moisture"]))) {
    return "paperCupWet";
  }
  if (
    hasAny(text, ["물 남은 페트병", "물 찬 페트병", "물찬 페트병", "물 들어있는 페트병"]) ||
    (isHold && hasAny(text, ["페트병", "pet", "플라스틱병"]) && hasAny(text, ["내용물", "물", "초과", "비워"]))
  ) {
    return "petBottleWater";
  }
  if (
    hasAny(text, ["음료가 들어있는 캔", "음료 들어있는 캔", "음료 남아있는 캔", "음료 남은 캔", "물 남은 캔"]) ||
    (isHold && hasAny(text, ["캔", "can"]) && hasAny(text, ["내용물", "음료", "물", "초과", "비워"]))
  ) {
    return "canLeftover";
  }
  return "normal";
}

function getItemPhotoByKey(photoKey, item) {
  if (photoKey) return itemPhotos.find((photo) => photo.key === photoKey) || null;
  const text = (item || "").toLowerCase();
  if (hasAny(text, ["우유팩", "우유 팩", "milk"])) return itemPhotos.find((photo) => photo.key === "milkCarton");
  if (hasAny(text, ["페트병", "pet", "플라스틱병"])) return itemPhotos.find((photo) => photo.key === "petBottle");
  if (hasAny(text, ["캔", "can"])) return itemPhotos.find((photo) => photo.key === "can");
  if (hasAny(text, ["종이컵", "종이 컵", "paper cup"])) return itemPhotos.find((photo) => photo.key === "paperCup");
  return null;
}

function speakOnce(message, eventId, lastSpokenRef) {
  if (!message || !eventId || lastSpokenRef.current === eventId) return;
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = "ko-KR";
  utterance.rate = 1;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
  lastSpokenRef.current = eventId;
}

function getSpeechMessage(data) {
  if (!data) return null;
  const scenarioInfo = scenarioCopy[getScenarioKey(data)] || scenarioCopy.normal;
  if (scenarioInfo.title && scenarioInfo.guide) return `${scenarioInfo.title}. ${scenarioInfo.guide}`;
  return data.tts_message;
}

function getDisplayLedColor(tone) {
  if (tone === "danger") return "red";
  if (tone === "success") return "blue";
  return "white";
}

export default function App() {
  const [displayData, setDisplayData] = useState(initialData);
  const [isConnected, setIsConnected] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const lastSpokenEventId = useRef(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchLatest() {
      try {
        const response = await fetch(API_URL, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        if (!payload.success) throw new Error(payload.error?.message || "API error");

        if (!isMounted) return;
        setDisplayData(payload.data || initialData);
        setIsConnected(true);
        if (ttsEnabled) speakOnce(getSpeechMessage(payload.data), payload.data?.event_id, lastSpokenEventId);
      } catch {
        if (!isMounted) return;
        setIsConnected(false);
      }
    }

    fetchLatest();
    const timer = window.setInterval(fetchLatest, POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, [ttsEnabled]);

  const view = useMemo(() => {
    const status = displayData.status || "waiting";
    const statusInfo = statusCopy[status] || statusCopy.waiting;
    const objectKind = inferObjectKind(displayData);
    const objectInfo = objectVisuals[objectKind] || objectVisuals.unknown;
    const decision = normalizeDecision(displayData);
    const binInfo = binMap[decision] || binMap.hold;
    const scenarioKey = getScenarioKey(displayData);
    const scenarioInfo = scenarioCopy[scenarioKey] || scenarioCopy.normal;
    const item = scenarioInfo.itemLabel || displayData.item || objectInfo.defaultName;
    const tone = scenarioInfo.tone || statusInfo.tone;
    const isDanger = tone === "danger";
    const guide =
      scenarioKey === "normal" && displayData.guide
        ? displayData.guide
        : scenarioInfo.guide ||
          (status === "success"
            ? `${binInfo.label}에 배출해주세요.`
            : "상태를 확인한 뒤 다시 배출해주세요.");
    const messageTitle = scenarioInfo.title || statusInfo.title;
    const resultText = scenarioInfo.result || statusInfo.result;
    const photo = getItemPhotoByKey(scenarioInfo.photoKey, item);
    const ledColor = getDisplayLedColor(tone);

    return { status, statusInfo, objectKind, objectInfo, decision, binInfo, item, isDanger, guide, photo, tone, messageTitle, resultText, ledColor };
  }, [displayData]);

  const tone = view.tone === "danger" ? "danger" : view.tone === "success" ? "success" : "neutral";
  return (
    <main className={`display-page ${tone}`}>
      <aside className="display-brand-panel">
        <div className="display-logo-card">
          <img src="/CCheck.jpg" alt="쏙쏙이 CCheck" />
          <p>AIoT로 확인하고, 올바른 분리배출로 지구를 지켜요</p>
          <div className="display-feature-row">
            <Feature icon="scan" label="AI 인식" /><Feature icon="iot" label="IoT 연동" /><Feature icon="leaf" label="지구 보호" />
          </div>
        </div>
        <div className="display-carbon-card">
          <span className="metric-icon"><Icon name="leaf" /></span>
          <span>누적 탄소배출 감소량</span>
          <strong>{formatCarbon(displayData.total_carbon_reduction_gco2e)}</strong>
        </div>
      </aside>

      <section className="display-center-panel">
        <div className="display-stage">
          <div className="display-status"><span>{tone === "danger" ? "!" : tone === "success" ? "✓" : "·"}</span>{tone === "neutral" ? view.statusInfo.badge : view.messageTitle}</div>
          <h2>{view.item}</h2>
          <div className={`display-item-layout ${view.photo ? "" : "no-photo"}`}>
            {view.photo && <div className="item-photo-frame"><i className="photo-corner photo-top-left"/><i className="photo-corner photo-top-right"/><i className="photo-corner photo-bottom-left"/><i className="photo-corner photo-bottom-right"/><img src={view.photo.src} alt={view.photo.label}/></div>}
            <div className="display-guide-card"><p>{view.guide}</p></div>
          </div>
        </div>
        <div className="display-result-banner">
          <p>{tone === "danger" ? "안전한 방법으로 별도 배출이 필요합니다." : "분류 결과에 따라 자동 배출을 시작합니다."}</p>
          <strong><b>{tone === "danger" ? "!" : "✓"}</b>{tone === "danger" ? "분류 실패" : "배출 가능"}</strong>
        </div>
      </section>

      <aside className="display-side-panel">
        <Metric icon={view.binInfo.icon} label="배출함" value={view.binInfo.label} />
        <Metric icon="scale" label="무게" value={formatWeight(displayData.weight_g)} />
        <Metric icon="co2" label="탄소배출 감소량" value={formatCarbon(displayData.carbon_reduction_gco2e)} />
        <Metric icon="server" label="LED" value={<LedValue color={view.ledColor} />} />
        <button className="tts-button" onClick={() => setTtsEnabled(v => !v)}>TTS {ttsEnabled ? "켜짐" : "꺼짐"}</button>
      </aside>
    </main>
  );
}

function Metric({ icon, label, value }) {
  return <article className="metric"><span className="metric-icon"><Icon name={icon}/></span><span className="metric-label">{label}</span><strong>{value}</strong></article>;
}

function Feature({ icon, label }) {
  return (
    <div className="feature">
      <span>
        <Icon name={icon} />
      </span>
      <strong>{label}</strong>
    </div>
  );
}

function InfoCard({ icon, label, value, danger = false, compact = false }) {
  return (
    <article className={`info-card${danger ? " danger" : ""}${compact ? " compact" : ""}`}>
      <div className="info-icon">
        <Icon name={icon} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function LedValue({ color }) {
  const labels = {
    red: "빨간색",
    blue: "파란색",
    white: "흰색",
    green: "초록색",
    yellow: "노란색",
    gray: "회색",
  };
  return (
    <span className="led-value" data-led={color}>
      <i />
      {labels[color] || color}
    </span>
  );
}

function Icon({ name }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  switch (name) {
    case "scan":
      return (
        <svg {...common}>
          <path d="M7 3H5a2 2 0 0 0-2 2v2" />
          <path d="M17 3h2a2 2 0 0 1 2 2v2" />
          <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
          <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
          <path d="M8 12h8" />
          <path d="M12 8v8" />
          <circle cx="12" cy="12" r="2.2" />
        </svg>
      );
    case "iot":
      return (
        <svg {...common}>
          <path d="M12 19v-4" />
          <circle cx="12" cy="20" r="1" fill="currentColor" stroke="none" />
          <path d="M7.8 13.2a6 6 0 0 1 8.4 0" />
          <path d="M4.6 10a10.5 10.5 0 0 1 14.8 0" />
          <path d="M9.8 16a3.2 3.2 0 0 1 4.4 0" />
        </svg>
      );
    case "leaf":
      return (
        <svg {...common}>
          <path d="M5 19c7.5.6 13-4.2 14-14-8.8 1-13.6 6.4-14 14Z" />
          <path d="M5 19c2.8-4.2 6.2-7.2 10.3-9.2" />
          <path d="M9 20h8" />
        </svg>
      );
    case "can":
      return (
        <svg {...common}>
          <ellipse cx="12" cy="5" rx="5.4" ry="2" />
          <path d="M6.6 5v14c0 1.1 2.4 2 5.4 2s5.4-.9 5.4-2V5" />
          <path d="M8.4 8.5c2.1.7 5.1.7 7.2 0" />
        </svg>
      );
    case "paper":
      return (
        <svg {...common}>
          <path d="M6 3h9l3 3v15H6z" />
          <path d="M15 3v4h4" />
          <path d="M9 11h6" />
          <path d="M9 15h6" />
          <path d="M9 19h4" />
        </svg>
      );
    case "recycle":
      return (
        <svg {...common}>
          <path d="m7.4 8.6 2.1-3.6 2.1 3.6" />
          <path d="M9.5 5h3.7a2 2 0 0 1 1.7 1l1.1 1.9" />
          <path d="m16.8 9.2 2.1 3.6h-4.2" />
          <path d="m18.9 12.8-1.8 3.1a2 2 0 0 1-1.7 1H13" />
          <path d="M10.4 17H6.2l2.1-3.6" />
          <path d="m6.2 17 1.7 2.9" />
        </svg>
      );
    case "trash":
      return (
        <svg {...common}>
          <path d="M4 7h16" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M6 7l1 14h10l1-14" />
          <path d="M9 7V4h6v3" />
        </svg>
      );
    case "warning":
      return (
        <svg {...common}>
          <path d="M12 8v5" />
          <path d="M12 17h.01" />
          <path d="M10.3 4.3 2.8 17.2A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.8L13.7 4.3a2 2 0 0 0-3.4 0Z" />
        </svg>
      );
    case "scale":
      return (
        <svg {...common}>
          <path d="M6 21h12" />
          <path d="M8 21h8l1-10H7z" />
          <path d="M9 11a3 3 0 0 1 6 0" />
          <path d="M12 14v2" />
        </svg>
      );
    case "co2":
      return (
        <svg {...common}>
          <path d="M7.2 16.5a4.2 4.2 0 1 1 .5-8.4 5.3 5.3 0 0 1 10.2 1.8 3.3 3.3 0 0 1-.7 6.6" />
          <path d="M8.4 13.7c-.3.4-.8.7-1.4.7a1.8 1.8 0 0 1 0-3.6c.6 0 1.1.3 1.4.7" />
          <path d="M12 14.4a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Z" />
          <path d="M15.7 11.1h1.8l-1.8 3h2" />
        </svg>
      );
    case "server":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="6" rx="2" />
          <rect x="4" y="14" width="16" height="6" rx="2" />
          <path d="M8 7h.01" />
          <path d="M8 17h.01" />
        </svg>
      );
    default:
      return null;
  }
}
