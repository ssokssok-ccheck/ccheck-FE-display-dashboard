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
  can: { label: "캔류함", icon: "can" },
  general: { label: "일반쓰레기", icon: "trash" },
  hold: { label: "분류 불가", icon: "warning" },
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

export default function App() {
  const [displayData, setDisplayData] = useState(initialData);
  const [isConnected, setIsConnected] = useState(false);
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
        speakOnce(payload.data?.tts_message, payload.data?.event_id, lastSpokenEventId);
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
  }, []);

  const view = useMemo(() => {
    const status = displayData.status || "waiting";
    const statusInfo = statusCopy[status] || statusCopy.waiting;
    const objectKind = inferObjectKind(displayData);
    const objectInfo = objectVisuals[objectKind] || objectVisuals.unknown;
    const decision = normalizeDecision(displayData);
    const binInfo = binMap[decision] || binMap.hold;
    const item = displayData.item || objectInfo.defaultName;
    const isDanger = statusInfo.tone === "danger";
    const guide =
      displayData.guide ||
      (status === "success"
        ? `${binInfo.label}에 배출해주세요.`
        : "상태를 확인한 뒤 다시 배출해주세요.");

    return { status, statusInfo, objectKind, objectInfo, decision, binInfo, item, isDanger, guide };
  }, [displayData]);

  return (
    <main
      className="display-shell"
      data-status={view.status}
      data-decision={view.decision}
      data-tone={view.statusInfo.tone}
    >
      <section className="left-column">
        <article className="brand-card">
          <img className="brand-image" src="/CCheck.jpg" alt="쏙쏙이 CCheck" />
          <div className="feature-strip" aria-label="핵심 기능">
            <Feature icon="scan" label="AI 인식" />
            <Feature icon="iot" label="IoT 연동" />
            <Feature icon="leaf" label="지구 보호" />
          </div>
        </article>

        <article className="carbon-card">
          <div className="leaf-mark">
            <Icon name="leaf" />
          </div>
          <div>
            <span>누적 탄소배출 감소량</span>
            <strong>{formatCarbon(displayData.total_carbon_reduction_gco2e)}</strong>
          </div>
        </article>
      </section>

      <section className="center-column">
        <article className="object-card">
          <div className="status-badge">
            <span>{view.statusInfo.tone === "success" ? "✓" : view.statusInfo.tone === "danger" ? "!" : "·"}</span>
            {view.statusInfo.badge}
          </div>
          <h1>{view.item}</h1>
          <div className={`object-visual ${view.objectInfo.shape}`}>
            <span className="scan-corner top-left" />
            <span className="scan-corner top-right" />
            <span className="scan-corner bottom-left" />
            <span className="scan-corner bottom-right" />
            <div className="object-plate">
              <span>{view.objectInfo.icon}</span>
            </div>
          </div>
          <p className="object-guide">{view.guide}</p>
        </article>

        <article className="result-banner">
          <p>{view.status === "success" ? `${view.binInfo.label}에 배출해주세요.` : view.guide}</p>
          <div className="result-line">
            <span className="result-icon">{view.statusInfo.tone === "success" ? "✓" : "!"}</span>
            <strong>{view.statusInfo.result}</strong>
          </div>
        </article>
      </section>

      <aside className="right-column">
        <InfoCard icon={view.binInfo.icon} label="배출함" value={view.binInfo.label} danger={view.isDanger} />
        <InfoCard icon="scale" label="무게" value={formatWeight(displayData.weight_g)} danger={view.isDanger} />
        <InfoCard
          icon="co2"
          label="이번 감소량"
          value={formatCarbon(displayData.carbon_reduction_gco2e)}
          danger={view.isDanger}
        />
        <InfoCard icon="server" label="서버" value={isConnected ? "연결됨" : "연결 안 됨"} danger={!isConnected} compact />
      </aside>

      <section className="bin-dock" aria-label="수거함 목록">
        {binList.map((bin) => (
          <div
            key={bin.key}
            className={`bin-chip${view.decision === bin.key ? " active" : ""}`}
            data-bin={bin.key}
          >
            <span>
              <Icon name={bin.icon} />
            </span>
            <strong>{bin.label}</strong>
          </div>
        ))}
      </section>
    </main>
  );
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
