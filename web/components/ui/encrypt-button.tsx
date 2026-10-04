"use client";

// A button whose label scrambles through random characters on hover and settles back, with a
// glow and a scanning line. Used for the one action that fixes a price.

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";

const CYCLES_PER_LETTER = 3;
const SHUFFLE_TIME = 30;
const CHARS = "!@#$%^&*():{};|,.<>/?ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function EncryptButton({
  label,
  onClick,
  disabled,
  className,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // The scrambled text remembers which label it scrambles: once the label changes (the call was
  // sent, the validators are reading) the new label shows at once, whatever the pointer does.
  const [scrambled, setScrambled] = useState<{ of: string; text: string } | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const shown = scrambled && scrambled.of === label ? scrambled.text : label;
  // A disabled button gets no mouseleave (pointer-events are off), so it never looks hovered.
  const hot = isHovered && !disabled;

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const stopScramble = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setScrambled(null);
  };

  const scramble = () => {
    const from = label;
    let pos = 0;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      // Spaces stay spaces, so the label can still wrap on a narrow screen while it scrambles.
      const text = from
        .split("")
        .map((char, index) => (char === " " || pos / CYCLES_PER_LETTER > index ? char : CHARS[Math.floor(Math.random() * CHARS.length)]))
        .join("");
      setScrambled({ of: from, text });
      pos++;
      if (pos >= from.length * CYCLES_PER_LETTER) stopScramble();
    }, SHUFFLE_TIME);
  };

  return (
    <div className={cn("relative inline-block", disabled && "pointer-events-none opacity-50", className)}>
      <motion.div
        className="absolute inset-0 rounded-2xl opacity-75 blur-xl"
        animate={{
          background: hot
            ? "linear-gradient(45deg, #4a9eff, #06b6d4, #10b981, #4a9eff)"
            : "linear-gradient(45deg, #1f2937, #374151, #4b5563, #1f2937)",
        }}
        transition={{ duration: 0.6 }}
        style={{ backgroundSize: "300% 300%" }}
      />
      <motion.button
        type="button"
        disabled={disabled}
        onClick={onClick}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.98 }}
        onMouseEnter={() => {
          setIsHovered(true);
          scramble();
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          stopScramble();
        }}
        className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-600/50 bg-slate-800/90 px-8 py-4 shadow-2xl backdrop-blur-sm transition-all duration-300"
        style={{
          boxShadow: hot
            ? "0 0 50px rgba(74, 158, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
            : "0 10px 30px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
        }}
      >
        <div className="relative z-10 flex items-center justify-center gap-3">
          <motion.div animate={{ rotateY: hot ? 180 : 0 }} transition={{ duration: 0.6, type: "spring", stiffness: 200 }} className="relative">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={hot ? "text-cyan-400" : "text-slate-300"}>
              <path d="M6 10V8C6 5.79 7.79 4 10 4H14C16.21 4 18 5.79 18 8V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 10H19C20.1 10 21 10.9 21 12V18C21 19.1 20.1 20 19 20H5C3.9 20 3 19.1 3 18V12C3 10.9 3.9 10 5 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="15" r="2" fill="currentColor" />
            </svg>
          </motion.div>
          <span
            className={cn(
              "font-mono text-base font-bold tracking-wider transition-all duration-300",
              hot ? "bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent" : "text-slate-200",
            )}
          >
            {shown}
          </span>
        </div>
        <motion.div
          className="absolute inset-0 overflow-hidden rounded-2xl"
          initial={false}
          animate={{ opacity: hot ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="absolute top-0 left-0 h-0.5 w-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
            animate={{ y: hot ? [0, 56, 0] : 0, opacity: hot ? [0, 1, 0] : 0 }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </motion.button>
    </div>
  );
}
