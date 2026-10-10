/** Animated illustration for the transport page: a loaded truck driving past the mill. */
export function TruckScene({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 800 220" role="img" aria-label="A truck carrying fabric rolls on the highway" className={className} preserveAspectRatio="xMidYMid slice">
      <style>{`
        .ts-road { animation: ts-dash 0.9s linear infinite; }
        .ts-far { animation: ts-slide 40s linear infinite; }
        .ts-near { animation: ts-slide 14s linear infinite; }
        .ts-cloud { animation: ts-slide 60s linear infinite; }
        .ts-wheel { animation: ts-spin 0.7s linear infinite; transform-box: fill-box; transform-origin: center; }
        .ts-truck { animation: ts-bob 0.6s ease-in-out infinite; }
        @keyframes ts-dash { to { stroke-dashoffset: -80; } }
        @keyframes ts-slide { to { transform: translateX(-800px); } }
        @keyframes ts-spin { to { transform: rotate(360deg); } }
        @keyframes ts-bob { 50% { transform: translateY(-1.5px); } }
        @media (prefers-reduced-motion: reduce) { .ts-road, .ts-far, .ts-near, .ts-cloud, .ts-wheel, .ts-truck { animation: none; } }
      `}</style>
      <defs>
        <linearGradient id="ts-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#714b67" />
          <stop offset="1" stopColor="#4a2f44" />
        </linearGradient>
      </defs>
      <rect width="800" height="220" fill="url(#ts-sky)" />
      <circle cx="660" cy="52" r="26" fill="#ffd9a0" opacity="0.9" />

      <g className="ts-cloud" fill="#fff" opacity="0.18">
        {[0, 800].map((x) => (
          <g key={x} transform={`translate(${x} 0)`}>
            <ellipse cx="120" cy="50" rx="46" ry="14" /><ellipse cx="150" cy="40" rx="30" ry="12" />
            <ellipse cx="470" cy="34" rx="56" ry="13" /><ellipse cx="510" cy="26" rx="28" ry="10" />
          </g>
        ))}
      </g>

      {/* Hills and a mill far away, repeated so the loop is seamless. */}
      <g className="ts-far" fill="#3d2638">
        {[0, 800].map((x) => (
          <g key={x} transform={`translate(${x} 0)`}>
            <path d="M0 160 Q120 96 240 150 T480 138 T800 160 V170 H0Z" />
            <rect x="540" y="112" width="90" height="48" /><rect x="556" y="84" width="12" height="30" /><rect x="586" y="94" width="12" height="20" />
            <path d="M540 112l22-14v14l22-14v14l22-14v14l24-14v14z" />
          </g>
        ))}
      </g>

      {/* Roadside trees and poles, moving faster than the hills. */}
      <g className="ts-near">
        {[0, 800].map((x) => (
          <g key={x} transform={`translate(${x} 0)`}>
            {[60, 300, 520, 730].map((t) => (
              <g key={t}>
                <rect x={t - 2} y="140" width="4" height="26" fill="#2c1b29" />
                <circle cx={t} cy="134" r="14" fill="#017e84" opacity="0.85" />
              </g>
            ))}
          </g>
        ))}
      </g>

      <rect y="166" width="800" height="54" fill="#2c1b29" />
      <line className="ts-road" x1="0" y1="194" x2="800" y2="194" stroke="#fff" strokeOpacity="0.55" strokeWidth="4" strokeDasharray="40 40" />

      <g className="ts-truck">
        {/* Load bed with fabric rolls */}
        <rect x="250" y="96" width="210" height="76" rx="6" fill="#f3edf2" />
        <rect x="250" y="96" width="210" height="14" rx="6" fill="#017e84" />
        {[272, 306, 340, 374, 408].map((x, i) => (
          <g key={x}>
            <rect x={x} y="118" width="26" height="46" rx="13" fill={["#efe7d8", "#3a6ea5", "#8f9ea3", "#a8326a", "#efe7d8"][i]} />
            <circle cx={x + 13} cy="131" r="5" fill="#fff" opacity="0.6" />
          </g>
        ))}
        {/* Cab */}
        <path d="M466 112h52l34 30v30h-86z" fill="#017e84" />
        <path d="M478 120h34l22 20h-56z" fill="#d9eef0" />
        <rect x="540" y="150" width="14" height="8" rx="2" fill="#ffd9a0" />
        <rect x="244" y="168" width="312" height="8" rx="3" fill="#1c1118" />
        {[300, 350, 500].map((x) => (
          <g key={x} className="ts-wheel">
            <circle cx={x} cy="180" r="17" fill="#1c1118" />
            <circle cx={x} cy="180" r="7" fill="#c9bcc6" />
            <rect x={x - 1.5} y="165" width="3" height="30" fill="#c9bcc6" />
          </g>
        ))}
      </g>
    </svg>
  );
}
