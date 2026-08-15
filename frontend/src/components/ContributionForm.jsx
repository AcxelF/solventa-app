import { useState } from "react";
import { todayISO } from "../lib/dates.js";
import Field from "./ui/Field.jsx";
import TextInput from "./ui/TextInput.jsx";
import Button from "./ui/Button.jsx";

export default function ContributionForm({ onSubmit }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("El monto del aporte debe ser un número mayor a 0.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        amount: parsedAmount,
        date,
        note: note.trim() || undefined,
      });
      setAmount("");
      setNote("");
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Monto">
          <TextInput
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="font-mono"
          />
        </Field>
        <Field label="Fecha">
          <TextInput
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Nota (opcional)">
        <TextInput
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Quincena, bono, venta…"
        />
      </Field>

      {error && <p className="text-sm text-negative">{error}</p>}

      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? "Guardando…" : "Agregar aporte"}
        </Button>
      </div>
    </form>
  );
}
