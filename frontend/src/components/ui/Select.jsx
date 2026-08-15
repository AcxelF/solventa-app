import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export default function Select({
  value,
  onChange,
  options,
  placeholder = "Selecciona…",
  renderOption,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleDocClick(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, []);

  const selected = options.find((option) => option.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text"
      >
        {selected ? (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {renderOption ? (
              renderOption(selected)
            ) : (
              <span className="truncate">{selected.label}</span>
            )}
          </span>
        ) : (
          <span className="text-text-muted">{placeholder}</span>
        )}
        <ChevronDown
          size={16}
          className={`shrink-0 text-text-muted transition ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-surface py-1 shadow-soft">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text hover:bg-surface-2"
            >
              {renderOption ? renderOption(option) : option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
