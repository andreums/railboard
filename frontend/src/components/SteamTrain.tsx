export default function SteamTrain() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-blue-900 via-blue-800 to-blue-900">
      <style>{`
        @keyframes smokePuff {
          0% {
            opacity: 1;
            transform: translateY(0) scale(0.8);
          }
          50% {
            opacity: 0.6;
          }
          100% {
            opacity: 0;
            transform: translateY(-60px) scale(1.5);
          }
        }

        @keyframes wheelSpin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        @keyframes trainMove {
          0% {
            transform: translateX(-20px);
          }
          50% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-20px);
          }
        }

        @keyframes steamRod {
          0% {
            transform: scaleX(0.8);
          }
          50% {
            transform: scaleX(1.1);
          }
          100% {
            transform: scaleX(0.8);
          }
        }

        .smoke {
          animation: smokePuff 2s ease-out infinite;
        }

        .smoke1 {
          animation-delay: 0s;
        }

        .smoke2 {
          animation-delay: 0.4s;
        }

        .smoke3 {
          animation-delay: 0.8s;
        }

        .wheel {
          animation: wheelSpin 1s linear infinite;
          transform-origin: center;
        }

        .train-body {
          animation: trainMove 2s ease-in-out infinite;
        }

        .steam-rod {
          animation: steamRod 1s ease-in-out infinite;
          transform-origin: left;
        }
      `}</style>

      <svg viewBox="0 0 400 200" className="w-80 h-auto mb-8" xmlns="http://www.w3.org/2000/svg">
        {/* Sky background */}
        <rect width="400" height="200" fill="none" />

        {/* Track */}
        <line x1="0" y1="160" x2="400" y2="160" stroke="#8B4513" strokeWidth="3" />
        <line x1="0" y1="168" x2="400" y2="168" stroke="#8B4513" strokeWidth="3" />
        <line x1="10" y1="160" x2="10" y2="175" stroke="#8B4513" strokeWidth="1" />
        <line x1="30" y1="160" x2="30" y2="175" stroke="#8B4513" strokeWidth="1" />
        <line x1="50" y1="160" x2="50" y2="175" stroke="#8B4513" strokeWidth="1" />
        <line x1="70" y1="160" x2="70" y2="175" stroke="#8B4513" strokeWidth="1" />
        <line x1="90" y1="160" x2="90" y2="175" stroke="#8B4513" strokeWidth="1" />
        <line x1="110" y1="160" x2="110" y2="175" stroke="#8B4513" strokeWidth="1" />
        <line x1="130" y1="160" x2="130" y2="175" stroke="#8B4513" strokeWidth="1" />
        <line x1="150" y1="160" x2="150" y2="175" stroke="#8B4513" strokeWidth="1" />
        <line x1="170" y1="160" x2="170" y2="175" stroke="#8B4513" strokeWidth="1" />
        <line x1="190" y1="160" x2="190" y2="175" stroke="#8B4513" strokeWidth="1" />
        <line x1="210" y1="160" x2="210" y2="175" stroke="#8B4513" strokeWidth="1" />
        <line x1="230" y1="160" x2="230" y2="175" stroke="#8B4513" strokeWidth="1" />
        <line x1="250" y1="160" x2="250" y2="175" stroke="#8B4513" strokeWidth="1" />
        <line x1="270" y1="160" x2="270" y2="175" stroke="#8B4513" strokeWidth="1" />
        <line x1="290" y1="160" x2="290" y2="175" stroke="#8B4513" strokeWidth="1" />
        <line x1="310" y1="160" x2="310" y2="175" stroke="#8B4513" strokeWidth="1" />
        <line x1="330" y1="160" x2="330" y2="175" stroke="#8B4513" strokeWidth="1" />
        <line x1="350" y1="160" x2="350" y2="175" stroke="#8B4513" strokeWidth="1" />
        <line x1="370" y1="160" x2="370" y2="175" stroke="#8B4513" strokeWidth="1" />

        {/* Train group with animation */}
        <g className="train-body">
          {/* Smoke puffs */}
          <circle cx="60" cy="40" r="12" fill="#C0C0C0" opacity="0.7" className="smoke smoke1" />
          <circle cx="70" cy="50" r="14" fill="#C0C0C0" opacity="0.5" className="smoke smoke2" />
          <circle cx="50" cy="50" r="10" fill="#C0C0C0" opacity="0.4" className="smoke smoke3" />

          {/* Chimney */}
          <rect x="58" y="30" width="12" height="20" fill="#2C2C2C" />
          <ellipse cx="64" cy="30" rx="6" ry="3" fill="#1A1A1A" />

          {/* Boiler */}
          <ellipse cx="80" cy="85" rx="50" ry="25" fill="#DC143C" stroke="#8B0000" strokeWidth="1" />
          <rect x="35" y="80" width="90" height="10" fill="#DC143C" stroke="#8B0000" strokeWidth="1" />

          {/* Front of boiler */}
          <circle cx="35" cy="85" r="25" fill="#DC143C" stroke="#8B0000" strokeWidth="1" />

          {/* Steam dome */}
          <ellipse cx="70" cy="60" rx="12" ry="15" fill="#C0C0C0" stroke="#808080" strokeWidth="1" />
          <rect x="66" y="75" width="8" height="5" fill="#808080" />

          {/* Cabin */}
          <rect x="95" y="70" width="30" height="25" fill="#1A1A1A" stroke="#000000" strokeWidth="1" />
          <circle cx="101" cy="77" r="2" fill="#FFD700" />
          <circle cx="119" cy="77" r="2" fill="#FFD700" />

          {/* Cow catcher */}
          <polyline points="25,95 20,95 20,110 30,105 30,95" fill="none" stroke="#2C2C2C" strokeWidth="2" />

          {/* Front wheel (larger) */}
          <circle cx="30" cy="145" r="18" fill="#2C2C2C" stroke="#1A1A1A" strokeWidth="2" className="wheel" />
          <circle cx="30" cy="145" r="14" fill="none" stroke="#696969" strokeWidth="2" />
          <line x1="30" y1="131" x2="30" y2="159" stroke="#696969" strokeWidth="1" />
          <line x1="16" y1="145" x2="44" y2="145" stroke="#696969" strokeWidth="1" />

          {/* Drive wheel 1 */}
          <circle cx="75" cy="145" r="20" fill="#2C2C2C" stroke="#1A1A1A" strokeWidth="2" className="wheel" />
          <circle cx="75" cy="145" r="16" fill="none" stroke="#696969" strokeWidth="2" />
          <line x1="75" y1="125" x2="75" y2="165" stroke="#696969" strokeWidth="1" />
          <line x1="55" y1="145" x2="95" y2="145" stroke="#696969" strokeWidth="1" />

          {/* Connecting rod */}
          <line x1="50" y1="125" x2="75" y2="125" stroke="#2C2C2C" strokeWidth="2" className="steam-rod" />

          {/* Rear wheel */}
          <circle cx="115" cy="145" r="18" fill="#2C2C2C" stroke="#1A1A1A" strokeWidth="2" className="wheel" />
          <circle cx="115" cy="145" r="14" fill="none" stroke="#696969" strokeWidth="2" />
          <line x1="115" y1="131" x2="115" y2="159" stroke="#696969" strokeWidth="1" />
          <line x1="101" y1="145" x2="129" y2="145" stroke="#696969" strokeWidth="1" />

          {/* Coupler */}
          <rect x="125" y="138" width="8" height="14" fill="#696969" />

          {/* Tender */}
          <rect x="135" y="105" width="35" height="35" fill="#555555" stroke="#2C2C2C" strokeWidth="1" />
          <rect x="137" y="107" width="31" height="25" fill="#696969" />

          {/* Tender wheels */}
          <circle cx="145" cy="145" r="15" fill="#2C2C2C" stroke="#1A1A1A" strokeWidth="2" className="wheel" />
          <circle cx="145" cy="145" r="11" fill="none" stroke="#696969" strokeWidth="2" />
          <circle cx="165" cy="145" r="15" fill="#2C2C2C" stroke="#1A1A1A" strokeWidth="2" className="wheel" />
          <circle cx="165" cy="145" r="11" fill="none" stroke="#696969" strokeWidth="2" />
        </g>
      </svg>

      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-2">RailBoard</h1>
        <p className="text-lg text-blue-100">Cargando la estación...</p>
      </div>
    </div>
  );
}
