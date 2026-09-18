function pad(value) {
  return String(value).padStart(2, "0");
}

export function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function currentMonthISO() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

export function shiftMonth(month, delta) {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(year, monthIndex - 1 + delta, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export function monthLabel(month) {
  const [year, monthIndex] = month.split("-").map(Number);
  return `${MONTHS[monthIndex - 1]} ${year}`;
}

const MONTHS_SHORT = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

export function formatDateShort(iso) {
  const [year, monthIndex, day] = iso.split("-");
  return `${Number(day)} ${MONTHS_SHORT[Number(monthIndex) - 1]} ${year}`;
}

// `created_at` viene de SQLite como "YYYY-MM-DD HH:mm:ss" en UTC, sin
// indicarlo explícitamente. Si se le pasa tal cual a `new Date(...)`, el
// navegador lo interpreta como hora local (no UTC) y muestra la hora
// equivocada — por eso se marca "Z" a mano antes de convertir.
export function formatTimeShort(createdAt) {
  if (!createdAt) return "";
  const date = new Date(`${createdAt.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("es-PE", { hour: "numeric", minute: "2-digit" });
}

export function daysUntil(iso) {
  const target = new Date(`${iso}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target - now) / 86400000);
}

export function daysRemainingLabel(iso) {
  const diff = daysUntil(iso);
  if (diff > 0) {
    return `${diff} día${diff === 1 ? "" : "s"} restante${diff === 1 ? "" : "s"}`;
  }
  if (diff === 0) return "Vence hoy";
  return `Vencida hace ${-diff} día${-diff === 1 ? "" : "s"}`;
}
