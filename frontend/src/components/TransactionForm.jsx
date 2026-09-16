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
  const [isInstallment, setIsInstallment] = useState(false);
  const [totalInstallments, setTotalInstallments] = useState("2");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedAccount = accounts.find((a) => a.id === Number(accountId));
  const isCreditCard = selectedAccount?.type === "Tarjeta de crédito";
  const canUseInstallments = !initial && type === "gasto" && isCreditCard;

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

    const parsedInstallments = Number(totalInstallments);
    if (
      canUseInstallments &&
      isInstallment &&
      (!Number.isInteger(parsedInstallments) || parsedInstallments < 2)
    ) {
      setError("El número de cuotas debe ser un entero de al menos 2.");
      return;
    }

    setSaving(true);
    try {
      if (canUseInstallments && isInstallment) {
        await onSubmit({
          isInstallment: true,
          account_id: Number(accountId),
          category_id: Number(categoryId),
          type,
          total_amount: parsedAmount,
          total_installments: parsedInstallments,
          date,
          description: description.trim() || undefined,
        });
      } else {
        await onSubmit({
          account_id: Number(accountId),
          category_id: Number(categoryId),
          type,
          amount: parsedAmount,
          date,
          description: description.trim() || undefined,
        });
      }
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

      <Field label={isInstallment && canUseInstallments ? "Monto total de la compra" : "Monto"}>
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

      {canUseInstallments && (
        <div className="rounded-xl border border-border bg-surface-2 p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-text">
            <input
              type="checkbox"
              checked={isInstallment}
              onChange={(e) => setIsInstallment(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-text"
            />
            Es una compra en cuotas
          </label>

          {isInstallment && (
            <div className="mt-3">
              <Field
                label="Número de cuotas"
                hint="Se crea un movimiento por cada cuota, uno por mes, empezando en la fecha de abajo."
              >
                <TextInput
                  type="number"
                  step="1"
                  min="2"
                  value={totalInstallments}
                  onChange={(e) => setTotalInstallments(e.target.value)}
                  placeholder="6"
                />
              </Field>
            </div>
          )}
        </div>
      )}

      <Field label={isInstallment && canUseInstallments ? "Fecha de la primera cuota" : "Fecha"}>
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
