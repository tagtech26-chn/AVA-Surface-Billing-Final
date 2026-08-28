import React from 'react';

export const AvaSurfacesLogo: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex flex-col leading-none select-none ${className}`} aria-label="AVA Surfaces">
    <div className="font-black tracking-[-0.12em] text-white text-[32px] sm:text-[38px] leading-[0.78]">
      AVA
    </div>
    <div className="mt-1 text-[9px] sm:text-[11px] font-semibold tracking-[0.28em] text-white/95">
      SURFACES
    </div>
  </div>
);
