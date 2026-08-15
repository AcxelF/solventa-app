import { useState } from "react";
import Field from "./ui/Field.jsx";
import TextInput from "./ui/TextInput.jsx";
import Button from "./ui/Button.jsx";

export default function GoalForm({ initial, onSubmit, onCancel }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [targetAmount, setTargetAmount] = useState(
    initial ? String(initial.target_amount) : ""
  );
  const [deadline, setDeadline] = useState(initial?.deadline ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("El nombre de la meta es obligatorio.");
      return;
    }
    const parsedTarget = Number(targetAmount);
    if (!Number.isFinite(parsedTarget) || parsedTarget <= 0) {
      setError("El monto objetivo debe ser un número mayor a 0.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        target_amount: parsedTarget,
        deadline: deadline || undefined,
      });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Nombre de la meta">
        <TextInput
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Vacaciones, laptop nueva…"
        />
      </Field>

      <Field label="Monto objetivo">
        <TextInput
          type="number"
          step="0.01"
          min="0.01"
          value={targetAmount}
          onChange={(e) => setTargetAmount(e.target.value)}
          placeholder="0.00"
          className="font-mono"
        />
      </Field>

      <Field label="Fecha límite (opcional)">
        <TextInput
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
      </Field>

      {error && <p className="text-sm text-negative">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
