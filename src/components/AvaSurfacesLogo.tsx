import React from 'react';

export const AvaSurfacesLogo: React.FC<{ className?: string }> = ({ className = '' }) => (
  <>
    <style>{`
      :root {
        --vero-gold: #f59e0b;
      }
      body {
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
      }
      h1, h2, h3, h4, h5, h6 {
        font-family: Georgia, "Times New Roman", serif !important;
        letter-spacing: -0.025em;
      }
      .vero-heading {
        font-family: Georgia, "Times New Roman", serif !important;
        font-weight: 700;
      }
      .vero-kicker {
        font-family: Inter, ui-sans-serif, system-ui, sans-serif !important;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: var(--vero-gold);
      }
    `}</style>
    <div className={`flex flex-col leading-none select-none ${className}`} aria-label="AVA Surfaces">
      <div className="font-black tracking-[-0.12em] text-white text-[32px] sm:text-[38px] leading-[0.78]">
        AVA
      </div>
      <div className="mt-1 text-[9px] sm:text-[11px] font-semibold tracking-[0.28em] text-white/95">
        SURFACES
      </div>
    </div>
  </>
);
