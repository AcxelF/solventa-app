import { useState } from "react";
import { ACCOUNT_TYPES, accountTypeMeta } from "../lib/accountMeta.js";
import Field from "./ui/Field.jsx";
import TextInput from "./ui/TextInput.jsx";
import Select from "./ui/Select.jsx";
import Button from "./ui/Button.jsx";
import IconBadge from "./ui/IconBadge.jsx";

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export default function AccountForm({ initial, onSubmit, onCancel }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState(initial?.type ?? ACCOUNT_TYPES[0].value);
  const [color, setColor] = useState(
    initial?.color ?? ACCOUNT_TYPES[0].color
  );
  const [iconUrl, setIconUrl] = useState(initial?.icon_url ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function handleTypeChange(value) {
    setType(value);
    setColor(accountTypeMeta(value).color);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("El nombre de la cuenta es obligatorio.");
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
        type,
        color,
        icon_url: type === "Otro" && iconUrl.trim() ? iconUrl.trim() : undefined,
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
          placeholder="Mi Yape, Efectivo, BCP…"
        />
      </Field>

      <Field label="Tipo">
        <Select
          value={type}
          onChange={handleTypeChange}
          options={ACCOUNT_TYPES.map((t) => ({
            value: t.value,
            label: t.value,
            icon: t.icon,
            color: t.color,
          }))}
          renderOption={(option) => (
            <>
              <IconBadge color={option.color} icon={option.icon} size={24} />
              <span className="truncate">{option.label}</span>
            </>
          )}
        />
      </Field>

      {type === "Otro" && (
        <Field label="Logo personalizado (URL, opcional)">
          <TextInput
            type="url"
            value={iconUrl}
            onChange={(e) => setIconUrl(e.target.value)}
            placeholder="https://…"
          />
        </Field>
      )}

      <Field label="Color">
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded-md border border-border bg-bg p-0.5"
          />
          {ACCOUNT_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setColor(t.color)}
              title={t.value}
              className={`h-6 w-6 rounded-full border border-border transition ${
                color === t.color ? "ring-2 ring-text ring-offset-2" : ""
              }`}
              style={{ backgroundColor: t.color }}
            />
          ))}
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
