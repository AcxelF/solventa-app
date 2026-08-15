import { useState } from "react";
import { categoryIcon } from "../lib/categoryIcons.js";
import { accountTypeMeta } from "../lib/accountMeta.js";
import { todayISO } from "../lib/dates.js";
import Field from "./ui/Field.jsx";
import TextInput from "./ui/TextInput.jsx";
import Select from "./ui/Select.jsx";
import Button from "./ui/Button.jsx";
import IconBadge from "./ui/IconBadge.jsx";

function toggleClass(active) {
  return active
    ? "flex-1 rounded-md bg-bg px-4 py-2 text-sm font-medium text-text shadow-sm"
    : "flex-1 rounded-md px-4 py-2 text-sm font-medium text-text-secondary hover:text-text";
}

export default function TransactionForm({
  accounts,
  categories,
  initial,
  onSubmit,
  onCancel,
}) {
  const [type, setType] = useState(initial?.type ?? "gasto");
  const [accountId, setAccountId] = useState(
    initial?.account_id ?? accounts[0]?.id ?? ""
  );
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [amount, setAmount] = useState(
    initial ? String(initial.amount) : ""
  );
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [description, setDescription] = useState(initial?.description ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const typeCategories = categories.filter((c) => c.type === type);
  const accountOptions = accounts.map((account) => {
    const meta = accountTypeMeta(account.type);
    return {
      value: account.id,
      label: account.name,
      icon: meta.icon,
      color: account.color,
      sub: account.type,
    };
  });
  const categoryOptions = typeCategories.map((category) => ({
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
    if (!accountId) {
      setError("Elige una cuenta.");
      return;
    }
    if (!categoryId) {
      setError("Elige una categoría.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        account_id: Number(accountId),
        category_id: Number(categoryId),
        type,
        amount: parsedAmount,
        date,
        description: description.trim() || undefined,
      });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex rounded-lg bg-surface p-1">
        <button
          type="button"
          onClick={() => {
            setType("gasto");
            setCategoryId("");
          }}
          className={toggleClass(type === "gasto")}
        >
          Gasto
        </button>
        <button
          type="button"
          onClick={() => {
            setType("ingreso");
            setCategoryId("");
          }}
          className={toggleClass(type === "ingreso")}
        >
          Ingreso
        </button>
      </div>

      <Field label="Cuenta">
        <Select
          value={accountId}
          onChange={setAccountId}
          options={accountOptions}
          placeholder="Elige una cuenta…"
          renderOption={(option) => {
            const Icon = option.icon;
            return (
              <>
                <IconBadge color={option.color} icon={Icon} size={24} />
                <span className="truncate">
                  {option.label}
                  <span className="ml-1 text-text-muted">· {option.sub}</span>
                </span>
              </>
            );
          }}
        />
      </Field>

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

      <Field label="Descripción (opcional)">
        <TextInput
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Almuerzo, quincena…"
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
