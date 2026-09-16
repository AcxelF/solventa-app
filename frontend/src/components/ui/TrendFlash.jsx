import { useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";

// Muestra una flecha animada de subida/bajada solo cuando `value` cambia de
// verdad (no en cada refresco del dashboard) — desaparece sola después.
export default function TrendFlash({ value, invert = false }) {
  const prevRef = useRef(value);
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    if (prevRef.current !== value) {
      const rose = value > prevRef.current;
      prevRef.current = value;
      setFlash(rose ? "up" : "down");
      const timer = setTimeout(() => setFlash(null), 1400);
      return () => clearTimeout(timer);
    }
    prevRef.current = value;
  }, [value]);

  if (!flash) return null;

  const isGood = invert ? flash === "down" : flash === "up";
  const Icon = flash === "up" ? ArrowUp : ArrowDown;

  return (
    <span
      className={`inline-flex animate-trend-flash items-center ${
        isGood ? "text-positive" : "text-negative"
      }`}
    >
      <Icon size={18} strokeWidth={3} />
    </span>
  );
}
