export default function StreakWidget({ streak }) {
  const months = streak?.months ?? 0;

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <h2 className="text-base font-semibold text-text">Racha de presupuesto</h2>

      {months >= 1 ? (
        <p className="mt-2 text-sm leading-relaxed text-text">
          🔥 <span className="font-semibold">{months}</span> mes
          {months === 1 ? "" : "es"} seguidos dentro de tu presupuesto de{" "}
          <span className="font-semibold">{streak.category}</span>
        </p>
      ) : (
        <p className="mt-2 text-sm text-text-muted">
          Aún no tienes una racha activa
        </p>
      )}
    </section>
  );
}
