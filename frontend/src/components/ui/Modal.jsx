import { useEffect, useState } from "react";
import { X } from "lucide-react";

const ANIM_MS = 150;

export default function Modal({ title, onClose, children, wide = false }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closing]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function handleClose() {
    if (closing) return;
    setClosing(true);
    setOpen(false);
    setTimeout(onClose, ANIM_MS + 10);
  }

  const visible = open && !closing;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-150 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{ transitionTimingFunction: closing ? "ease-in" : "ease-out" }}
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${
          wide ? "max-w-lg" : "max-w-md"
        } rounded-2xl bg-surface p-6 shadow-soft transition-all duration-150 ${
          visible ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
        style={{ transitionTimingFunction: closing ? "ease-in" : "ease-out" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-text">{title}</h3>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md p-1 text-text-muted hover:bg-surface-2 hover:text-text"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
