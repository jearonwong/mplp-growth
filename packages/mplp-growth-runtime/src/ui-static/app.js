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
      
      ${item.category === 'inbox' && item.interactions_count ? `
      <div style="margin-top:12px; padding:10px; background:var(--bg-color); border:1px solid var(--border-color); border-radius:4px;">
        <div style="font-size:13px; font-weight:bold; margin-bottom:8px; color:var(--text-secondary)">
          Inbox: ${item.interactions_count} interactions pending
        </div>
        ${(item.interaction_summaries || []).map(s => {
          let badgeColor = "var(--text-secondary)";
          if (s.platform === "hn") badgeColor = "#ff6600";
          if (s.platform === "manual") badgeColor = "var(--accent-color)";
          return \`<div style="font-size:13px; margin-bottom:6px;">
            <span class="badge" style="background:\${badgeColor}; margin-right:5px; padding:2px 6px; font-size:10px;">\${s.platform.toUpperCase()}</span>
            <strong>@\${escapeHtml(s.author)}:</strong> \${escapeHtml(s.excerpt)}
          </div>\`;
        }).join('')}
      </div>
      ` : ''}

      <details style="margin-top:10px; cursor:pointer;">
        <summary style="font-weight:bold; color:var(--accent-color);">Preview Content</summary>
        <div class="queue-data" style="margin-top:8px">
          ${item.interactions ? item.interactions.map(i => {
             let badgeColor = "var(--text-secondary)";
             if (i.platform === "hn") badgeColor = "#ff6600";
             if (i.platform === "manual") badgeColor = "var(--accent-color)";
             return `<div style="margin-bottom:8px; border-bottom:1px solid var(--border-color); padding-bottom:8px;">
               <span class="badge" style="background:${badgeColor}; margin-right:5px;">${(i.platform || "unknown").toUpperCase()}</span>
               <strong>@${escapeHtml(i.author || "anonymous")}</strong><br/>
               <div style="margin-top:4px">${escapeHtml(i.content)}</div>
               <div style="margin-top:4px; color:var(--text-secondary); font-style:italic">Draft: "${escapeHtml(i.response)}"</div>
             </div>`;
          }).join("") : escapeHtml(item.preview)}
        </div>
      </details>
    </div>
    <div class="actions">
      <button class="btn btn-success" onclick='app.handlers.openImpactModal(${JSON.stringify(item).replace(/'/g, "&#39;")})'>Approve</button>
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

    try {
      const cRes = await fetch(`${API_BASE}/config`);
      const configObj = await cRes.json();
      const hwEl = document.getElementById("hn-keywords-display");
      if (hwEl) {
        hwEl.innerText = (configObj.hn_keywords || []).join(", ");
      }
    } catch (e) {
      console.error("Failed to load config", e);
    }

    const policyEl = document.getElementById("policy-display");
    if (policyEl) {
      policyEl.innerHTML = `Current Policy: <span style="color: var(--accent-color)">${status.policy_level.toUpperCase()}</span>`;
    }

    const toggle = document.getElementById("auto-publish-toggle");
    if (toggle) {
      toggle.checked = !!status.auto_publish;
      toggle.disabled = status.policy_level !== "aggressive";
    }
    const tbody = document.getElementById("jobs-table-body");
    if (tbody && status.jobs) {
      tbody.innerHTML = "";
      for (const [jobId, jobData] of Object.entries(status.jobs)) {
        const tr = document.createElement("tr");
        tr.style.borderBottom = "1px solid var(--border-color)";

        // Job ID + Toggle
        const tdId = document.createElement("td");
        tdId.style.padding = "10px";
        tdId.innerHTML = `
          <label style="display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" ${jobData.enabled ? 'checked' : ''} onchange="app.handlers.toggleJob('${jobId}', event)"/>
            <strong style="color: var(--text-primary)">${jobId}</strong>
          </label>
        `;

        // Schedule
        const tdCron = document.createElement("td");
        tdCron.style.padding = "10px";
        tdCron.style.fontFamily = "monospace";
        tdCron.innerText = jobData.schedule_cron || "manual";

        // Status
        const tdStatus = document.createElement("td");
        tdStatus.style.padding = "10px";
        const isRunning = status.is_running && status.active_task === jobId;
        let pStatus = "idle";
        let sColor = "var(--text-secondary)";
        if (isRunning) {
          pStatus = "running";
          sColor = "var(--warning-color)";
        } else if (jobData.last_status) {
          pStatus = jobData.last_status;
          if (pStatus === 'success') sColor = "var(--success-color)";
          if (pStatus === 'failed') sColor = "var(--danger-color)";
        }
        tdStatus.innerHTML = `<span style="color: ${sColor}">${pStatus}</span>`;
        if (jobData.last_error) {
           tdStatus.innerHTML += `<div style="font-size: 11px; color: var(--danger-color); margin-top: 4px;">${jobData.last_error}</div>`;
        }

        // Next Run
        const tdNext = document.createElement("td");
        tdNext.style.padding = "10px";
        tdNext.style.fontSize = "12px";
        if (!jobData.enabled) {
          tdNext.innerText = "disabled";
          tdNext.style.color = "var(--text-secondary)";
        } else if (jobData.next_run_at) {
          const date = new Date(jobData.next_run_at);
          // Show format "Mon 10:00" or similar
          const tz = status.timezone ? ` (${status.timezone})` : ' (UTC)';
          tdNext.innerText = date.toLocaleString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) + tz;
        } else {
          tdNext.innerText = "unknown";
        }

        // Action
        const tdAction = document.createElement("td");
        tdAction.style.padding = "10px";
        tdAction.innerHTML = `
          <button class="btn btn-primary" style="padding: 4px 10px; font-size: 12px;" onclick="app.handlers.runJob('${jobId}')" ${isRunning ? 'disabled' : ''}>
            Run Now
          </button>
        `;

        tr.appendChild(tdId);
        tr.appendChild(tdCron);
        tr.appendChild(tdStatus);
        tr.appendChild(tdNext);
        tr.appendChild(tdAction);
        tbody.appendChild(tr);
      }
    }
  } catch (err) {
    console.error("Failed to load runner status for settings", err);
  }
}

// Global Handlers (for onclick attributes)
window.app = {
  handlers: {
    closeImpactModal: () => {
      document.getElementById('impact-modal').classList.add('hidden');
    },
    openImpactModal: (item) => {
      document.getElementById('impact-modal').classList.remove('hidden');
      
      const badge = document.getElementById('impact-badge');
      badge.innerText = (item.impact_level || 'low').toUpperCase();
      if (item.impact_level === 'high') badge.style.backgroundColor = 'var(--danger-color)';
      else if (item.impact_level === 'medium') badge.style.backgroundColor = 'var(--warning-color)';
      else badge.style.backgroundColor = 'var(--success-color)';
      
      document.getElementById('impact-summary').innerText = item.impact_summary || 'Safely execute task operations.';
      
      const ulChange = document.getElementById('impact-will-change');
      ulChange.innerHTML = '';
      (item.will_change || []).forEach(val => {
         const li = document.createElement('li');
         li.innerText = val;
         ulChange.appendChild(li);
      });
      if (!item.will_change || item.will_change.length === 0) ulChange.innerHTML = '<li style="color:var(--text-secondary)">No significant state changes.</li>';

      const ulNot = document.getElementById('impact-will-not');
      ulNot.innerHTML = '';
      (item.will_not_do || []).forEach(val => {
         const li = document.createElement('li');
         li.innerText = val;
         ulNot.appendChild(li);
      });
      if (!item.will_not_do || item.will_not_do.length === 0) ulNot.innerHTML = '<li style="color:var(--text-secondary)">N/A</li>';

      document.getElementById('impact-confirm-btn').onclick = () => app.handlers.confirmApprove(item.confirm_id);
    },
    confirmApprove: async (id) => {
      app.handlers.closeImpactModal();
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
    toggleJob: async (jobId, event) => {
      const checked = event.target.checked;
      try {
        const res = await fetch(`${API_BASE}/runner/config`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobs: {
              [jobId]: { enabled: checked }
            }
          })
        });
        if (res.ok) {
          await initSettings();
        } else {
          alert("Failed to update job status");
          event.target.checked = !checked;
        }
      } catch (err) {
        alert("API Error");
        event.target.checked = !checked;
      }
    },
    runJob: async (jobId) => {
      try {
        const res = await fetch(`${API_BASE}/runner/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task_id: jobId })
        });
        const json = await res.json();
        
        if (res.status === 409) {
          alert(`Task ${jobId} is already running.`);
          return;
        }
        
        if (res.ok) {
          // Immediately update status, then poll 3 times over 3 seconds to catch completion
          await initSettings(); 
          let pollCount = 0;
          const pollInterval = setInterval(async () => {
             await initSettings();
             pollCount++;
             if (pollCount >= 3) clearInterval(pollInterval);
          }, 1000);
        } else {
          alert(`Failed to trigger ${jobId}: ${json.error}`);
        }
      } catch(err) {
        alert("API Error executing job");
      }
    },
    seedData: async (event) => {
      const btn = event.target;
      const statusSpan = document.getElementById("seed-status");
      btn.disabled = true;
      statusSpan.innerText = "Seeding...";
      statusSpan.style.color = "var(--text-secondary)";
      
      try {
        const res = await fetch(`${API_BASE}/admin/seed`, { method: "POST" });
        const json = await res.json();
        
        if (json.ok) {
          if (json.already_seeded) {
            statusSpan.innerText = "✅ " + json.message;
            statusSpan.style.color = "var(--success-color)";
          } else {
            statusSpan.innerText = `✅ Success! Context, ${json.created.channel_profiles} channels, ${json.created.outreach_targets} targets, ${json.created.templates} templates.`;
            statusSpan.style.color = "var(--success-color)";
          }
        } else {
          statusSpan.innerText = "❌ Error: " + (json.error?.message || "Unknown error");
          statusSpan.style.color = "var(--danger-color)";
        }
      } catch (err) {
        statusSpan.innerText = "❌ API Error executing seed";
        statusSpan.style.color = "var(--danger-color)";
      } finally {
        btn.disabled = false;
      }
    }
  },
  initDashboard,
  initQueue,
  initGlobalHeader,
  initSettings,
};
