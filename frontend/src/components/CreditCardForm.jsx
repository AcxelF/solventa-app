import { useState } from "react";
import { BRANDS, BRAND_COLORS } from "../lib/creditCardMeta.js";
import Field from "./ui/Field.jsx";
import TextInput from "./ui/TextInput.jsx";
import Select from "./ui/Select.jsx";
import Button from "./ui/Button.jsx";

export default function CreditCardForm({ initial, onSubmit, onCancel }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "Visa");
  const [lastFour, setLastFour] = useState(initial?.last_four ?? "");
  const [creditLimit, setCreditLimit] = useState(
    initial ? String(initial.credit_limit) : ""
  );
  const [cutDay, setCutDay] = useState(initial ? String(initial.cut_day) : "");
  const [paymentDay, setPaymentDay] = useState(
    initial ? String(initial.payment_day) : ""
  );
  const [color, setColor] = useState(initial?.color ?? BRAND_COLORS[brand]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function handleBrandChange(value) {
    setBrand(value);
    setColor(BRAND_COLORS[value]);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("El alias de la tarjeta es obligatorio.");
      return;
    }
    if (!/^\d{4}$/.test(lastFour)) {
      setError("Los últimos 4 dígitos deben ser 4 números.");
      return;
    }
    const limit = Number(creditLimit);
    if (!Number.isFinite(limit) || limit <= 0) {
      setError("La línea de crédito debe ser un número mayor a 0.");
      return;
    }
    const cut = Number(cutDay);
    if (!Number.isInteger(cut) || cut < 1 || cut > 31) {
      setError("El día de corte debe ser un número entre 1 y 31.");
      return;
    }
    const payment = Number(paymentDay);
    if (!Number.isInteger(payment) || payment < 1 || payment > 31) {
      setError("El día de pago debe ser un número entre 1 y 31.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        brand,
        last_four: lastFour,
        credit_limit: limit,
        cut_day: cut,
        payment_day: payment,
        color,
      });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Alias">
          <TextInput
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="BCP Visa Signature…"
          />
        </Field>
        <Field label="Últimos 4 dígitos">
          <TextInput
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={lastFour}
            onChange={(e) => setLastFour(e.target.value.replace(/\D/g, ""))}
            placeholder="4821"
            className="font-mono"
          />
        </Field>
      </div>

      <Field label="Marca">
        <Select
          value={brand}
          onChange={handleBrandChange}
          options={BRANDS.map((b) => ({ value: b, label: b }))}
        />
      </Field>

      <Field label="Línea de crédito">
        <TextInput
          type="number"
          step="0.01"
          min="0.01"
          value={creditLimit}
          onChange={(e) => setCreditLimit(e.target.value)}
          placeholder="0.00"
          className="font-mono"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Día de corte (1-31)">
          <TextInput
            type="number"
            min="1"
            max="31"
            value={cutDay}
            onChange={(e) => setCutDay(e.target.value)}
            placeholder="15"
          />
        </Field>
        <Field label="Día de pago (1-31)">
          <TextInput
            type="number"
            min="1"
            max="31"
            value={paymentDay}
            onChange={(e) => setPaymentDay(e.target.value)}
            placeholder="8"
          />
        </Field>
      </div>

      <Field label="Color">
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded-md border border-border bg-bg p-0.5"
          />
          {BRANDS.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setColor(BRAND_COLORS[b])}
              title={`Color ${b}`}
              className={`h-6 w-6 rounded-full border border-border transition ${
                color === BRAND_COLORS[b] ? "ring-2 ring-text ring-offset-2" : ""
              }`}
              style={{ backgroundColor: BRAND_COLORS[b] }}
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
