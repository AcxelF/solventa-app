const base =
  "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted outline-none transition focus:border-text-secondary";

export default function TextInput({ className = "", ...props }) {
  return <input {...props} className={`${base} ${className}`} />;
}
