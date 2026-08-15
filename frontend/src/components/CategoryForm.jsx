import { useState } from "react";
import { ICON_CHOICES, categoryIcon } from "../lib/categoryIcons.js";
import Field from "./ui/Field.jsx";
import TextInput from "./ui/TextInput.jsx";
import Button from "./ui/Button.jsx";

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export default function CategoryForm({ initial, typeProp, onSubmit, onCancel }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "tag");
  const [color, setColor] = useState(initial?.color ?? "#E67E22");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("El nombre de la categoría es obligatorio.");
      return;
    }
    if (!HEX_COLOR.test(color)) {
      setError("Elige un color válido.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        type: typeProp,
        icon,
        color,
      });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Nombre">
        <TextInput
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Transporte, Suscripciones…"
        />
      </Field>

      <Field label={`Tipo · ${typeProp === "gasto" ? "Gasto" : "Ingreso"}`} />

      <Field label="Ícono">
        <div className="mt-1 grid grid-cols-6 gap-2">
          {ICON_CHOICES.map((iconName) => {
            const Icon = categoryIcon(iconName);
            const active = icon === iconName;
            return (
              <button
                key={iconName}
                type="button"
                onClick={() => setIcon(iconName)}
                title={iconName}
                className={`flex h-9 items-center justify-center rounded-lg border transition ${
                  active
                    ? "border-text bg-text text-bg"
                    : "border-border text-text-secondary hover:border-text-muted hover:text-text"
                }`}
              >
                <Icon size={16} />
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Color">
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded-md border border-border bg-bg p-0.5"
          />
          <span className="font-mono text-xs text-text-muted">{color}</span>
        </div>
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
