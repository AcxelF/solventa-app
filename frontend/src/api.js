const API_BASE = "/api";

function buildQuery(params) {
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null && value !== ""
  );
  if (!entries.length) return "";
  const qs = entries
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    )
    .join("&");
  return `?${qs}`;
}

async function handleResponse(res) {
  if (!res.ok) {
    let message = `Error del servidor (${res.status})`;
    try {
      const data = await res.json();
      if (data && data.error) message = data.error;
    } catch {
      // el cuerpo no era JSON
    }
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ---- Cuentas ----
export async function fetchAccounts() {
  const res = await fetch(`${API_BASE}/accounts`);
  return handleResponse(res);
}

export async function createAccount(payload) {
  const res = await fetch(`${API_BASE}/accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function updateAccount(id, payload) {
  const res = await fetch(`${API_BASE}/accounts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function deleteAccount(id) {
  const res = await fetch(`${API_BASE}/accounts/${id}`, {
    method: "DELETE",
  });
  return handleResponse(res);
}

// ---- Categorías ----
export async function fetchCategories({ type } = {}) {
  const res = await fetch(`${API_BASE}/categories${buildQuery({ type })}`);
  return handleResponse(res);
}

export async function createCategory(payload) {
  const res = await fetch(`${API_BASE}/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function updateCategory(id, payload) {
  const res = await fetch(`${API_BASE}/categories/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function deleteCategory(id) {
  const res = await fetch(`${API_BASE}/categories/${id}`, {
    method: "DELETE",
  });
  return handleResponse(res);
}

// ---- Transacciones ----
export async function fetchTransactions(filters = {}) {
  const res = await fetch(`${API_BASE}/transactions${buildQuery(filters)}`);
  return handleResponse(res);
}

export async function createTransaction(payload) {
  const res = await fetch(`${API_BASE}/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function updateTransaction(id, payload) {
  const res = await fetch(`${API_BASE}/transactions/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function deleteTransaction(id) {
  const res = await fetch(`${API_BASE}/transactions/${id}`, {
    method: "DELETE",
  });
  return handleResponse(res);
}

// ---- Resumen ----
export async function fetchSummary({ month, account_id } = {}) {
  const res = await fetch(
    `${API_BASE}/summary${buildQuery({ month, account_id })}`
  );
  return handleResponse(res);
}

// ---- Widgets del dashboard ----
export async function fetchDashboardWidgets({ month } = {}) {
  const res = await fetch(
    `${API_BASE}/dashboard/widgets${buildQuery({ month })}`
  );
  return handleResponse(res);
}

// ---- Presupuestos ----
export async function fetchBudgets({ month } = {}) {
  const res = await fetch(`${API_BASE}/budgets${buildQuery({ month })}`);
  return handleResponse(res);
}

export async function createBudget(payload) {
  const res = await fetch(`${API_BASE}/budgets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function updateBudget(id, payload) {
  const res = await fetch(`${API_BASE}/budgets/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function deleteBudget(id) {
  const res = await fetch(`${API_BASE}/budgets/${id}`, {
    method: "DELETE",
  });
  return handleResponse(res);
}

// ---- Metas de ahorro ----
export async function fetchGoals() {
  const res = await fetch(`${API_BASE}/goals`);
  return handleResponse(res);
}

export async function fetchGoal(id) {
  const res = await fetch(`${API_BASE}/goals/${id}`);
  return handleResponse(res);
}

export async function createGoal(payload) {
  const res = await fetch(`${API_BASE}/goals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function updateGoal(id, payload) {
  const res = await fetch(`${API_BASE}/goals/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function deleteGoal(id) {
  const res = await fetch(`${API_BASE}/goals/${id}`, {
    method: "DELETE",
  });
  return handleResponse(res);
}

export async function fetchContributions(goalId) {
  const res = await fetch(`${API_BASE}/goals/${goalId}/contributions`);
  return handleResponse(res);
}

export async function addContribution(goalId, payload) {
  const res = await fetch(`${API_BASE}/goals/${goalId}/contributions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function deleteContribution(id) {
  const res = await fetch(`${API_BASE}/contributions/${id}`, {
    method: "DELETE",
  });
  return handleResponse(res);
}

// ---- Tarjetas de crédito ----
export async function fetchCreditCards() {
  const res = await fetch(`${API_BASE}/credit-cards`);
  return handleResponse(res);
}

export async function fetchCreditCard(id) {
  const res = await fetch(`${API_BASE}/credit-cards/${id}`);
  return handleResponse(res);
}

export async function createCreditCard(payload) {
  const res = await fetch(`${API_BASE}/credit-cards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function updateCreditCard(id, payload) {
  const res = await fetch(`${API_BASE}/credit-cards/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function deleteCreditCard(id) {
  const res = await fetch(`${API_BASE}/credit-cards/${id}`, {
    method: "DELETE",
  });
  return handleResponse(res);
}
