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
        whileHover={{ rotate: -4, scale: 1.05 }}
        transition={{ type: "spring", stiffness: 300, damping: 18 }}
        className="drop-shadow-sm"
      >
        <defs>
          <linearGradient id="folio-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="oklch(0.62 0.18 250)" />
            <stop offset="100%" stopColor="oklch(0.48 0.16 260)" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="30" height="30" rx="8" fill="url(#folio-grad)" />
        <motion.path
          d="M6 22 L12 14 L17 18 L26 8"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />
        <motion.circle
          cx="26" cy="8" r="2.2" fill="white"
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.9, type: "spring", stiffness: 300 }}
        />
      </motion.svg>
      {withWordmark && (
        <span className="font-semibold tracking-tight text-[15px]">Folio</span>
      )}
    </div>
  );
}
