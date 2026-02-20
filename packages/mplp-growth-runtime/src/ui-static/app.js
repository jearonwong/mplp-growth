/**
 * Cockpit UI Logic
 * Handles API interaction and DOM updates.
 */

const API_BASE = "/api";

// --- API Client ---

async function fetchStatus() {
  const res = await fetch(`${API_BASE}/runner/status`);
  return res.json();
}

async function fetchQueue() {
  const res = await fetch(`${API_BASE}/queue`);
  return res.json();
}

async function approveItem(id) {
  const res = await fetch(`${API_BASE}/queue/${id}/approve`, { method: "POST" });
  return res.json();
}

async function rejectItem(id) {
  const res = await fetch(`${API_BASE}/queue/${id}/reject`, { method: "POST" });
  return res.json();
}

// --- UI Rendering ---

function updateStatusDot(isActive) {
  const dot = document.getElementById("runner-status-dot");
  const text = document.getElementById("runner-status-text");
  if (dot && text) {
    if (isActive) {
      dot.classList.add("active");
      text.innerText = "Runner Active";
    } else {
      dot.classList.remove("active");
      text.innerText = "Runner Idle";
    }
  }
}

function renderQueueItem(item) {
  const div = document.createElement("div");
  div.className = "queue-item";
  div.innerHTML = `
    <div class="queue-content">
      <div class="queue-meta">
        <span class="badge">${item.category.toUpperCase()}</span>
        <span>ID: ${item.confirm_id.substring(0, 8)}...</span>
      </div>
      <div class="queue-desc">Action Required</div>
      <div class="queue-data">${escapeHtml(JSON.stringify(item.data, null, 2))}</div>
    </div>
    <div class="actions">
      <button class="btn btn-success" onclick="app.handlers.approve('${item.confirm_id}')">Approve</button>
      <button class="btn btn-danger" onclick="app.handlers.reject('${item.confirm_id}')">Reject</button>
    </div>
  `;
  return div;
}

function escapeHtml(text) {
  if (!text) {
    return "";
  }
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// --- Page Logic ---

async function initDashboard() {
  console.log("Initializing Dashboard...");
  try {
    const status = await fetchStatus();
    updateStatusDot(status.enabled);

    // In v0.4.0 MVP, we don't have separate metrics endpoint yet.
    // dashboard.html just shows status for now.
    document.getElementById("last-tick").innerText = status.last_tick_at
      ? new Date(status.last_tick_at).toLocaleString()
      : "Never";
    document.getElementById("policy-level").innerText = status.policy_level;
  } catch (err) {
    console.error("Dashboard init failed", err);
  }
}

async function initQueue() {
  console.log("Initializing Queue...");
  try {
    const queue = await fetchQueue();
    const list = document.getElementById("queue-list");
    list.innerHTML = "";

    // Flatten categories
    // Response: { pending_count: N, categories: { outreach: [], publish: [], ... } }
    let hasItems = false;
    for (const [cat, items] of Object.entries(queue.categories)) {
      if (items.length > 0) {
        hasItems = true;
        // Add header?
        items.forEach((item) => {
          // Standardize item structure if needed, or pass category
          item.category = cat;
          list.appendChild(renderQueueItem(item));
        });
      }
    }

    if (!hasItems) {
      list.innerHTML =
        '<div class="card" style="text-align:center; color: var(--text-secondary)">No pending items. All caught up!</div>';
    }

    // Update badge in sidebar?
    // document.getElementById('queue-badge').innerText = queue.pending_count;
  } catch (err) {
    console.error("Queue init failed", err);
    document.getElementById("queue-list").innerHTML =
      `<div class="card" style="color: var(--danger-color)">Error loading queue: ${err.message}</div>`;
  }
}

// Global Handlers (for onclick attributes)
window.app = {
  handlers: {
    approve: async (id) => {
      if (!confirm("Approve this action?")) {
        return;
      }
      try {
        const res = await approveItem(id);
        if (res.ok) {
          alert("Approved!");
          location.reload();
        } else {
          alert("Error: " + JSON.stringify(res.error));
        }
      } catch (e) {
        alert(e.message);
      }
    },
    reject: async (id) => {
      if (!confirm("Reject this action?")) {
        return;
      }
      try {
        const res = await rejectItem(id);
        if (res.ok) {
          alert("Rejected.");
          location.reload();
        } else {
          alert("Error: " + JSON.stringify(res.error));
        }
      } catch (e) {
        alert(e.message);
      }
    },
  },
  initDashboard,
  initQueue,
};
