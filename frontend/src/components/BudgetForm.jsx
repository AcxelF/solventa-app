import { useState } from "react";
import { categoryIcon } from "../lib/categoryIcons.js";
import Field from "./ui/Field.jsx";
import TextInput from "./ui/TextInput.jsx";
import Select from "./ui/Select.jsx";
import Button from "./ui/Button.jsx";
import IconBadge from "./ui/IconBadge.jsx";

export default function BudgetForm({ categories, initial, onSubmit, onCancel }) {
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const categoryOptions = categories.map((category) => ({
    value: category.id,
    label: category.name,
    icon: category.icon,
    color: category.color,
  }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("El monto debe ser un número mayor a 0.");
      return;
    }
    if (!initial && !categoryId) {
      setError("Elige una categoría.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit(
        initial
          ? { amount: parsedAmount }
          : { category_id: Number(categoryId), amount: parsedAmount }
      );
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {initial ? (
        <Field label="Categoría">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text">
            <IconBadge
              color={initial.color}
              icon={categoryIcon(initial.icon)}
              size={24}
            />
            <span className="truncate">{initial.category}</span>
          </div>
        </Field>
      ) : (
        <Field label="Categoría">
          <Select
            value={categoryId}
            onChange={setCategoryId}
            options={categoryOptions}
            placeholder="Elige una categoría…"
            renderOption={(option) => {
              const Icon = categoryIcon(option.icon);
              return (
                <>
                  <IconBadge color={option.color} icon={Icon} size={24} />
                  <span className="truncate">{option.label}</span>
                </>
              );
            }}
          />
        </Field>
      )}

      <Field label="Límite mensual">
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
