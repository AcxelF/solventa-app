import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, CircleCheck } from "lucide-react";
import {
  fetchGoals,
  fetchGoal,
  fetchContributions,
  createGoal,
  updateGoal,
  deleteGoal,
  addContribution,
  deleteContribution,
} from "../api.js";
import { formatMoney } from "../utils/format.js";
import { formatDateShort, daysRemainingLabel } from "../lib/dates.js";
import GoalForm from "./GoalForm.jsx";
import GoalDetail from "./GoalDetail.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx";
import Modal from "./ui/Modal.jsx";
import Button from "./ui/Button.jsx";
import EmptyState from "./ui/EmptyState.jsx";

function barColor(completed) {
  return completed ? "bg-amber-400" : "bg-indigo-500";
}

export default function GoalsView({ initialGoalId }) {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [detail, setDetail] = useState(null);
  const [contributions, setContributions] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingDeleteGoal, setPendingDeleteGoal] = useState(null);
  const [pendingDeleteContribution, setPendingDeleteContribution] = useState(null);

  const load = useCallback(async () => {
    setGoals(await fetchGoals());
  }, []);

  useEffect(() => {
    setLoading(true);
    load()
      .then(() => setLoading(false))
      .catch(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (!initialGoalId) return;
    let cancelled = false;
    setDetailLoading(true);
    Promise.all([fetchGoal(initialGoalId), fetchContributions(initialGoalId)])
      .then(([goal, contribs]) => {
        if (cancelled) return;
        setDetail(goal);
        setContributions(contribs);
        setError("");
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialGoalId]);

  async function refreshDetail() {
    if (!detail) return;
    setDetailLoading(true);
    try {
      const [updated, contribs] = await Promise.all([
        fetchGoal(detail.id),
        fetchContributions(detail.id),
      ]);
      setDetail(updated);
      setContributions(contribs);
    } catch (err) {
      setError(err.message);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleSaveGoal(payload) {
    if (form?.editing) {
      await updateGoal(form.editing.id, payload);
    } else {
      await createGoal(payload);
    }
    setForm(null);
    await load();
    if (detail) await refreshDetail();
  }

  async function confirmDeleteGoal() {
    if (!pendingDeleteGoal) return;
    const goal = pendingDeleteGoal;
    setPendingDeleteGoal(null);
    try {
      await deleteGoal(goal.id);
      setError("");
      if (detail?.id === goal.id) setDetail(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddContribution(payload) {
    await addContribution(detail.id, payload);
    await Promise.all([load(), refreshDetail()]);
  }

  async function confirmDeleteContribution() {
    if (!pendingDeleteContribution) return;
    const contribution = pendingDeleteContribution;
    setPendingDeleteContribution(null);
    try {
      await deleteContribution(contribution.id);
      setError("");
      await Promise.all([load(), refreshDetail()]);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text">Metas de ahorro</h2>
        <Button variant="primary" onClick={() => setForm({ editing: null })}>
          <Plus size={16} />
          Nueva meta
        </Button>
      </div>

      {error && <p className="mt-3 text-sm text-negative">{error}</p>}

      {loading ? (
        <p className="mt-6 text-sm text-text-muted">Cargando…</p>
      ) : goals.length === 0 ? (
        <div className="mt-6">
          <EmptyState message="Crea tu primera meta de ahorro para empezar." />
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {goals.map((goal) => (
            <li key={goal.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setDetail(goal)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setDetail(goal);
                  }
                }}
                className="group cursor-pointer rounded-2xl border border-border bg-surface p-5 shadow-soft transition hover:border-text-muted"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-text">
                    {goal.name}
                  </p>
                  <div className="flex shrink-0 gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setForm({ editing: goal });
                      }}
                      title="Editar"
                      className="rounded-md p-1.5 text-text-muted hover:bg-surface-2 hover:text-text"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDeleteGoal(goal);
                      }}
                      title="Eliminar"
                      className="rounded-md p-1.5 text-text-muted hover:bg-negative/10 hover:text-negative"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${barColor(
                      goal.completed
                    )}`}
                    style={{ width: `${Math.min(goal.percent, 100)}%` }}
                  />
                </div>

                <p className="mt-2 font-mono text-sm font-semibold text-text">
                  {formatMoney(goal.current_amount)} de{" "}
                  {formatMoney(goal.target_amount)}
                </p>

                <div className="mt-2 flex items-center justify-between gap-3">
                  {goal.completed ? (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-500">
                      <CircleCheck size={14} />
                      Meta cumplida
                    </span>
                  ) : (
                    <span className="text-xs text-text-muted">
                      {goal.percent}% completado
                    </span>
                  )}
                  {goal.deadline && !goal.completed && (
                    <span className="truncate text-xs text-text-muted">
                      {formatDateShort(goal.deadline)} ·{" "}
                      {daysRemainingLabel(goal.deadline)}
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {form && (
        <Modal
          title={form.editing ? "Editar meta" : "Nueva meta"}
          onClose={() => setForm(null)}
        >
          <GoalForm
            initial={form.editing}
            onSubmit={handleSaveGoal}
            onCancel={() => setForm(null)}
          />
        </Modal>
      )}

      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(null)} wide>
          <GoalDetail
            goal={detail}
            contributions={contributions}
            loading={detailLoading}
            onAddContribution={handleAddContribution}
            onDeleteContribution={setPendingDeleteContribution}
            onEdit={() => {
              setDetail(null);
              setForm({ editing: detail });
            }}
            onDelete={() => setPendingDeleteGoal(detail)}
          />
        </Modal>
      )}

      {pendingDeleteGoal && (
        <ConfirmDialog
          title={`¿Eliminar la meta "${pendingDeleteGoal.name}"?`}
          message="Se eliminará también su historial de aportes."
          onConfirm={confirmDeleteGoal}
          onCancel={() => setPendingDeleteGoal(null)}
        />
      )}

      {pendingDeleteContribution && (
        <ConfirmDialog
          title="¿Eliminar este aporte?"
          message="Esta acción no se puede deshacer."
          onConfirm={confirmDeleteContribution}
          onCancel={() => setPendingDeleteContribution(null)}
        />
      )}
    </div>
  );
}
