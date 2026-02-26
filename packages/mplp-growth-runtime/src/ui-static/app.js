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
  const res = await fetch(`${API_BASE}/queue/${id}/approve`, {
    method: "POST",
  });
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

  const roleBadge = `<span class="badge" style="background:var(--success-color); border: 1px solid var(--border-color); color: var(--bg-color)">Drafted by ${escapeHtml(item.drafted_by_role || "Auto")}</span>`;

  const redraftBadge = item.redrafted_by_role
    ? `<span class="badge" style="background:#e67e22; border: 1px solid var(--border-color); color: #fff; margin-left:4px;">→ Redrafted by ${escapeHtml(item.redrafted_by_role)} v${item.redraft_version || 1}</span>`
    : "";

  const statusColors = {
    pass: "var(--success-color)",
    fail: "var(--danger-color)",
  };
  const policyColor = statusColors[item.policy_check.status] || "var(--text-secondary)";
  const policyReasons = item.policy_check.reasons
    ? ` (${item.policy_check.reasons.join(", ")})`
    : "";

  const isChecked = app.state.selectedIds.has(item.confirm_id);

  div.innerHTML = `
    <div class="queue-content">
      <div class="queue-meta" style="display:flex; justify-content:space-between; width:100%;">
        <div style="display:flex; align-items:center; gap:8px;">
          <input type="checkbox" class="batch-select-checkbox" data-confirm-id="${item.confirm_id}" ${isChecked ? "checked" : ""} onchange="app.handlers.toggleItemSelect('${item.confirm_id}', this.checked)" style="cursor:pointer;" />
          <span class="badge">${item.category.toUpperCase()}</span>
          ${channelBadge}
          ${roleBadge}
          ${redraftBadge}
          <span style="margin-left:8px;font-weight:bold">${escapeHtml(item.title)}</span>
        </div>
        <span style="font-size:12px;color:var(--text-secondary)">${createdStr}</span>
      </div>
      
      <div class="queue-desc" style="margin-top:10px">
        <strong>Policy Check:</strong> <span style="color:${policyColor}">${item.policy_check.status.toUpperCase()}</span>
        <span style="font-size:12px">${escapeHtml(policyReasons)}</span>
      </div>
      
      ${
        item.category === "inbox" && item.interactions_count
          ? `
      <div style="margin-top:12px; padding:10px; background:var(--bg-color); border:1px solid var(--border-color); border-radius:4px;">
        <div style="font-size:13px; font-weight:bold; margin-bottom:8px; color:var(--text-secondary)">
          Inbox: ${item.interactions_count} interactions pending
        </div>
        <div id="inbox-summaries-${item.id}">
        ${(item.interaction_summaries || [])
          .slice(0, 2)
          .map((s) => {
            let badgeColor = "var(--text-secondary)";
            if (s.platform === "hn") {
              badgeColor = "#ff6600";
            }
            if (s.platform === "manual") {
              badgeColor = "var(--accent-color)";
            }

            let excerptHtml = escapeHtml(s.excerpt);
            if (s.source_ref?.startsWith("http")) {
              excerptHtml = `<a href="${escapeHtml(s.source_ref)}" target="_blank" style="color:var(--accent-color); text-decoration:none;">${excerptHtml}</a>`;
            }
            return `<div style="font-size:13px; margin-bottom:6px;">
            <span class="badge" style="background:${badgeColor}; margin-right:5px; padding:2px 6px; font-size:10px;">${s.platform.toUpperCase()}</span>
            <strong>@${escapeHtml(s.author)}:</strong> ${excerptHtml}
          </div>`;
          })
          .join("")}
        </div>

        ${
          item.interaction_summaries && item.interaction_summaries.length > 2
            ? `<div id="inbox-summaries-hidden-${item.id}" class="hidden">
           ${item.interaction_summaries
             .slice(2)
             .map((s) => {
               let badgeColor = "var(--text-secondary)";
               if (s.platform === "hn") {
                 badgeColor = "#ff6600";
               }
               if (s.platform === "manual") {
                 badgeColor = "var(--accent-color)";
               }
               let excerptHtml = escapeHtml(s.excerpt);
               if (s.source_ref?.startsWith("http")) {
                 excerptHtml = `<a href="${escapeHtml(s.source_ref)}" target="_blank" style="color:var(--accent-color); text-decoration:none;">${excerptHtml}</a>`;
               }
               return `<div style="font-size:13px; margin-bottom:6px;">
               <span class="badge" style="background:${badgeColor}; margin-right:5px; padding:2px 6px; font-size:10px;">${s.platform.toUpperCase()}</span>
               <strong>@${escapeHtml(s.author)}:</strong> ${excerptHtml}
             </div>`;
             })
             .join("")}
        </div>
        <div style="margin-top: 5px;"><a href="#" onclick="event.preventDefault(); app.handlers.toggleInboxSummaries('${item.id}')" id="inbox-toggle-${item.id}" style="font-size: 12px; color: var(--accent-color); text-decoration: none;">Show all (${item.interaction_summaries.length})</a></div>
        `
            : ""
        }
      </div>
      `
          : ""
      }

      ${(() => {
        const hasDraft = item.rationale_bullets && item.rationale_bullets.length > 0;
        const hasRedraft =
          item.redraft_rationale_bullets && item.redraft_rationale_bullets.length > 0;
        if (!hasDraft && !hasRedraft) {
          return "";
        }
        return `
      <div style="margin-top:10px; font-size:13px; color:var(--text-secondary); background: rgba(0,0,0,0.02); padding: 8px; border-radius: 4px;">
        ${
          hasDraft
            ? `
          <strong style="display:block; margin-bottom: 4px;">Why${hasRedraft ? " (draft)" : ""}:</strong>
          <ul style="margin: 0; padding-left: 20px;">
            ${item.rationale_bullets
              .slice(0, 3)
              .map((b) => `<li>${escapeHtml(b)}</li>`)
              .join("")}
          </ul>
        `
            : ""
        }
        ${
          hasRedraft
            ? `
          <strong style="display:block; margin-bottom: 4px; margin-top: ${hasDraft ? "8px" : "0"};">Why (redraft):</strong>
          <ul style="margin: 0; padding-left: 20px;">
            ${item.redraft_rationale_bullets
              .slice(0, 3)
              .map((b) => `<li>${escapeHtml(b)}</li>`)
              .join("")}
          </ul>
        `
            : ""
        }
      </div>
      `;
      })()}

      <details style="margin-top:10px; cursor:pointer;">
        <summary style="font-weight:bold; color:var(--accent-color);">Preview Content</summary>
        <div class="queue-data" style="margin-top:8px">
          ${
            item.interactions
              ? item.interactions
                  .map((i) => {
                    let badgeColor = "var(--text-secondary)";
                    if (i.platform === "hn") {
                      badgeColor = "#ff6600";
                    }
                    if (i.platform === "manual") {
                      badgeColor = "var(--accent-color)";
                    }
                    return `<div style="margin-bottom:8px; border-bottom:1px solid var(--border-color); padding-bottom:8px;">
               ${i.id ? `<label style="float:right; font-size:11px; cursor:pointer;"><input type="checkbox" class="interaction-checkbox" data-confirm-id="${item.confirm_id}" data-interaction-id="${i.id}" checked onchange="app.handlers.toggleInteractionSelect(this)" /> redraft</label>` : ""}
               <span class="badge" style="background:${badgeColor}; margin-right:5px;">${(i.platform || "unknown").toUpperCase()}</span>
               <strong>@${escapeHtml(i.author || "anonymous")}</strong><br/>
               <div style="margin-top:4px">${escapeHtml(i.content)}</div>
               <div style="margin-top:4px; color:var(--text-secondary); font-style:italic">Draft: "${escapeHtml(i.response)}"</div>
             </div>`;
                  })
                  .join("")
              : escapeHtml(item.preview)
          }
        </div>
      </details>
    </div>
    <div class="actions" style="display:flex; gap:8px;">
      <button class="btn btn-success" onclick='app.handlers.openImpactModal(${JSON.stringify({
        ...item,
        rationale_bullets: item.rationale_bullets ? item.rationale_bullets.slice(0, 3) : undefined,
      })
        .replace(/'/g, "&#39;")
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")})'>Approve</button>
      <button class="btn btn-danger" onclick="app.handlers.reject('${item.confirm_id}')">Reject</button>
      <button class="btn btn-outline" style="font-size:12px;" onclick="app.handlers.openRedraftModal('${item.confirm_id}')">Re-draft as…</button>
      ${item.asset_id ? `<button class="btn btn-primary" style="margin-left:auto; background:var(--bg-color); color:var(--text-primary); border:1px solid var(--border-color);" onclick='app.handlers.openEditModal(${JSON.stringify(item).replace(/'/g, "&#39;").replace(/</g, "\\u003c").replace(/>/g, "\\u003e")})'>Edit Draft</button>` : ""}
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
    const flatItems = [];

    // Flatten categories
    for (const [cat, items] of Object.entries(queue.categories)) {
      items.forEach((item) => {
        item.category = cat;
        // Build search index
        let searchText = [item.title, item.preview, item.category].join(" ");
        if (item.drafted_by_role) {
          searchText += ` ${item.drafted_by_role}`;
        }
        if (item.rationale_bullets) {
          searchText += ` ${item.rationale_bullets.join(" ")}`;
        }
        if (item.channel) {
          searchText += ` ${item.channel}`;
        }
        if (item.target_id) {
          searchText += ` ${item.target_id}`;
        }
        if (item.asset_id) {
          searchText += ` ${item.asset_id}`;
        }

        if (item.interaction_summaries) {
          searchText +=
            " " +
            item.interaction_summaries
              .map((s) => `${s.platform} ${s.author} ${s.excerpt} ${s.source_ref || ""}`)
              .join(" ");
        }
        if (item.interactions) {
          searchText +=
            " " +
            item.interactions
              .map((i) => `${i.platform} ${i.author} ${i.content} ${i.response}`)
              .join(" ");
        }
        item.__search_text = searchText.toLowerCase();
        flatItems.push(item);
      });
    }

    // Sort stable descending by created_at
    flatItems.sort((a, b) => {
      if (a.created_at && b.created_at) {
        return new Date(b.created_at) - new Date(a.created_at);
      }
      return 0;
    });

    app.state.queueItems = flatItems;
    renderQueueList();
  } catch (err) {
    console.error("Queue init failed", err);
    document.getElementById("queue-list").innerHTML =
      `<div class="card" style="color: var(--danger-color)">Error loading queue: ${err.message}</div>`;
  }
}

function renderQueueList() {
  const list = document.getElementById("queue-list");
  if (!list) {
    return;
  }
  list.innerHTML = "";

  const query = app.state.queueSearchQuery.toLowerCase().trim();
  const cat = app.state.queueCategory;

  let filtered = app.state.queueItems;

  if (cat !== "all") {
    filtered = filtered.filter((item) => item.category === cat);
  }

  if (query) {
    filtered = filtered.filter((item) => item.__search_text.includes(query));
  }

  if (filtered.length > 0) {
    filtered.forEach((item) => {
      list.appendChild(renderQueueItem(item));
    });
  } else {
    // Empty state
    let reason = query
      ? `No items match "${escapeHtml(query)}" in ${escapeHtml(cat)}.`
      : `No items in ${escapeHtml(cat)}.`;
    if (!query && cat === "all" && app.state.queueItems.length === 0) {
      reason = "No pending items. All caught up!";
    }
    list.innerHTML = `
        <div class="card" style="text-align:center; padding: 40px;">
           <h3 style="margin-top:0">No matching items</h3>
           <p style="color: var(--text-secondary); margin-bottom: 20px;">${reason}</p>
           <button class="btn btn-secondary" onclick="app.handlers.clearFilters()">Clear filters</button>
           <p style="color: var(--text-secondary); margin-top: 15px; font-size: 13px;">Tip: run Inbox/Outreach jobs from <a href="settings.html" style="color: var(--accent-color)">Settings &rarr; Job Dashboard</a></p>
        </div>
     `;
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

    try {
      const rRes = await fetch(`${API_BASE}/roles`);
      const roles = await rRes.json();
      const tbodyRoles = document.getElementById("roles-table-body");
      if (tbodyRoles) {
        tbodyRoles.innerHTML = "";
        roles.forEach((r) => {
          const tr = document.createElement("tr");
          tr.style.borderBottom = "1px solid var(--border-color)";
          tr.innerHTML = `
            <td style="padding: 10px; font-weight: bold; color: var(--text-primary)">${escapeHtml(r.name)} <br/><span class="badge" style="background:var(--success-color); border: 1px solid var(--border-color); color: var(--bg-color)">${escapeHtml(r.role_id)}</span></td>
            <td style="padding: 10px; color: var(--text-secondary); font-size: 13px;">${escapeHtml(r.capabilities.join(", "))}</td>
          `;
          tbodyRoles.appendChild(tr);
        });
      }
    } catch (e) {
      console.error("Failed to load roles", e);
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
            <input type="checkbox" ${jobData.enabled ? "checked" : ""} onchange="app.handlers.toggleJob('${jobId}', event)"/>
            <strong style="color: var(--text-primary)">${jobId}</strong>
          </label>
        `;

        // Schedule
        const tdCron = document.createElement("td");
        tdCron.style.padding = "10px";
        tdCron.style.fontFamily = "monospace";
        tdCron.innerText = jobData.schedule_cron || "manual";

        // Run as Role Dropdown
        const tdRole = document.createElement("td");
        tdRole.style.padding = "10px";
        const roles = ["Responder", "BDWriter", "Editor", "Analyst"];
        const optionsHtml = ["<option value=''>(Auto)</option>"]
          .concat(
            roles.map(
              (r) =>
                `<option value='${r}' ${jobData.run_as_role === r ? "selected" : ""}>${r}</option>`,
            ),
          )
          .join("");
        tdRole.innerHTML = `
          <select style="padding: 4px; font-size: 13px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-color); color: var(--text-primary);"
                  onchange="app.handlers.changeJobRole('${jobId}', event)">
            ${optionsHtml}
          </select>
        `;

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
          if (pStatus === "success") {
            sColor = "var(--success-color)";
          }
          if (pStatus === "failed") {
            sColor = "var(--danger-color)";
          }
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
          const tz = status.timezone ? ` (${status.timezone})` : " (UTC)";
          tdNext.innerText =
            date.toLocaleString("en-US", {
              weekday: "short",
              hour: "2-digit",
              minute: "2-digit",
            }) + tz;
        } else {
          tdNext.innerText = "unknown";
        }

        // Action
        const tdAction = document.createElement("td");
        tdAction.style.padding = "10px";
        tdAction.innerHTML = `
          <button class="btn btn-primary" style="padding: 4px 10px; font-size: 12px;" onclick="app.handlers.runJob('${jobId}')" ${isRunning ? "disabled" : ""}>
            Run Now
          </button>
        `;

        tr.appendChild(tdId);
        tr.appendChild(tdCron);
        tr.appendChild(tdRole);
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
  state: {
    queueItems: [],
    queueCategory: "all",
    queueSearchQuery: "",
    selectedInteractions: {},
    selectedIds: new Set(),
  },
  handlers: {
    onSearchInput: (event) => {
      app.state.queueSearchQuery = event.target.value;
      renderQueueList();
    },
    clearFilters: () => {
      app.state.queueSearchQuery = "";
      const searchInput = document.getElementById("queue-search");
      if (searchInput) {
        searchInput.value = "";
      }
      app.handlers.onCategoryChipClick("all");
    },
    onCategoryChipClick: (cat) => {
      app.state.queueCategory = cat;
      const chips = document.querySelectorAll("#queue-filter-chips .chip");
      chips.forEach((el) => {
        if (el.dataset.category === cat) {
          el.classList.add("active");
        } else {
          el.classList.remove("active");
        }
      });
      renderQueueList();
    },
    toggleInboxSummaries: (itemId) => {
      const hiddenDiv = document.getElementById(`inbox-summaries-hidden-${itemId}`);
      const toggleLnk = document.getElementById(`inbox-toggle-${itemId}`);
      if (hiddenDiv && toggleLnk) {
        if (hiddenDiv.classList.contains("hidden")) {
          hiddenDiv.classList.remove("hidden");
          toggleLnk.innerText = "Show less";
        } else {
          hiddenDiv.classList.add("hidden");
          toggleLnk.innerText = `Show all`;
        }
      }
    },
    closeImpactModal: () => {
      document.getElementById("impact-modal").classList.add("hidden");
    },
    openImpactModal: (item) => {
      document.getElementById("impact-modal").classList.remove("hidden");

      const badge = document.getElementById("impact-badge");
      badge.innerText = (item.impact_level || "low").toUpperCase();
      if (item.impact_level === "high") {
        badge.style.backgroundColor = "var(--danger-color)";
      } else if (item.impact_level === "medium") {
        badge.style.backgroundColor = "var(--warning-color)";
      } else {
        badge.style.backgroundColor = "var(--success-color)";
      }

      document.getElementById("impact-summary").innerText =
        item.impact_summary || "Safely execute task operations.";

      const ulChange = document.getElementById("impact-will-change");
      ulChange.innerHTML = "";

      const roleBadgeEl = document.getElementById("impact-role-badge");
      if (roleBadgeEl) {
        if (item.drafted_by_role) {
          roleBadgeEl.innerHTML = `<span class="badge" style="background:var(--success-color); border: 1px solid var(--border-color); color: var(--bg-color); margin-bottom: 15px; display: inline-block;">Drafted by ${escapeHtml(item.drafted_by_role)}</span>`;
        } else {
          roleBadgeEl.innerHTML = "";
        }
      }

      (item.will_change || []).forEach((val) => {
        const li = document.createElement("li");
        li.innerText = val;
        ulChange.appendChild(li);
      });
      if (!item.will_change || item.will_change.length === 0) {
        ulChange.innerHTML =
          '<li style="color:var(--text-secondary)">No significant state changes.</li>';
      }

      const ulNot = document.getElementById("impact-will-not");
      ulNot.innerHTML = "";
      (item.will_not_do || []).forEach((val) => {
        const li = document.createElement("li");
        li.innerText = val;
        ulNot.appendChild(li);
      });
      if (!item.will_not_do || item.will_not_do.length === 0) {
        ulNot.innerHTML = '<li style="color:var(--text-secondary)">N/A</li>';
      }

      // eslint-disable-next-line unicorn/prefer-add-event-listener
      document.getElementById("impact-confirm-btn").onclick = () =>
        app.handlers.confirmApprove(item.confirm_id);
    },
    confirmApprove: async (id) => {
      app.handlers.closeImpactModal();
      try {
        const res = await approveItem(id);
        if (res.ok) {
          alert("Approved!");
          location.reload();
        } else {
          alert(`Error: ${JSON.stringify(res.error)}`);
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
    closeEditModal: () => {
      document.getElementById("edit-modal").classList.add("hidden");
    },
    openRedraftModal: (confirmId) => {
      const modal = document.getElementById("redraft-modal");
      if (!modal) {
        return;
      }
      modal.classList.remove("hidden");
      document.getElementById("redraft-confirm-id").value = confirmId;
      document.getElementById("redraft-role-select").value = "";
      // Show selection count for inbox items
      const sel = app.state.selectedInteractions[confirmId];
      const countEl = document.getElementById("redraft-selection-count");
      if (countEl) {
        if (sel && sel.length > 0) {
          countEl.innerText = `Redraft ${sel.length} selected interaction(s)`;
          countEl.style.display = "block";
        } else {
          countEl.innerText = "Redraft all interactions";
          countEl.style.display = "block";
        }
      }
    },
    toggleInteractionSelect: (checkbox) => {
      const confirmId = checkbox.getAttribute("data-confirm-id");
      const interactionId = checkbox.getAttribute("data-interaction-id");
      if (!confirmId || !interactionId) {
        return;
      }

      if (!app.state.selectedInteractions[confirmId]) {
        // Initialize: collect all checkbox IDs for this confirm
        const allBoxes = document.querySelectorAll(
          `.interaction-checkbox[data-confirm-id="${confirmId}"]`,
        );
        app.state.selectedInteractions[confirmId] = Array.from(allBoxes).map((cb) =>
          cb.getAttribute("data-interaction-id"),
        );
      }

      const list = app.state.selectedInteractions[confirmId];
      if (checkbox.checked) {
        if (!list.includes(interactionId)) {
          list.push(interactionId);
        }
      } else {
        app.state.selectedInteractions[confirmId] = list.filter((id) => id !== interactionId);
      }
    },
    closeRedraftModal: () => {
      const modal = document.getElementById("redraft-modal");
      if (modal) {
        modal.classList.add("hidden");
      }
    },
    confirmRedraft: async () => {
      const confirmId = document.getElementById("redraft-confirm-id").value;
      const roleId = document.getElementById("redraft-role-select").value;
      if (!roleId) {
        const hint = document.getElementById("redraft-selection-count");
        if (hint) {
          hint.innerText = "⚠ Select a role to redraft.";
          hint.style.display = "block";
          hint.style.color = "var(--danger-color)";
        }
        return;
      }
      const btn = document.getElementById("redraft-submit-btn");
      btn.disabled = true;
      btn.innerText = "Re-drafting…";
      try {
        const body = { role_id: roleId };
        const sel = app.state.selectedInteractions[confirmId];
        if (sel && sel.length > 0) {
          body.interaction_ids = sel;
        }
        const res = await fetch(`${API_BASE}/queue/${confirmId}/redraft`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.ok) {
          app.handlers.closeRedraftModal();
          await initQueue();
        } else {
          alert(`Redraft failed: ${data.error}`);
        }
      } catch (e) {
        console.error("Redraft error", e);
        alert("API Error");
      } finally {
        btn.disabled = false;
        btn.innerText = "Confirm Redraft";
      }
    },
    openEditModal: (item) => {
      document.getElementById("edit-modal").classList.remove("hidden");
      document.getElementById("edit-asset-id").value = item.asset_id;

      // Extract draft text from item.interactions or item.preview
      let draftText = item.preview;
      if (item.interactions && item.interactions.length > 0) {
        draftText = item.interactions[0].response || draftText;
      }
      document.getElementById("edit-textarea").value = draftText;
    },
    saveEdit: async () => {
      const assetId = document.getElementById("edit-asset-id").value;
      const content = document.getElementById("edit-textarea").value;
      if (!content.trim()) {
        alert("Content cannot be empty");
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/assets/${assetId}/edit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        const data = await res.json();
        if (data.ok) {
          app.handlers.closeEditModal();
          // Ideally update local preview without reloading, but for safety reload queue
          await initQueue();
        } else {
          alert(`Save failed: ${data.error}`);
        }
      } catch (e) {
        console.error("Save error", e);
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
              [jobId]: { enabled: checked },
            },
          }),
        });
        if (res.ok) {
          await initSettings();
        } else {
          alert("Failed to update job status");
          event.target.checked = !checked;
        }
      } catch {
        alert("API Error");
        event.target.checked = !checked;
      }
    },
    changeJobRole: async (jobId, event) => {
      const roleVal = event.target.value;
      const originalVal = event.target.getAttribute("data-original") || "";

      try {
        const payload = {
          jobs: {
            [jobId]: {
              run_as_role: roleVal === "" ? null : roleVal,
            },
          },
        };

        const res = await fetch(`${API_BASE}/runner/config`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          event.target.setAttribute("data-original", roleVal);
          await initSettings();
        } else {
          alert("Failed to update job role");
          event.target.value = originalVal;
        }
      } catch {
        alert("API Error");
        event.target.value = originalVal;
      }
    },
    runJob: async (jobId) => {
      try {
        const res = await fetch(`${API_BASE}/runner/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task_id: jobId }),
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
            if (pollCount >= 3) {
              clearInterval(pollInterval);
            }
          }, 1000);
        } else {
          alert(`Failed to trigger ${jobId}: ${json.error}`);
        }
      } catch {
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
            statusSpan.innerText = `✅ ${json.message}`;
            statusSpan.style.color = "var(--success-color)";
          } else {
            statusSpan.innerText = `✅ Success! Context, ${json.created.channel_profiles} channels, ${json.created.outreach_targets} targets, ${json.created.templates} templates.`;
            statusSpan.style.color = "var(--success-color)";
          }
        } else {
          statusSpan.innerText = `❌ Error: ${json.error?.message || "Unknown error"}`;
          statusSpan.style.color = "var(--danger-color)";
        }
      } catch {
        statusSpan.innerText = "❌ API Error executing seed";
        statusSpan.style.color = "var(--danger-color)";
      } finally {
        btn.disabled = false;
      }
    },
    // --- Batch Actions (v0.7.2) ---
    toggleItemSelect: (confirmId, checked) => {
      if (checked) {
        app.state.selectedIds.add(confirmId);
      } else {
        app.state.selectedIds.delete(confirmId);
      }
      app.handlers.updateBatchToolbar();
    },
    updateBatchToolbar: () => {
      const toolbar = document.getElementById("batch-toolbar");
      const countEl = document.getElementById("batch-count");
      if (!toolbar || !countEl) {
        return;
      }
      const n = app.state.selectedIds.size;
      if (n > 0) {
        toolbar.style.display = "flex";
        countEl.innerText = `${n} selected`;
      } else {
        toolbar.style.display = "none";
      }
    },
    clearSelection: () => {
      app.state.selectedIds.clear();
      document.querySelectorAll(".batch-select-checkbox").forEach((cb) => {
        cb.checked = false;
      });
      app.handlers.updateBatchToolbar();
    },
    batchApprove: async () => {
      await app.handlers.executeBatchAction("approve");
    },
    batchReject: async () => {
      if (!confirm(`Reject ${app.state.selectedIds.size} item(s)?`)) {
        return;
      }
      await app.handlers.executeBatchAction("reject");
    },
    openBatchRedraftModal: () => {
      const modal = document.getElementById("batch-redraft-modal");
      if (modal) {
        modal.classList.remove("hidden");
        document.getElementById("batch-redraft-role").value = "";
      }
    },
    confirmBatchRedraft: async () => {
      const roleId = document.getElementById("batch-redraft-role").value;
      if (!roleId) {
        alert("Please select a role");
        return;
      }
      document.getElementById("batch-redraft-modal").classList.add("hidden");
      await app.handlers.executeBatchAction("redraft", roleId);
    },
    executeBatchAction: async (action, roleId) => {
      const ids = Array.from(app.state.selectedIds);
      if (ids.length === 0) {
        return;
      }

      const payload = { action, ids };
      if (roleId) {
        payload.role_id = roleId;
      }

      try {
        const res = await fetch(`${API_BASE}/queue/batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        app.handlers.showBatchResult(data);
        app.state.selectedIds.clear();
        await initQueue();
        app.handlers.updateBatchToolbar();
      } catch (e) {
        console.error("Batch error", e);
        alert("Batch action failed");
      }
    },
    showBatchResult: (data) => {
      const modal = document.getElementById("batch-result-modal");
      const body = document.getElementById("batch-result-body");
      if (!modal || !body) {
        return;
      }

      const p = data.processed || [];
      const s = data.skipped || [];
      const f = data.failed || [];

      let html = `<div style="margin-bottom:10px;">
        <strong>Action:</strong> ${escapeHtml(data.action || "?")}
        &nbsp;|&nbsp;
        <span style="color:var(--success-color)">✓ ${p.length} processed</span>
        &nbsp;|&nbsp;
        <span style="color:var(--text-secondary)">⊘ ${s.length} skipped</span>
        &nbsp;|&nbsp;
        <span style="color:var(--danger-color)">✗ ${f.length} failed</span>
      </div>`;

      if (f.length > 0) {
        html += `<div style="margin-top:8px;"><strong>Failed:</strong><ul style="padding-left:18px; margin:4px 0;">`;
        f.slice(0, 5).forEach((item) => {
          html += `<li style="color:var(--danger-color)">${escapeHtml(item.id)}: ${escapeHtml(item.error || "Unknown error")}</li>`;
        });
        if (f.length > 5) {
          html += `<li>...and ${f.length - 5} more</li>`;
        }
        html += `</ul></div>`;
      }

      if (s.length > 0) {
        html += `<div style="margin-top:8px;"><strong>Skipped:</strong><ul style="padding-left:18px; margin:4px 0;">`;
        s.slice(0, 5).forEach((item) => {
          html += `<li>${escapeHtml(item.id)}: ${escapeHtml(item.reason || "Unknown")}</li>`;
        });
        if (s.length > 5) {
          html += `<li>...and ${s.length - 5} more</li>`;
        }
        html += `</ul></div>`;
      }

      body.innerHTML = html;
      modal.classList.remove("hidden");
    },
  },
  initDashboard,
  initQueue,
  initGlobalHeader,
  initSettings,
};
