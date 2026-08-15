const variants = {
  primary: "bg-text text-bg hover:opacity-90",
  subtle:
    "border border-border text-text-secondary hover:border-text-muted hover:text-text",
  ghost: "text-text-secondary hover:bg-surface-2 hover:text-text",
  danger: "text-negative hover:bg-negative/10",
  dangerSolid: "bg-negative text-white hover:opacity-90",
};

export default function Button({
  variant = "subtle",
  className = "",
  ...props
}) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${className}`}
    />
  );
}
