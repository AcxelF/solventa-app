import { useCallback, useEffect, useState } from "react";
import { Plus, RotateCcw } from "lucide-react";
import {
  fetchTransactions,
  createTransaction,
  createInstallmentPurchase,
  updateTransaction,
  deleteTransaction,
} from "../api.js";
import { categoryIcon } from "../lib/categoryIcons.js";
import { accountTypeMeta } from "../lib/accountMeta.js";
import TransactionList from "./TransactionList.jsx";
import TransactionForm from "./TransactionForm.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx";
import Modal from "./ui/Modal.jsx";
import Button from "./ui/Button.jsx";
import Field from "./ui/Field.jsx";
import Select from "./ui/Select.jsx";
import TextInput from "./ui/TextInput.jsx";
import IconBadge from "./ui/IconBadge.jsx";

const PAGE_SIZE = 50;

export default function TransactionsView({
  accounts,
  categories,
  onDataChanged,
  initialFilters = {},
}) {
  const [accountId, setAccountId] = useState(initialFilters.account_id ?? "");
  const [categoryId, setCategoryId] = useState(
    initialFilters.category_id != null ? String(initialFilters.category_id) : ""
  );
  const [from, setFrom] = useState(initialFilters.from ?? "");
  const [to, setTo] = useState(initialFilters.to ?? "");
  const [transactions, setTransactions] = useState([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const hasFilters = Boolean(accountId || categoryId || from || to);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTransactions({
        account_id: accountId,
        category_id: categoryId,
        from,
        to,
      });
      setTransactions(data);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [accountId, categoryId, from, to]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    load();
  }, [load]);

  async function handleSave(payload) {
    if (form?.editing) {
      await updateTransaction(form.editing.id, payload);
    } else if (payload.isInstallment) {
      const { isInstallment, ...installmentPayload } = payload;
      await createInstallmentPurchase(installmentPayload);
    } else {
      await createTransaction(payload);
    }
    setForm(null);
    await load();
    await onDataChanged();
  }

  async function confirmDelete() {
    if (pendingDelete == null) return;
    const id = pendingDelete;
    setPendingDelete(null);
    await deleteTransaction(id);
    await load();
    await onDataChanged();
  }

  function handleClearFilters() {
    setAccountId("");
    setCategoryId("");
    setFrom("");
    setTo("");
  }

  const accountOptions = [
    { value: "", label: "Todas" },
    ...accounts.map((account) => {
      const meta = accountTypeMeta(account.type);
      return {
        value: String(account.id),
        label: account.name,
        icon: meta.icon,
        color: account.color,
        sub: account.type,
      };
    }),
  ];

  const categoryOptions = [
    { value: "", label: "Todas" },
    ...categories.map((category) => ({
      value: String(category.id),
      label: category.name,
      icon: category.icon,
      color: category.color,
    })),
  ];

  const visibleTransactions = transactions.slice(0, visibleCount);
  const hasMore = visibleCount < transactions.length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text">Transacciones</h2>
        <Button variant="primary" onClick={() => setForm({ editing: null })}>
          <Plus size={16} />
          Nuevo
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Cuenta">
          <Select
            value={accountId}
            onChange={setAccountId}
            options={accountOptions}
            placeholder="Todas las cuentas…"
            renderOption={(option) =>
              option.value === "" ? (
                option.label
              ) : (
                <>
                  <IconBadge color={option.color} icon={option.icon} size={24} />
                  <span className="truncate">
                    {option.label}
                    <span className="ml-1 text-text-muted">· {option.sub}</span>
                  </span>
                </>
              )
            }
          />
        </Field>

        <Field label="Categoría">
          <Select
            value={categoryId}
            onChange={setCategoryId}
            options={categoryOptions}
            placeholder="Todas las categorías…"
            renderOption={(option) =>
              option.value === "" ? (
                option.label
              ) : (
                <>
                  <IconBadge color={option.color} icon={categoryIcon(option.icon)} size={24} />
                  <span className="truncate">{option.label}</span>
                </>
              )
            }
          />
        </Field>

        <Field label="Desde">
          <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>

        <Field label="Hasta">
          <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>

      {hasFilters && (
        <div className="mt-3 flex items-center justify-between">
          <Button variant="ghost" onClick={handleClearFilters}>
            <RotateCcw size={14} />
            Limpiar filtros
          </Button>
        </div>
      )}

      {!loading && (
        <p className="mt-3 text-sm text-text-muted">
          {transactions.length} movimiento{transactions.length === 1 ? "" : "s"}
          {hasFilters ? " con los filtros aplicados" : " en total"}
        </p>
      )}

      {error && <p className="mt-3 text-sm text-negative">{error}</p>}

      <div className="mt-3">
        <TransactionList
          transactions={visibleTransactions}
          loading={loading}
          variant="grid"
          onEdit={(transaction) => setForm({ editing: transaction })}
          onDelete={setPendingDelete}
          emptyMessage={
            hasFilters
              ? "No hay movimientos con los filtros seleccionados."
              : "Aún no hay movimientos registrados."
          }
        />
      </div>

      {hasMore && (
        <div className="mt-3 flex justify-center">
          <Button variant="subtle" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
            Mostrar más
          </Button>
        </div>
      )}

      {form && (
        <Modal
          title={form.editing ? "Editar movimiento" : "Nuevo movimiento"}
          onClose={() => setForm(null)}
        >
          <TransactionForm
            accounts={accounts}
            categories={categories}
            initial={form.editing}
            onSubmit={handleSave}
            onCancel={() => setForm(null)}
          />
        </Modal>
      )}

      {pendingDelete != null && (
        <ConfirmDialog
          title="¿Eliminar movimiento?"
          message="Esta acción no se puede deshacer."
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
