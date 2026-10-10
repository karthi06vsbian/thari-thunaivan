/**
 * Illustrations for the website gallery. They stand in until real photographs are added:
 * put a photo in public/gallery and set its path on the item in lib/site.ts.
 */
const frame = "h-full w-full";

export function FloorArt() {
  return (
    <svg viewBox="0 0 400 250" className={frame} role="img" aria-label="Weaving floor with rows of looms" preserveAspectRatio="xMidYMid slice">
      <rect width="400" height="250" fill="#4a2f44" />
      <polygon points="0,250 400,250 300,90 100,90" fill="#5d3c55" />
      <rect x="100" y="30" width="200" height="60" fill="#3d2638" />
      {[120, 165, 210, 255].map((x) => <rect key={x} x={x} y="40" width="26" height="34" fill="#ffd9a0" opacity="0.75" />)}
      {[0, 1, 2, 3].map((row) => {
        const y = 100 + row * 36, w = 26 + row * 12, gap = 46 + row * 22, start = 200 - gap * 1.5 - w / 2;
        return [0, 1, 2, 3].map((col) => (
          <g key={`${row}-${col}`} transform={`translate(${start + col * gap} ${y})`}>
            <rect width={w} height={w * 0.55} rx="2" fill="#f3edf2" />
            <rect y={w * 0.4} width={w} height={w * 0.15} fill={["#efe7d8", "#3a6ea5", "#8f9ea3", "#a8326a"][col]} />
            <rect width={w} height="3" fill="#017e84" />
          </g>
        ));
      })}
    </svg>
  );
}

export function YarnArt() {
  const colours = ["#efe7d8", "#3a6ea5", "#a8326a", "#017e84", "#eda100", "#8f9ea3"];
  return (
    <svg viewBox="0 0 400 250" className={frame} role="img" aria-label="Cones of yarn on a rack" preserveAspectRatio="xMidYMid slice">
      <rect width="400" height="250" fill="#f3edf2" />
      {[70, 160].map((y, r) => (
        <g key={y}>
          <rect x="20" y={y + 62} width="360" height="8" fill="#4a2f44" />
          {colours.map((c, i) => (
            <g key={i} transform={`translate(${44 + i * 58} ${y})`}>
              <polygon points="10,0 26,0 36,60 0,60" fill={colours[(i + r * 2) % 6]} />
              <polygon points="10,0 26,0 28,12 8,12" fill="#fff" opacity="0.35" />
              <rect x="14" y="-8" width="8" height="10" fill="#b9a7b4" />
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}

export function RollsArt() {
  const colours = ["#efe7d8", "#3a6ea5", "#8f9ea3", "#a8326a", "#017e84"];
  return (
    <svg viewBox="0 0 400 250" className={frame} role="img" aria-label="Fabric rolls stacked in the godown" preserveAspectRatio="xMidYMid slice">
      <rect width="400" height="250" fill="#5d3c55" />
      <rect y="210" width="400" height="40" fill="#3d2638" />
      {[0, 1, 2].map((row) =>
        Array.from({ length: 6 - row }, (_, i) => {
          const x = 40 + row * 29 + i * 58, y = 178 - row * 50;
          return (
            <g key={`${row}-${i}`}>
              <circle cx={x} cy={y} r="28" fill={colours[(i + row) % 5]} />
              <circle cx={x} cy={y} r="18" fill="none" stroke="#000" strokeOpacity="0.12" strokeWidth="3" />
              <circle cx={x} cy={y} r="7" fill="#f3edf2" />
            </g>
          );
        }),
      )}
    </svg>
  );
}

export function InspectArt() {
  return (
    <svg viewBox="0 0 400 250" className={frame} role="img" aria-label="Fabric on an inspection table with a QR label" preserveAspectRatio="xMidYMid slice">
      <rect width="400" height="250" fill="#d9eef0" />
      <rect x="40" y="110" width="320" height="70" rx="6" fill="#efe7d8" />
      {Array.from({ length: 31 }, (_, i) => <line key={i} x1={45 + i * 10} y1="112" x2={45 + i * 10} y2="178" stroke="#d3c5aa" />)}
      <rect x="30" y="180" width="340" height="10" fill="#4a2f44" /><rect x="50" y="190" width="10" height="45" fill="#4a2f44" /><rect x="340" y="190" width="10" height="45" fill="#4a2f44" />
      {/* magnifier */}
      <circle cx="150" cy="140" r="30" fill="#fff" fillOpacity="0.55" stroke="#714b67" strokeWidth="6" />
      <rect x="172" y="162" width="46" height="9" rx="4" transform="rotate(40 172 162)" fill="#714b67" />
      {/* QR label */}
      <rect x="262" y="52" width="74" height="74" rx="6" fill="#fff" stroke="#714b67" strokeWidth="3" />
      {[0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4].map((c) => ((r * 3 + c * 5 + r * c) % 3 !== 0 ? <rect key={`${r}${c}`} x={272 + c * 11} y={62 + r * 11} width="9" height="9" fill="#0b0b0b" /> : null)))}
      <path d="M70 70l14 14 26-30" fill="none" stroke="#017e84" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
