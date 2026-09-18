import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  fetchCreditCards,
  fetchCreditCard,
  fetchTransactions,
  createCreditCard,
  updateCreditCard,
  deleteCreditCard,
} from "../api.js";
import { formatMoney } from "../utils/format.js";
import { readableOn } from "../utils/color.js";
import CreditCardForm from "./CreditCardForm.jsx";
import CreditCardDetail from "./CreditCardDetail.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx";
import Modal from "./ui/Modal.jsx";
import Button from "./ui/Button.jsx";
import EmptyState from "./ui/EmptyState.jsx";

const CARD_STYLE = {
  backgroundImage:
    "linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.02) 40%, rgba(0,0,0,0.08))",
};

export default function CreditCardsView() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [detail, setDetail] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);

  const load = useCallback(async () => {
    setCards(await fetchCreditCards());
  }, []);

  useEffect(() => {
    setLoading(true);
    load()
      .then(() => setLoading(false))
      .catch(() => setLoading(false));
  }, [load]);

  async function openDetail(card) {
    setDetail(card);
    setDetailLoading(true);
    try {
      const [updated, tx] = await Promise.all([
        fetchCreditCard(card.id),
        fetchTransactions({ account_id: card.id }),
      ]);
      setDetail(updated);
      setTransactions(tx);
    } catch (err) {
      setError(err.message);
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshDetail() {
    if (!detail) return;
    setDetailLoading(true);
    try {
      const [updated, tx] = await Promise.all([
        fetchCreditCard(detail.id),
        fetchTransactions({ account_id: detail.id }),
      ]);
      setDetail(updated);
      setTransactions(tx);
    } catch (err) {
      setError(err.message);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleSave(payload) {
    if (form?.editing) {
      await updateCreditCard(form.editing.id, payload);
    } else {
      await createCreditCard(payload);
    }
    setForm(null);
    await load();
    if (detail) await refreshDetail();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const card = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteCreditCard(card.id);
      setError("");
      if (detail?.id === card.id) setDetail(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text">Tarjetas de crédito</h2>
        <Button variant="primary" onClick={() => setForm({ editing: null })}>
          <Plus size={16} />
          Nueva tarjeta
        </Button>
      </div>

      {error && <p className="mt-3 text-sm text-negative">{error}</p>}

      {loading ? (
        <p className="mt-6 text-sm text-text-muted">Cargando…</p>
      ) : cards.length === 0 ? (
        <div className="mt-6">
          <EmptyState message="Aún no tienes tarjetas de crédito registradas." />
        </div>
      ) : (
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => {
            const textColor = readableOn(card.color);
            return (
              <li key={card.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => openDetail(card)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openDetail(card);
                    }
                  }}
                  className="group relative cursor-pointer overflow-hidden rounded-2xl p-5 shadow-soft transition hover:-translate-y-0.5"
                  style={{
                    backgroundColor: card.color,
                    backgroundImage: CARD_STYLE.backgroundImage,
                    aspectRatio: "1.586",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p
                      className="truncate text-sm font-semibold"
                      style={{ color: textColor }}
                    >
                      {card.name}
                    </p>
                    <div
                      className="flex shrink-0 gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => setForm({ editing: card })}
                        title="Editar"
                        className="rounded-md p-1.5 hover:bg-white/20"
                        style={{ color: textColor }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(card)}
                        title="Eliminar"
                        className="rounded-md p-1.5 hover:bg-white/20"
                        style={{ color: textColor }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <p
                    className="mt-8 font-mono text-base tracking-[0.2em]"
                    style={{ color: textColor }}
                  >
                    •••• {card.last_four}
                  </p>

                  <div className="mt-6 flex items-end justify-between gap-2">
                    <span
                      className="text-xs font-semibold uppercase tracking-widest"
                      style={{ color: textColor }}
                    >
                      {card.brand}
                    </span>
                    <span className="text-xs" style={{ color: textColor }}>
                      Línea {formatMoney(card.credit_limit)}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {form && (
        <Modal
          title={form.editing ? "Editar tarjeta" : "Nueva tarjeta"}
          onClose={() => setForm(null)}
        >
          <CreditCardForm
            initial={form.editing}
            onSubmit={handleSave}
            onCancel={() => setForm(null)}
          />
        </Modal>
      )}

      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(null)} wide>
          <CreditCardDetail
            card={detail}
            transactions={transactions}
            loading={detailLoading}
            onEdit={() => {
              setDetail(null);
              setForm({ editing: detail });
            }}
            onDelete={() => setPendingDelete(detail)}
            onPaymentChange={async () => {
              await refreshDetail();
              await load();
            }}
          />
        </Modal>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`¿Eliminar la tarjeta "${pendingDelete.name}"?`}
          message="Esta acción no se puede deshacer."
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
