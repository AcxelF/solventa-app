import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { accountTypeMeta } from "../lib/accountMeta.js";
import { formatMoney } from "../utils/format.js";
import { createAccount, updateAccount, deleteAccount } from "../api.js";
import AccountForm from "./AccountForm.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx";
import Modal from "./ui/Modal.jsx";
import Button from "./ui/Button.jsx";
import IconBadge from "./ui/IconBadge.jsx";
import EmptyState from "./ui/EmptyState.jsx";

export default function AccountsView({ accounts, onDataChanged }) {
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);

  async function handleSave(payload) {
    if (form?.editing) {
      await updateAccount(form.editing.id, payload);
    } else {
      await createAccount(payload);
    }
    setForm(null);
    await onDataChanged();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const account = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteAccount(account.id);
      setError("");
      await onDataChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text">Cuentas</h2>
        <Button variant="primary" onClick={() => setForm({ editing: null })}>
          <Plus size={16} />
          Nueva cuenta
        </Button>
      </div>

      {error && <p className="mt-3 text-sm text-negative">{error}</p>}

      {accounts.length === 0 ? (
        <div className="mt-6">
          <EmptyState message="Crea tu primera cuenta para empezar a registrar movimientos." />
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-surface">
          {accounts.map((account) => {
            const meta = accountTypeMeta(account.type);
            return (
              <li key={account.id} className="group flex items-center gap-4 px-4 py-3">
                <IconBadge color={account.color} icon={meta.icon} size={40} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">
                    {account.name}
                  </p>
                  <p className="text-xs text-text-muted">{account.type}</p>
                </div>

                <span className="shrink-0 font-mono text-sm font-semibold text-text">
                  {formatMoney(account.balance)}
                </span>

                <div className="flex gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => setForm({ editing: account })}
                    title="Editar"
                    className="rounded-md p-1.5 text-text-muted hover:bg-surface-2 hover:text-text"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(account)}
                    title="Eliminar"
                    className="rounded-md p-1.5 text-text-muted hover:bg-negative/10 hover:text-negative"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {form && (
        <Modal
          title={form.editing ? "Editar cuenta" : "Nueva cuenta"}
          onClose={() => setForm(null)}
        >
          <AccountForm
            initial={form.editing}
            onSubmit={handleSave}
            onCancel={() => setForm(null)}
          />
        </Modal>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`¿Eliminar la cuenta "${pendingDelete.name}"?`}
          message="Esta acción no se puede deshacer."
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
