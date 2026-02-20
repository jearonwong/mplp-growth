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

async function initGlobalHeader() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    const health = await res.json();
    const badge = document.getElementById("global-header-stats");
    if (!badge) {
      return;
    }

    const h = Math.floor(health.uptime / 3600);
    const m = Math.floor((health.uptime % 3600) / 60);
    const s = Math.floor(health.uptime % 60);
    const uptimeStr = `${h}h ${m}m ${s}s`;

    const runnerText = health.runner_enabled ? "Runner ON" : "Runner OFF";
    const dotClass = health.runner_enabled ? "dot active" : "dot";

    badge.innerHTML = `
      <span style="color: var(--text-secondary)">v${health.version}</span> &nbsp;|&nbsp;
      <span style="color: var(--accent-color)">Policy: ${health.policy_level}</span> &nbsp;|&nbsp;
      <span class="${dotClass}"></span> <span>${runnerText}</span> &nbsp;|&nbsp;
      <span style="color: var(--text-secondary)">Uptime: ${uptimeStr}</span>
    `;
  } catch (err) {
    console.error("Failed to load health for header", err);
  }
}

function renderQueueItem(item) {
  const div = document.createElement("div");
  div.className = "queue-item";

  const createdStr = item.created_at ? new Date(item.created_at).toLocaleString() : "";
  const channelBadge = item.channel
    ? `<span class="badge" style="background:var(--accent-color)">${item.channel}</span>`
    : "";

  const statusColors = { pass: "var(--success-color)", fail: "var(--danger-color)" };
  const policyColor = statusColors[item.policy_check.status] || "var(--text-secondary)";
  const policyReasons = item.policy_check.reasons
    ? ` (${item.policy_check.reasons.join(", ")})`
    : "";

  div.innerHTML = `
    <div class="queue-content">
      <div class="queue-meta" style="display:flex; justify-content:space-between; width:100%;">
        <div>
          <span class="badge">${item.category.toUpperCase()}</span>
          ${channelBadge}
          <span style="margin-left:8px;font-weight:bold">${escapeHtml(item.title)}</span>
        </div>
        <span style="font-size:12px;color:var(--text-secondary)">${createdStr}</span>
      </div>
      
      <div class="queue-desc" style="margin-top:10px">
        <strong>Policy Check:</strong> <span style="color:${policyColor}">${item.policy_check.status.toUpperCase()}</span>
        <span style="font-size:12px">${escapeHtml(policyReasons)}</span>
      </div>
      
      <details style="margin-top:10px; cursor:pointer;">
        <summary style="font-weight:bold; color:var(--accent-color);">Preview Content</summary>
        <div class="queue-data" style="margin-top:8px">${escapeHtml(item.preview)}</div>
      </details>
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
    // Dot updated by initGlobalHeader instead

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

async function initSettings() {
  try {
    const res = await fetch(`${API_BASE}/runner/status`);
    const status = await res.json();

    const policyEl = document.getElementById("policy-display");
    if (policyEl) {
      policyEl.innerHTML = `Current Policy: <span style="color: var(--accent-color)">${status.policy_level.toUpperCase()}</span>`;
    }

    const toggle = document.getElementById("auto-publish-toggle");
    if (toggle) {
      toggle.checked = !!status.auto_publish;
      toggle.disabled = status.policy_level !== "aggressive";
    }
  } catch (err) {
    console.error("Failed to load runner status for settings", err);
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
          await initQueue(); // Changed from location.reload()
        } else {
          alert("Reject failed");
        }
      } catch (err) {
        console.error(err);
        alert("API Error");
      }
    },
    toggleAutoPublish: async (event) => {
      const checked = event.target.checked;
      try {
        const res = await fetch(`${API_BASE}/runner/config`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ auto_publish: checked }),
        });
        if (res.ok) {
          if (typeof initSettings === "function") {
            await initSettings();
          }
        } else {
          alert("Failed to update Runner Config");
          event.target.checked = !checked;
        }
      } catch (err) {
        console.error("Error toggling auto_publish", err);
        alert("API Error");
        event.target.checked = !checked;
      }
    },
  },
  initDashboard,
  initQueue,
  initGlobalHeader,
  initSettings,
};
