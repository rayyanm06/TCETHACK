import React from 'react';

interface CivicCitySceneProps {
  phase: 'idle' | 'authenticating' | 'confirmed' | 'transforming' | 'truck_entering' | 'collecting' | 'turning' | 'driving_away' | 'revealing_dashboard';
  className?: string;
}

export const CivicCityScene: React.FC<CivicCitySceneProps> = ({ phase, className = '' }) => {
  const isDriving = phase === 'driving_away' || phase === 'revealing_dashboard';
  const isRevealing = phase === 'revealing_dashboard';

  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none select-none bg-[#F5F1E8] ${className}`}
      style={{
        transition: 'transform 1.8s cubic-bezier(0.25, 1, 0.5, 1)',
        transform: isRevealing
          ? 'scale(1.28) translateY(6%)'
          : isDriving
          ? 'scale(1.06) translateY(2%)'
          : 'scale(1) translateY(0)',
      }}
    >
      <svg
        viewBox="0 0 1440 900"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          {/* Sky Gradient */}
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#DCE8E8" />
            <stop offset="55%" stopColor="#E9EFE9" />
            <stop offset="100%" stopColor="#F5F1E8" />
          </linearGradient>

          {/* Road Surface Gradient */}
          <linearGradient id="roadGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#CCC5B8" />
            <stop offset="100%" stopColor="#D8D1C5" />
          </linearGradient>

          {/* Distant building gradient */}
          <linearGradient id="distantBuildingGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C9D6CE" />
            <stop offset="100%" stopColor="#DCE9E1" />
          </linearGradient>

          {/* Subtle civic contour grid pattern */}
          <pattern id="civicGrid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#B7C5BE" strokeWidth="0.5" strokeOpacity="0.3" />
          </pattern>
        </defs>

        {/* 1. SKY & ATMOSPHERE */}
        <rect width="1440" height="900" fill="url(#skyGrad)" />
        <rect width="1440" height="420" fill="url(#civicGrid)" opacity="0.4" />

        {/* Soft Stylized Vector Clouds */}
        <g className="animate-cloud-drift" opacity="0.55">
          <path
            d="M 120 110 Q 145 90 175 95 Q 210 80 245 100 Q 280 90 300 115 Q 315 135 295 150 L 115 150 Q 95 135 120 110 Z"
            fill="#FFFFFF"
          />
          <path
            d="M 850 140 Q 880 115 920 120 Q 960 105 1005 130 Q 1040 118 1070 145 Q 1090 170 1060 185 L 845 185 Q 825 170 850 140 Z"
            fill="#FFFFFF"
          />
          <path
            d="M 1220 90 Q 1245 75 1275 80 Q 1310 70 1340 90 Q 1365 80 1385 105 L 1210 105 Z"
            fill="#FFFFFF"
          />
        </g>

        {/* 2. DISTANT LAYER (Faint Skyline, Municipal Silhouettes, Slow Parallax) */}
        <g
          id="distant-layer"
          style={{
            transition: 'transform 1.6s cubic-bezier(0.2, 0.8, 0.4, 1)',
            transform: isDriving ? 'translateY(16px)' : 'translateY(0)',
          }}
        >
          {/* Municipal Clock / Spire Silhouette */}
          <polygon points="260,280 270,180 274,180 284,280" fill="#AFC7B9" fillOpacity="0.7" />
          <rect x="264" y="220" width="16" height="60" fill="#AFC7B9" fillOpacity="0.8" />
          <circle cx="272" cy="235" r="4" fill="#FFFFFF" fillOpacity="0.8" />

          {/* Distant skyline buildings */}
          <rect x="80" y="240" width="70" height="150" rx="2" fill="url(#distantBuildingGrad)" />
          <rect x="160" y="210" width="85" height="180" rx="2" fill="url(#distantBuildingGrad)" opacity="0.9" />
          <rect x="300" y="250" width="60" height="140" rx="2" fill="url(#distantBuildingGrad)" />
          <rect x="370" y="225" width="90" height="165" rx="2" fill="url(#distantBuildingGrad)" opacity="0.85" />

          {/* Water Tower Silhouette */}
          <ellipse cx="490" cy="235" rx="22" ry="14" fill="#AFC7B9" fillOpacity="0.6" />
          <rect x="475" y="235" width="30" height="24" fill="#AFC7B9" fillOpacity="0.6" />
          <line x1="478" y1="259" x2="470" y2="330" stroke="#53615B" strokeWidth="2" strokeOpacity="0.4" />
          <line x1="502" y1="259" x2="510" y2="330" stroke="#53615B" strokeWidth="2" strokeOpacity="0.4" />
          <line x1="490" y1="259" x2="490" y2="330" stroke="#53615B" strokeWidth="1.5" strokeOpacity="0.4" />

          {/* Right Skyline */}
          <rect x="940" y="230" width="80" height="160" rx="2" fill="url(#distantBuildingGrad)" opacity="0.9" />
          <rect x="1030" y="195" width="105" height="195" rx="2" fill="url(#distantBuildingGrad)" />
          <polygon points="1065,195 1082,145 1100,195" fill="#AFC7B9" fillOpacity="0.75" />
          <rect x="1150" y="240" width="90" height="150" rx="2" fill="url(#distantBuildingGrad)" opacity="0.85" />
          <rect x="1255" y="215" width="115" height="175" rx="2" fill="url(#distantBuildingGrad)" />

          {/* Distant Hills / Tree Canopies on Horizon */}
          <path
            d="M 0 350 Q 200 320 450 345 Q 700 330 950 350 Q 1200 335 1440 345 L 1440 390 L 0 390 Z"
            fill="#AFC7B9"
            fillOpacity="0.45"
          />
        </g>

        {/* 3. MIDDLE LAYER (City Architecture, Streets, Mid Parallax) */}
        <g
          id="middle-layer"
          style={{
            transition: 'transform 1.6s cubic-bezier(0.2, 0.8, 0.4, 1)',
            transform: isDriving ? 'translateY(38px)' : 'translateY(0)',
          }}
        >
          {/* Base ground / sidewalk shelf */}
          <rect x="0" y="360" width="1440" height="180" fill="#EAE5DA" />
          <line x1="0" y1="360" x2="1440" y2="360" stroke="#BDB5A8" strokeWidth="2" />

          {/* Left Mid-Ground Civic & Residential Buildings */}
          {/* Building 1 (Editorial Apartment Block) */}
          <rect x="60" y="270" width="140" height="150" rx="3" fill="#FBF9F4" stroke="#D8D1C5" strokeWidth="2" />
          <rect x="75" y="285" width="22" height="24" rx="1.5" fill="#DCE8E8" stroke="#B7C5BE" strokeWidth="1" />
          <rect x="105" y="285" width="22" height="24" rx="1.5" fill="#DCE8E8" stroke="#B7C5BE" strokeWidth="1" />
          <rect x="135" y="285" width="22" height="24" rx="1.5" fill="#DCE8E8" stroke="#B7C5BE" strokeWidth="1" />
          <rect x="165" y="285" width="22" height="24" rx="1.5" fill="#DCE8E8" stroke="#B7C5BE" strokeWidth="1" />

          <rect x="75" y="325" width="22" height="24" rx="1.5" fill="#DCE8E8" stroke="#B7C5BE" strokeWidth="1" />
          <rect x="105" y="325" width="22" height="24" rx="1.5" fill="#DCE8E8" stroke="#B7C5BE" strokeWidth="1" />
          <rect x="135" y="325" width="22" height="24" rx="1.5" fill="#DCE8E8" stroke="#B7C5BE" strokeWidth="1" />
          <rect x="165" y="325" width="22" height="24" rx="1.5" fill="#DCE8E8" stroke="#B7C5BE" strokeWidth="1" />

          {/* Building 2 (Mid-rise Municipal Center) */}
          <rect x="220" y="295" width="180" height="125" rx="3" fill="#F4EFE6" stroke="#D8D1C5" strokeWidth="2" />
          <rect x="220" y="285" width="180" height="10" fill="#236B4F" />
          <line x1="230" y1="340" x2="390" y2="340" stroke="#D8D1C5" strokeWidth="1.5" />
          {/* Subtle Municipal entrance portico */}
          <rect x="285" y="365" width="50" height="55" fill="#164635" rx="2" />
          <rect x="295" y="375" width="30" height="45" fill="#DCE8E8" opacity="0.85" />

          {/* Right Mid-Ground Buildings */}
          {/* Building 3 */}
          <rect x="1020" y="280" width="160" height="140" rx="3" fill="#FBF9F4" stroke="#D8D1C5" strokeWidth="2" />
          <rect x="1040" y="300" width="24" height="28" rx="1.5" fill="#DCE8E8" stroke="#B7C5BE" strokeWidth="1" />
          <rect x="1080" y="300" width="24" height="28" rx="1.5" fill="#DCE8E8" stroke="#B7C5BE" strokeWidth="1" />
          <rect x="1120" y="300" width="24" height="28" rx="1.5" fill="#DCE8E8" stroke="#B7C5BE" strokeWidth="1" />
          <rect x="1040" y="345" width="24" height="28" rx="1.5" fill="#DCE8E8" stroke="#B7C5BE" strokeWidth="1" />
          <rect x="1080" y="345" width="24" height="28" rx="1.5" fill="#DCE8E8" stroke="#B7C5BE" strokeWidth="1" />
          <rect x="1120" y="345" width="24" height="28" rx="1.5" fill="#DCE8E8" stroke="#B7C5BE" strokeWidth="1" />

          {/* Building 4 */}
          <rect x="1195" y="260" width="170" height="160" rx="3" fill="#EFE9DC" stroke="#D8D1C5" strokeWidth="2" />
          <line x1="1210" y1="310" x2="1350" y2="310" stroke="#BDB5A8" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="1210" y1="360" x2="1350" y2="360" stroke="#BDB5A8" strokeWidth="1" strokeDasharray="4 4" />

          {/* Street Trees (Editorial geometric circles) */}
          <g className="animate-tree-sway">
            {/* Left trees */}
            <line x1="420" y1="385" x2="420" y2="420" stroke="#53615B" strokeWidth="4" strokeLinecap="round" />
            <circle cx="420" cy="370" r="24" fill="#AFC7B9" stroke="#236B4F" strokeWidth="1.5" />
            <circle cx="414" cy="364" r="14" fill="#DCE9E1" opacity="0.6" />

            <line x1="465" y1="395" x2="465" y2="430" stroke="#53615B" strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="465" cy="380" r="18" fill="#AFC7B9" stroke="#236B4F" strokeWidth="1.5" />

            {/* Right trees */}
            <line x1="975" y1="390" x2="975" y2="425" stroke="#53615B" strokeWidth="4" strokeLinecap="round" />
            <circle cx="975" cy="372" r="22" fill="#AFC7B9" stroke="#236B4F" strokeWidth="1.5" />
            <circle cx="982" cy="368" r="13" fill="#DCE9E1" opacity="0.6" />
          </g>

          {/* Street Lamp Post Left */}
          <g>
            <line x1="440" y1="350" x2="440" y2="425" stroke="#53615B" strokeWidth="3" />
            <path d="M 440 350 Q 440 340 450 340 L 458 340" stroke="#53615B" strokeWidth="3" fill="none" />
            <polygon points="454,340 462,340 460,346 456,346" fill="#17211D" />
            <circle cx="458" cy="348" r="12" fill="#D59A3A" fillOpacity="0.18" />
            <circle cx="458" cy="347" r="3" fill="#D59A3A" />
          </g>

          {/* Street Lamp Post Right */}
          <g>
            <line x1="995" y1="350" x2="995" y2="425" stroke="#53615B" strokeWidth="3" />
            <path d="M 995 350 Q 995 340 985 340 L 977 340" stroke="#53615B" strokeWidth="3" fill="none" />
            <polygon points="973,340 981,340 979,346 975,346" fill="#17211D" />
            <circle cx="977" cy="348" r="12" fill="#D59A3A" fillOpacity="0.18" />
            <circle cx="977" cy="347" r="3" fill="#D59A3A" />
          </g>
        </g>

        {/* 4. FOREGROUND LAYER (Curved Perspective Road & Vanishing Point, Fast Parallax) */}
        <g
          id="foreground-road-layer"
          style={{
            transition: 'transform 1.6s cubic-bezier(0.2, 0.8, 0.4, 1)',
            transform: isDriving ? 'translateY(70px) scale(1.08)' : 'translateY(0)',
            transformOrigin: '720px 420px',
          }}
        >
          {/* Main Curved Road Body */}
          {/* Vanishing point around (720, 410) -> widening outward toward bottom (180 to 1260) */}
          <path
            d="M 685 410 Q 710 490 620 620 Q 510 770 120 900 L 1320 900 Q 980 770 830 620 Q 755 490 755 410 Z"
            fill="url(#roadGrad)"
            stroke="#BDB5A8"
            strokeWidth="3"
          />

          {/* Road Curb Edge Borders (Left & Right) */}
          <path
            d="M 685 410 Q 710 490 620 620 Q 510 770 120 900"
            stroke="#BDB5A8"
            strokeWidth="8"
            fill="none"
          />
          <path
            d="M 755 410 Q 755 490 830 620 Q 980 770 1320 900"
            stroke="#BDB5A8"
            strokeWidth="8"
            fill="none"
          />

          {/* Dashed Center Dividing Lane Markings */}
          <path
            d="M 720 410 Q 732 490 710 620 Q 670 770 600 900"
            stroke="#FFFFFF"
            strokeWidth="5"
            strokeDasharray="22 18"
            strokeLinecap="round"
            fill="none"
            className={isDriving ? 'animate-road-flow' : ''}
            opacity="0.9"
          />

          {/* Pedestrian Crosswalk Markings (Foreground Left) */}
          <g opacity="0.65">
            <line x1="380" y1="740" x2="480" y2="740" stroke="#FFFFFF" strokeWidth="8" />
            <line x1="395" y1="760" x2="505" y2="760" stroke="#FFFFFF" strokeWidth="9" />
            <line x1="410" y1="782" x2="530" y2="782" stroke="#FFFFFF" strokeWidth="10" />
            <line x1="425" y1="806" x2="560" y2="806" stroke="#FFFFFF" strokeWidth="11" />
          </g>

          {/* Curb Waste Collection Bins (Foreground Right Sidewalk) */}
          <g>
            {/* Green Municipal Organic/Recycle Bin */}
            <rect x="990" y="690" width="26" height="42" rx="3" fill="#236B4F" stroke="#164635" strokeWidth="2" />
            <rect x="986" y="686" width="34" height="6" rx="2" fill="#164635" />
            <circle cx="1003" cy="706" r="4" fill="#FFFFFF" opacity="0.6" />
            <ellipse cx="1003" cy="733" rx="16" ry="4" fill="#17211D" opacity="0.2" />

            {/* Ochre Specialist / E-Waste Bin */}
            <rect x="1030" y="685" width="28" height="46" rx="3" fill="#D59A3A" stroke="#17211D" strokeWidth="2" />
            <rect x="1026" y="681" width="36" height="6" rx="2" fill="#17211D" />
            <rect x="1037" y="700" width="14" height="8" rx="1" fill="#17211D" opacity="0.75" />
            <ellipse cx="1044" cy="733" rx="18" ry="4" fill="#17211D" opacity="0.2" />
          </g>

          {/* Foreground Street Sign Pole ("CIVIC OPERATIONS ZONE") */}
          <g>
            <line x1="280" y1="670" x2="280" y2="820" stroke="#53615B" strokeWidth="4" />
            <rect x="240" y="670" width="80" height="28" rx="3" fill="#FBF9F4" stroke="#236B4F" strokeWidth="2" />
            <text
              x="250"
              y="688"
              fill="#164635"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontSize="9"
              fontWeight="800"
              letterSpacing="1"
            >
              SECTOR · 04
            </text>
            <circle cx="280" cy="820" r="4" fill="#17211D" />
          </g>
        </g>
      </svg>
    </div>
  );
};
