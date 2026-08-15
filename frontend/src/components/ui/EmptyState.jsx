export default function EmptyState({ children, message }) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-text-muted">
      {children || message}
    </div>
  );
}
