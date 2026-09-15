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
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => {
            const meta = accountTypeMeta(account.type);
            const isCredit = account.type === "Tarjeta de crédito";
            return (
              <div
                key={account.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-md hover:border-border-hover"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <IconBadge color={account.color} icon={meta.icon} size={42} />
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-text">
                        {account.name}
                      </p>
                      <span
                        className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                          isCredit
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        }`}
                      >
                        {isCredit ? "Tarjeta de Crédito" : "Dinero Líquido"}
                      </span>
                    </div>
                  </div>

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
                </div>

                <div className="mt-6 flex items-end justify-between border-t border-border/50 pt-3">
                  <p className="text-xs text-text-muted">{account.type}</p>
                  <span
                    className={`font-mono text-lg font-bold ${
                      isCredit
                        ? account.balance < 0
                          ? "text-negative"
                          : "text-text"
                        : "text-text"
                    }`}
                  >
                    {formatMoney(account.balance)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
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
