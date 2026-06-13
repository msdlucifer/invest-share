import { motion } from "framer-motion";

export function Logo({ size = 28, withWordmark = true }: { size?: number; withWordmark?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <motion.svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        whileHover={{ rotate: -3, scale: 1.06 }}
        transition={{ type: "spring", stiffness: 320, damping: 20 }}
      >
        <defs>
          <linearGradient id="folio-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="oklch(0.7 0.2 275)" />
            <stop offset="100%" stopColor="oklch(0.45 0.22 285)" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#folio-grad)" />
        <path
          d="M6 22 L12 14 L17 18 L26 8"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="26" cy="8" r="2.2" fill="white" />
      </motion.svg>
      {withWordmark && (
        <span className="font-serif font-bold tracking-tight text-[17px]">Folio</span>
      )}
    </div>
  );
}
