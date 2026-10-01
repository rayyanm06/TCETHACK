import React from 'react';

interface GarbageTruckProps {
  phase: 'idle' | 'entering' | 'collecting' | 'driving' | 'vanished';
  className?: string;
}

export const GarbageTruck: React.FC<GarbageTruckProps> = ({ phase, className = '' }) => {
  return (
    <div className={`relative select-none pointer-events-none ${className}`}>
      <svg
        viewBox="0 0 460 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md"
      >
        <defs>
          {/* Subtle panel gradient */}
          <linearGradient id="compactorGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1C5340" />
            <stop offset="100%" stopColor="#164635" />
          </linearGradient>
          <linearGradient id="cabGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2A7C5C" />
            <stop offset="100%" stopColor="#236B4F" />
          </linearGradient>
          <linearGradient id="windshieldGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#DCE8E8" />
            <stop offset="100%" stopColor="#B8CFCE" />
          </linearGradient>
        </defs>

        {/* --- SHADOW --- */}
        <ellipse cx="230" cy="205" rx="200" ry="12" fill="#17211D" fillOpacity="0.22" />

        {/* --- CHASSIS & UNDERCARRIAGE --- */}
        <rect x="50" y="158" width="370" height="22" rx="4" fill="#17211D" />
        <rect x="70" y="174" width="80" height="10" fill="#53615B" />
        <rect x="250" y="174" width="130" height="10" fill="#53615B" />

        {/* Fuel / Battery tank */}
        <rect x="180" y="162" width="60" height="16" rx="3" fill="#53615B" stroke="#17211D" strokeWidth="2" />
        <line x1="200" y1="162" x2="200" y2="178" stroke="#17211D" strokeWidth="1.5" />
        <line x1="220" y1="162" x2="220" y2="178" stroke="#17211D" strokeWidth="1.5" />

        {/* --- MAIN COMPACTOR CONTAINER (BODY) --- */}
        {/* Main box */}
        <path
          d="M 50 50 L 290 50 L 290 165 L 50 165 Z"
          fill="url(#compactorGrad)"
          stroke="#164635"
          strokeWidth="3"
        />
        {/* Curved upper rear aero contour */}
        <path
          d="M 50 50 Q 42 70 42 165 L 50 165 Z"
          fill="#133D2E"
        />

        {/* Horizontal Stiffener Ribs on Container Body */}
        <rect x="55" y="65" width="230" height="7" rx="1.5" fill="#113629" />
        <rect x="55" y="86" width="230" height="7" rx="1.5" fill="#113629" />
        <rect x="55" y="107" width="230" height="7" rx="1.5" fill="#113629" />
        <rect x="55" y="128" width="230" height="7" rx="1.5" fill="#113629" />

        {/* White Accent Brand Banner Band */}
        <rect x="55" y="76" width="230" height="24" rx="2" fill="#FBF9F4" />
        <text
          x="68"
          y="93"
          fill="#164635"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize="11"
          fontWeight="800"
          letterSpacing="2.5"
        >
          CIVICCLEAN · 04
        </text>
        <circle cx="270" cy="88" r="4" fill="#236B4F" />

        {/* Warning Hazard Chevron Strip at Container Base */}
        <g opacity="0.85">
          <rect x="55" y="146" width="230" height="12" fill="#D59A3A" />
          <path d="M 65 146 L 75 158 H 85 L 75 146 Z" fill="#17211D" />
          <path d="M 95 146 L 105 158 H 115 L 105 146 Z" fill="#17211D" />
          <path d="M 125 146 L 135 158 H 145 L 135 146 Z" fill="#17211D" />
          <path d="M 155 146 L 165 158 H 175 L 165 146 Z" fill="#17211D" />
          <path d="M 185 146 L 195 158 H 205 L 195 146 Z" fill="#17211D" />
          <path d="M 215 146 L 225 158 H 235 L 225 146 Z" fill="#17211D" />
          <path d="M 245 146 L 255 158 H 265 L 255 146 Z" fill="#17211D" />
        </g>

        {/* --- REAR HOPPER & COLLECTION MECH (LEFT SIDE) --- */}
        <path
          d="M 42 75 L 15 95 L 15 160 L 42 165 Z"
          fill="#1C2E26"
          stroke="#17211D"
          strokeWidth="2.5"
        />
        {/* Rear Hopper Door / Chute Opening */}
        <rect x="18" y="105" width="20" height="48" rx="2" fill="#17211D" />
        <rect x="20" y="107" width="16" height="44" rx="1.5" fill="#2E4237" opacity="0.6" />

        {/* Articulated Hydraulic Lift Arm (animates on phase === 'collecting') */}
        <g
          className={`transition-transform duration-700 origin-[32px_150px] ${
            phase === 'collecting' ? '-rotate-45 -translate-y-2' : 'rotate-0'
          }`}
        >
          {/* Hydraulic cylinder */}
          <line x1="32" y1="150" x2="10" y2="128" stroke="#D59A3A" strokeWidth="5" strokeLinecap="round" />
          <line x1="12" y1="130" x2="6" y2="118" stroke="#53615B" strokeWidth="4" strokeLinecap="round" />
          {/* Grabber cradle / fork */}
          <path d="M 4 116 L -2 122 L -8 116" stroke="#D59A3A" strokeWidth="3" strokeLinecap="round" fill="none" />
        </g>

        {/* Safety light on rear */}
        <circle cx="22" cy="85" r="4" fill="#C96E45" />

        {/* --- DRIVER CABIN (RIGHT SIDE) --- */}
        {/* Cab Main Shell */}
        <path
          d="M 290 68 L 380 68 Q 395 72 405 92 L 424 135 Q 428 145 428 155 L 428 165 L 290 165 Z"
          fill="url(#cabGrad)"
          stroke="#1B553E"
          strokeWidth="2.5"
        />

        {/* Roof Cap */}
        <path d="M 288 66 L 382 66 Q 394 67 398 75 L 288 75 Z" fill="#164635" />

        {/* Amber Safety Strobe Beacon on Roof */}
        <g className="animate-pulse">
          <rect x="330" y="55" width="16" height="11" rx="3" fill="#D59A3A" stroke="#17211D" strokeWidth="1.5" />
          <line x1="338" y1="52" x2="338" y2="55" stroke="#D59A3A" strokeWidth="2" strokeLinecap="round" />
          {/* Gentle amber glow beacon ring */}
          <circle cx="338" cy="60" r="14" fill="#D59A3A" fillOpacity="0.25" />
        </g>

        {/* Windshield & Side Window */}
        <path
          d="M 305 78 L 372 78 Q 384 81 392 96 L 406 126 L 305 126 Z"
          fill="url(#windshieldGrad)"
          stroke="#17211D"
          strokeWidth="2"
        />
        {/* Window Pillar divider */}
        <line x1="358" y1="78" x2="368" y2="126" stroke="#236B4F" strokeWidth="4" />

        {/* Subtle Driver Silhouette */}
        <circle cx="340" cy="100" r="8" fill="#17211D" fillOpacity="0.45" />
        <path d="M 326 124 Q 332 110 344 110 Q 354 110 356 124 Z" fill="#17211D" fillOpacity="0.45" />

        {/* Door line */}
        <path d="M 305 78 L 305 162 M 372 126 L 372 162" stroke="#1B553E" strokeWidth="2" strokeDasharray="3 3" />
        {/* Door handle */}
        <rect x="314" y="134" width="12" height="3" rx="1.5" fill="#D8D1C5" />

        {/* Front Headlight & Turn Signal Cluster */}
        <path d="M 424 140 L 428 141 L 428 154 L 422 153 Z" fill="#FFFFFF" stroke="#17211D" strokeWidth="1.5" />
        <rect x="424" y="154" width="4" height="6" fill="#D59A3A" />
        {/* Headlight beam (subtle civic illumination) */}
        <polygon points="430,143 510,135 510,180 430,158" fill="#FFFFFF" fillOpacity="0.08" />

        {/* Front Bumper & Grille */}
        <path d="M 416 160 L 434 160 L 434 175 L 416 175 Z" fill="#17211D" rx="2" />
        <rect x="390" y="162" width="26" height="12" rx="2" fill="#53615B" />

        {/* Side Rearview Mirror */}
        <rect x="388" y="94" width="7" height="16" rx="2" fill="#17211D" />
        <line x1="384" y1="98" x2="388" y2="98" stroke="#17211D" strokeWidth="2" />
        <line x1="384" y1="108" x2="388" y2="108" stroke="#17211D" strokeWidth="2" />

        {/* --- WHEELS --- */}
        {/* Rear Wheel Dual 1 */}
        <g className={phase === 'entering' || phase === 'driving' ? 'animate-spin origin-[105px_175px]' : ''}>
          <circle cx="105" cy="175" r="28" fill="#17211D" />
          <circle cx="105" cy="175" r="19" fill="#53615B" />
          <circle cx="105" cy="175" r="13" fill="#AFC7B9" />
          <circle cx="105" cy="175" r="5" fill="#17211D" />
          {/* Wheel lug nuts */}
          <circle cx="105" cy="164" r="1.5" fill="#17211D" />
          <circle cx="116" cy="175" r="1.5" fill="#17211D" />
          <circle cx="105" cy="186" r="1.5" fill="#17211D" />
          <circle cx="94" cy="175" r="1.5" fill="#17211D" />
        </g>
        {/* Wheel Arch Rear 1 */}
        <path d="M 72 165 A 34 34 0 0 1 138 165 Z" fill="#17211D" fillOpacity="0.4" />

        {/* Rear Wheel Dual 2 */}
        <g className={phase === 'entering' || phase === 'driving' ? 'animate-spin origin-[170px_175px]' : ''}>
          <circle cx="170" cy="175" r="28" fill="#17211D" />
          <circle cx="170" cy="175" r="19" fill="#53615B" />
          <circle cx="170" cy="175" r="13" fill="#AFC7B9" />
          <circle cx="170" cy="175" r="5" fill="#17211D" />
          <circle cx="170" cy="164" r="1.5" fill="#17211D" />
          <circle cx="181" cy="175" r="1.5" fill="#17211D" />
          <circle cx="170" cy="186" r="1.5" fill="#17211D" />
          <circle cx="159" cy="175" r="1.5" fill="#17211D" />
        </g>
        {/* Wheel Arch Rear 2 */}
        <path d="M 137 165 A 34 34 0 0 1 203 165 Z" fill="#17211D" fillOpacity="0.4" />

        {/* Front Wheel */}
        <g className={phase === 'entering' || phase === 'driving' ? 'animate-spin origin-[355px_175px]' : ''}>
          <circle cx="355" cy="175" r="28" fill="#17211D" />
          <circle cx="355" cy="175" r="19" fill="#53615B" />
          <circle cx="355" cy="175" r="13" fill="#AFC7B9" />
          <circle cx="355" cy="175" r="5" fill="#17211D" />
          <circle cx="355" cy="164" r="1.5" fill="#17211D" />
          <circle cx="366" cy="175" r="1.5" fill="#17211D" />
          <circle cx="355" cy="186" r="1.5" fill="#17211D" />
          <circle cx="344" cy="175" r="1.5" fill="#17211D" />
        </g>
        {/* Front Wheel Arch */}
        <path d="M 322 165 A 34 34 0 0 1 388 165 Z" fill="#17211D" fillOpacity="0.4" />

        {/* Side Splash Guard / Mudguard Band */}
        <rect x="44" y="163" width="28" height="18" fill="#17211D" />
      </svg>
    </div>
  );
};
