const SLEEPER_SPACING = 28;
const ANIMATION_SPEED = "1.15s";

function Wheel({ cx, cy, radius, spokes = 8 }: { cx: number; cy: number; radius: number; spokes?: number }) {
  return (
    <g
      className="rb-wheel"
      style={{
        transformOrigin: `${cx}px ${cy}px`,
      }}
    >
      <circle cx={cx} cy={cy} r={radius} fill="url(#wheelGradient)" stroke="#111827" strokeWidth="3" />

      <circle cx={cx} cy={cy} r={radius - 5} fill="#182231" stroke="#64748b" strokeWidth="2" />

      {Array.from({ length: spokes }).map((_, index) => {
        const angle = (Math.PI * 2 * index) / spokes;
        const spokeRadius = radius - 7;

        return (
          <line
            key={index}
            x1={cx}
            y1={cy}
            x2={cx + Math.cos(angle) * spokeRadius}
            y2={cy + Math.sin(angle) * spokeRadius}
            stroke="#94a3b8"
            strokeWidth="2"
            strokeLinecap="round"
          />
        );
      })}

      <circle cx={cx} cy={cy} r="6" fill="#d8a52e" stroke="#713f12" strokeWidth="2" />
    </g>
  );
}

function SmokePuff({ cx, cy, delay, size = 1 }: { cx: number; cy: number; delay: string; size?: number }) {
  return (
    <g
      className="rb-smoke"
      style={{
        animationDelay: delay,
        transformOrigin: `${cx}px ${cy}px`,
      }}
    >
      <circle cx={cx} cy={cy} r={10 * size} fill="url(#smokeGradient)" />
      <circle cx={cx + 8 * size} cy={cy - 2 * size} r={7 * size} fill="url(#smokeGradient)" />
      <circle cx={cx - 6 * size} cy={cy + 1 * size} r={6 * size} fill="url(#smokeGradient)" />
    </g>
  );
}

export default function SteamTrain() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-6">
      <style>{`
        :root {
          --rb-speed: ${ANIMATION_SPEED};
        }

        @keyframes rbTrainBounce {
          0%,
          100% {
            transform: translateY(0) rotate(-0.12deg);
          }

          50% {
            transform: translateY(-3px) rotate(0.12deg);
          }
        }

        @keyframes rbWheelSpin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes rbTrackMove {
          to {
            transform: translateX(-${SLEEPER_SPACING}px);
          }
        }

        @keyframes rbRodMove {
          0%,
          100% {
            transform: translate(0, 0);
          }

          25% {
            transform: translate(3px, -5px);
          }

          50% {
            transform: translate(0, 0);
          }

          75% {
            transform: translate(-3px, 5px);
          }
        }

        @keyframes rbPistonMove {
          0%,
          100% {
            transform: translateX(0);
          }

          50% {
            transform: translateX(8px);
          }
        }

        @keyframes rbSmokeRise {
          0% {
            opacity: 0;
            transform: translate(0, 4px) scale(0.45);
          }

          14% {
            opacity: 0.75;
          }

          65% {
            opacity: 0.35;
          }

          100% {
            opacity: 0;
            transform: translate(-30px, -92px) scale(1.8);
          }
        }

        @keyframes rbSteamBurst {
          0%,
          52% {
            opacity: 0;
            transform: translate(0, 0) scale(0.5);
          }

          63% {
            opacity: 0.65;
          }

          100% {
            opacity: 0;
            transform: translate(-28px, 8px) scale(1.45);
          }
        }

        @keyframes rbHeadlight {
          0%,
          100% {
            opacity: 0.45;
          }

          50% {
            opacity: 0.9;
          }
        }

        @keyframes rbWindowGlow {
          0%,
          100% {
            opacity: 0.8;
          }

          50% {
            opacity: 1;
          }
        }

        @keyframes rbLoadingDot {
          0%,
          70%,
          100% {
            opacity: 0.25;
            transform: translateY(0);
          }

          35% {
            opacity: 1;
            transform: translateY(-4px);
          }
        }

        @keyframes rbBackgroundDrift {
          from {
            transform: translateX(0);
          }

          to {
            transform: translateX(-80px);
          }
        }

        .rb-train {
          animation: rbTrainBounce calc(var(--rb-speed) / 2) ease-in-out infinite;
          transform-box: fill-box;
          transform-origin: center bottom;
          will-change: transform;
        }

        .rb-wheel {
          animation: rbWheelSpin var(--rb-speed) linear infinite;
          transform-box: view-box;
          will-change: transform;
        }

        .rb-sleepers {
          animation: rbTrackMove var(--rb-speed) linear infinite;
          will-change: transform;
        }

        .rb-rod {
          animation: rbRodMove var(--rb-speed) linear infinite;
          transform-box: fill-box;
          transform-origin: center;
          will-change: transform;
        }

        .rb-piston {
          animation: rbPistonMove var(--rb-speed) ease-in-out infinite;
          transform-box: fill-box;
          transform-origin: left center;
          will-change: transform;
        }

        .rb-smoke {
          animation: rbSmokeRise 2.8s ease-out infinite;
          opacity: 0;
          transform-box: view-box;
          will-change: transform, opacity;
        }

        .rb-steam {
          animation: rbSteamBurst 1.8s ease-out infinite;
          transform-box: fill-box;
          transform-origin: center;
          will-change: transform, opacity;
        }

        .rb-headlight {
          animation: rbHeadlight 1.8s ease-in-out infinite;
        }

        .rb-window {
          animation: rbWindowGlow 2.4s ease-in-out infinite;
        }

        .rb-background-lines {
          animation: rbBackgroundDrift 5s linear infinite;
        }

        .rb-loading-dot {
          display: inline-block;
          animation: rbLoadingDot 1.25s ease-in-out infinite;
        }

        .rb-loading-dot:nth-child(2) {
          animation-delay: 0.16s;
        }

        .rb-loading-dot:nth-child(3) {
          animation-delay: 0.32s;
        }

        @media (prefers-reduced-motion: reduce) {
          .rb-train,
          .rb-wheel,
          .rb-sleepers,
          .rb-rod,
          .rb-piston,
          .rb-smoke,
          .rb-steam,
          .rb-headlight,
          .rb-window,
          .rb-background-lines,
          .rb-loading-dot {
            animation: none;
          }

          .rb-smoke {
            opacity: 0.35;
          }
        }
      `}</style>

      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(14,165,233,0.18),transparent_45%)]" />

      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-80 w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-500/10 blur-3xl"
      />

      <section aria-live="polite" aria-busy="true" className="relative z-10 flex w-full max-w-4xl flex-col items-center">
        <svg
          viewBox="0 0 520 270"
          role="img"
          aria-labelledby="train-title train-description"
          className="h-auto w-full max-w-3xl overflow-visible"
          xmlns="http://www.w3.org/2000/svg"
        >
          <title id="train-title">Locomotora de vapor de RailBoard</title>

          <desc id="train-description">Locomotora animada circulando mientras se cargan los datos de la estación.</desc>

          <defs>
            <linearGradient id="skyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#071426" />
              <stop offset="100%" stopColor="#0e2944" />
            </linearGradient>

            <linearGradient id="boilerGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e63b42" />
              <stop offset="48%" stopColor="#bd1f2d" />
              <stop offset="100%" stopColor="#761522" />
            </linearGradient>

            <linearGradient id="cabinGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#25364a" />
              <stop offset="100%" stopColor="#101923" />
            </linearGradient>

            <linearGradient id="metalGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#cbd5e1" />
              <stop offset="45%" stopColor="#64748b" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>

            <linearGradient id="wheelGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="100%" stopColor="#080d14" />
            </linearGradient>

            <radialGradient id="windowGradient">
              <stop offset="0%" stopColor="#fff7b2" />
              <stop offset="60%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#d97706" />
            </radialGradient>

            <radialGradient id="smokeGradient">
              <stop offset="0%" stopColor="#f8fafc" stopOpacity="0.95" />
              <stop offset="65%" stopColor="#cbd5e1" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#64748b" stopOpacity="0" />
            </radialGradient>

            <radialGradient id="headlightGradient">
              <stop offset="0%" stopColor="#fffde7" stopOpacity="0.95" />
              <stop offset="45%" stopColor="#fde68a" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
            </radialGradient>

            <filter id="trainShadow" x="-30%" y="-30%" width="160%" height="180%">
              <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#020617" floodOpacity="0.6" />
            </filter>

            <filter id="softBlur" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="5" />
            </filter>

            <filter id="windowGlow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Fondo integrado en el SVG */}
          <rect x="0" y="0" width="520" height="270" rx="28" fill="url(#skyGradient)" opacity="0.72" />

          {/* Líneas de velocidad ambientales */}
          <g className="rb-background-lines" stroke="#38bdf8" strokeLinecap="round" opacity="0.12">
            <line x1="40" y1="90" x2="120" y2="90" strokeWidth="2" />
            <line x1="155" y1="48" x2="210" y2="48" strokeWidth="1.5" />
            <line x1="350" y1="92" x2="435" y2="92" strokeWidth="2" />
            <line x1="450" y1="56" x2="505" y2="56" strokeWidth="1.5" />
            <line x1="540" y1="90" x2="620" y2="90" strokeWidth="2" />
          </g>

          {/* Sombra sobre la vía */}
          <ellipse cx="294" cy="220" rx="190" ry="13" fill="#020617" opacity="0.48" filter="url(#softBlur)" />

          {/* Traviesas en movimiento */}
          <g className="rb-sleepers">
            {Array.from({ length: 23 }).map((_, index) => {
              const x = -56 + index * SLEEPER_SPACING;

              return (
                <rect
                  key={x}
                  x={x}
                  y="220"
                  width="17"
                  height="25"
                  rx="2"
                  fill="#513426"
                  stroke="#2e211b"
                  strokeWidth="2"
                  transform={`rotate(2 ${x + 8.5} 232.5)`}
                />
              );
            })}
          </g>

          {/* Raíles */}
          <rect x="0" y="214" width="520" height="7" rx="3" fill="#1f2937" />
          <rect x="0" y="217" width="520" height="2" fill="#94a3b8" opacity="0.8" />

          <rect x="0" y="238" width="520" height="7" rx="3" fill="#1f2937" />
          <rect x="0" y="239" width="520" height="2" fill="#64748b" />

          <g className="rb-train" filter="url(#trainShadow)">
            {/* Humo */}
            <SmokePuff cx={178} cy={45} delay="-0.2s" size={0.9} />
            <SmokePuff cx={178} cy={45} delay="-1.1s" size={1.05} />
            <SmokePuff cx={178} cy={45} delay="-2s" size={1.15} />

            {/* Vapor del cilindro */}
            <g className="rb-steam" style={{ animationDelay: "-0.5s" }} opacity="0">
              <circle cx="129" cy="194" r="9" fill="url(#smokeGradient)" />
              <circle cx="120" cy="196" r="7" fill="url(#smokeGradient)" />
            </g>

            {/* Tender */}
            <path
              d="M365 129 L461 129 L472 176 L359 176 Z"
              fill="url(#cabinGradient)"
              stroke="#08111d"
              strokeWidth="4"
              strokeLinejoin="round"
            />

            <path d="M373 127 Q414 107 454 127 Z" fill="#161f2b" stroke="#08111d" strokeWidth="4" />

            <path d="M378 129 Q414 115 450 129" fill="none" stroke="#475569" strokeWidth="4" strokeLinecap="round" />

            <rect x="363" y="168" width="105" height="12" rx="3" fill="#111827" />

            {/* Cabina */}
            <path
              d="M282 78 H355 Q363 78 363 86 V174 H276 V86 Q276 78 282 78 Z"
              fill="url(#cabinGradient)"
              stroke="#08111d"
              strokeWidth="4"
            />

            <path d="M268 76 Q270 65 282 64 H358 Q370 65 373 76 Z" fill="#17202c" stroke="#08111d" strokeWidth="4" strokeLinejoin="round" />

            {/* Ventanas */}
            <g className="rb-window" filter="url(#windowGlow)">
              <rect x="291" y="91" width="22" height="31" rx="4" fill="url(#windowGradient)" stroke="#713f12" strokeWidth="3" />

              <rect x="326" y="91" width="22" height="31" rx="4" fill="url(#windowGradient)" stroke="#713f12" strokeWidth="3" />
            </g>

            <line x1="320" y1="84" x2="320" y2="168" stroke="#64748b" strokeWidth="3" opacity="0.5" />

            {/* Caldera */}
            <rect x="143" y="105" width="159" height="69" rx="34.5" fill="url(#boilerGradient)" stroke="#5f101c" strokeWidth="4" />

            <path d="M151 121 C190 103 252 103 294 120" fill="none" stroke="#fb7185" strokeWidth="4" strokeLinecap="round" opacity="0.45" />

            {/* Frontal */}
            <circle cx="143" cy="139" r="35" fill="#a81829" stroke="#5f101c" strokeWidth="4" />

            <circle cx="137" cy="139" r="26" fill="#bf2636" stroke="#781424" strokeWidth="3" />

            <circle cx="137" cy="139" r="5" fill="#fbbf24" stroke="#713f12" strokeWidth="2" />

            {/* Aros de la caldera */}
            {[183, 228, 273].map((x) => (
              <rect key={x} x={x} y="106" width="7" height="67" rx="3" fill="#741521" opacity="0.75" />
            ))}

            {/* Chimenea */}
            <path d="M162 105 L166 72 H190 L195 105 Z" fill="#17202c" stroke="#080d14" strokeWidth="4" strokeLinejoin="round" />

            <path d="M158 72 L163 57 H194 L199 72 Z" fill="#111827" stroke="#080d14" strokeWidth="4" strokeLinejoin="round" />

            <ellipse cx="178.5" cy="57" rx="16" ry="5" fill="#273548" stroke="#080d14" strokeWidth="3" />

            {/* Domo */}
            <path d="M220 106 V87 Q220 73 235 73 Q250 73 250 87 V106 Z" fill="url(#metalGradient)" stroke="#273548" strokeWidth="3" />

            <ellipse cx="235" cy="75" rx="15" ry="5" fill="#94a3b8" stroke="#273548" strokeWidth="3" />

            {/* Faro */}
            <g className="rb-headlight">
              <ellipse cx="105" cy="126" rx="46" ry="29" fill="url(#headlightGradient)" opacity="0.65" />
            </g>

            <rect x="116" y="116" width="19" height="21" rx="5" fill="#17202c" stroke="#080d14" strokeWidth="3" />

            <circle cx="116" cy="126.5" r="8" fill="#fff7b2" stroke="#d97706" strokeWidth="3" />

            {/* Bastidor */}
            <rect x="117" y="167" width="352" height="16" rx="4" fill="#17202c" stroke="#080d14" strokeWidth="4" />

            <rect x="136" y="174" width="212" height="9" rx="3" fill="#8b1a28" />

            {/* Quitapiedras */}
            <path d="M113 165 L79 184 H121" fill="#17202c" stroke="#080d14" strokeWidth="5" strokeLinejoin="round" />

            <path d="M87 176 L104 189" stroke="#64748b" strokeWidth="3" />

            <path d="M96 171 L113 184" stroke="#64748b" strokeWidth="3" />

            {/* Enganche */}
            <rect x="469" y="170" width="14" height="10" rx="3" fill="#475569" />
            <circle cx="487" cy="175" r="6" fill="#111827" stroke="#64748b" strokeWidth="3" />

            {/* Ruedas */}
            <Wheel cx={164} cy={194} radius={25} />
            <Wheel cx={226} cy={194} radius={30} spokes={10} />
            <Wheel cx={297} cy={194} radius={30} spokes={10} />
            <Wheel cx={390} cy={197} radius={21} />
            <Wheel cx={443} cy={197} radius={21} />

            {/* Bielas */}
            <g className="rb-rod">
              <line x1="164" y1="198" x2="297" y2="198" stroke="#d6a533" strokeWidth="7" strokeLinecap="round" />

              <line x1="226" y1="198" x2="297" y2="190" stroke="#e5e7eb" strokeWidth="5" strokeLinecap="round" />

              <circle cx="164" cy="198" r="5" fill="#facc15" stroke="#713f12" strokeWidth="2" />

              <circle cx="226" cy="198" r="5" fill="#facc15" stroke="#713f12" strokeWidth="2" />

              <circle cx="297" cy="198" r="5" fill="#facc15" stroke="#713f12" strokeWidth="2" />
            </g>

            {/* Pistón */}
            <g className="rb-piston">
              <rect x="121" y="182" width="52" height="8" rx="4" fill="#cbd5e1" stroke="#334155" strokeWidth="2" />
            </g>
          </g>
        </svg>

        <div className="-mt-2 text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-sky-400/70" />

            <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
              En ruta
            </span>

            <span className="h-px w-10 bg-gradient-to-l from-transparent to-sky-400/70" />
          </div>

          <h1 className="bg-gradient-to-r from-white via-sky-100 to-sky-300 bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-5xl">
            RailBoard
          </h1>

          <p className="mt-3 text-sm font-medium tracking-wide text-slate-300 sm:text-base">
            Preparando la información de la estación
            <span aria-hidden="true" className="ml-1 inline-flex gap-1">
              <span className="rb-loading-dot">.</span>
              <span className="rb-loading-dot">.</span>
              <span className="rb-loading-dot">.</span>
            </span>
          </p>
        </div>
      </section>
    </main>
  );
}
