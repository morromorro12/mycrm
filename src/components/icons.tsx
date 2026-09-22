// SVG inline en vez de una librería de íconos: cero peso extra en el bundle.
type P = { className?: string };
const base = "h-5 w-5";

export const IconToday = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M12 8v5l3 2" strokeLinecap="round" />
    <circle cx="12" cy="12" r="9" />
  </svg>
);

export const IconPipeline = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <rect x="3" y="4" width="5" height="12" rx="1.5" />
    <rect x="10" y="4" width="5" height="8" rx="1.5" />
    <rect x="17" y="4" width="4" height="15" rx="1.5" />
  </svg>
);

export const IconClients = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1" strokeLinecap="round" />
    <circle cx="9" cy="8" r="3.2" />
    <path d="M16 11a3 3 0 1 0 0-6M17 20v-1a4.6 4.6 0 0 0-1.4-3.3" strokeLinecap="round" />
  </svg>
);

export const IconAds = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M4 14V10a1 1 0 0 1 1-1h3l6-4v14l-6-4H5a1 1 0 0 1-1-1Z" strokeLinejoin="round" />
    <path d="M18 9.5a4 4 0 0 1 0 5" strokeLinecap="round" />
  </svg>
);

export const IconSearch = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" strokeLinecap="round" />
  </svg>
);

export const IconWhatsApp = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm0 1.8a8.2 8.2 0 1 1-4.2 15.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 0 1 12 3.8Zm-3.2 4c-.2 0-.5 0-.7.4-.2.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.7 2.8 4.3 3.8 2.1.8 2.6.7 3 .6.5 0 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.5-.3-1.7-.8c-.2 0-.4-.1-.6.2l-.8 1c-.2.2-.3.2-.5.1a6.8 6.8 0 0 1-3.4-3c-.2-.4 0-.5.2-.7l.4-.5.2-.4v-.4l-.7-1.8c-.2-.4-.4-.4-.6-.4Z" />
  </svg>
);

export const IconPlus = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={className}>
    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
  </svg>
);

export const IconCheck = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className={className}>
    <path d="m5 12.5 4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconBack = ({ className = base }: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M14 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
