import React from 'react';

interface DigafLogoProps {
  className?: string;
  isDarkBackground?: boolean;
}

export function DigafIcon({ className = "w-8 h-8", isDarkBackground = false }: DigafLogoProps) {
  return (
    <svg 
      viewBox="0 0 100 100" 
      className={`${className} transition-all duration-300`} 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="digaf-icon-gradient" x1="0" y1="100" x2="100" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
      </defs>
      
      {/* Background container when explicitly set or dark theme layout */}
      {isDarkBackground && (
        <rect width="100" height="100" rx="24" fill="#030712" />
      )}
      
      {/* Small square/block at the bottom left */}
      <rect 
        x="12" 
        y="58" 
        width="20" 
        height="20" 
        rx="4" 
        fill="url(#digaf-icon-gradient)" 
      />
      
      {/* Stepped D curve shape with compound transparent cutout (evenodd rule) */}
      <path 
        fillRule="evenodd" 
        clipRule="evenodd" 
        d="M38,78 H74 C83.94,78 92,69.94 92,60 V40 C92,30.06 83.94,22 74,22 H54 C51.79,22 50,23.79 50,26 V40 H38 C35.79,40 34,41.79 34,44 V74 C34,76.21 35.79,78 38,78 Z M54,40 H74 C78.42,40 82,43.58 82,48 V52 C82,56.42 78.42,60 74,60 H54 V40 Z" 
        fill="url(#digaf-icon-gradient)" 
      />
    </svg>
  );
}

export default function DigafLogo({ className = "h-8", isDarkBackground = false }: DigafLogoProps) {
  return (
    <div className="flex items-center gap-2 pr-1 shrink-0 select-none">
      <DigafIcon className="w-8 h-8" isDarkBackground={isDarkBackground} />
      <div className="leading-none text-left">
        <span className={`text-xl font-black tracking-tight font-sans flex items-center gap-0.5 ${isDarkBackground ? 'text-white' : 'text-slate-900'} transition-colors duration-300`}>
          Digaf
          <span className="text-[10px] font-bold text-[#8B5CF6] align-super tracking-normal">TM</span>
        </span>
        <span className={`text-[10px] ${isDarkBackground ? 'text-slate-300' : 'text-slate-600'} font-black block uppercase tracking-[0.18em] mt-0.5 leading-none font-sans`}>
          mfi
        </span>
      </div>
    </div>
  );
}
