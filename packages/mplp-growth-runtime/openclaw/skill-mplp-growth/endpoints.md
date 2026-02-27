# MPLP Growth Runtime — API Endpoints

Base URL: `http://localhost:3000`

---

## POST /api/ops/daily-run

Composite daily workflow: execute inbox → fetch queue → optional batch.

**Request**

```json
{
  "auto_approve": false,
  "redraft_role_id": "Editor"
}
```

**Response**

```json
{
  "ok": true,
  "inbox_result": { "ok": true, "outputs": "..." },
  "queue_count": 3,
  "batch_result": null
}
```

---

## POST /api/queue/batch

Batch queue actions with failure isolation.

**Request**

```json
{
  "action": "approve",
  "ids": ["confirm-id-1", "confirm-id-2"],
  "role_id": "Editor",
  "interaction_ids_map": {
    "confirm-id-1": ["interaction-a"]
  }
}
```

**Response**

```json
{
  "ok": true,
  "action": "approve",
  "processed": [{ "id": "confirm-id-1", "status": "ok" }],
  "skipped": [],
  "failed": []
}
```

---

## POST /api/runner/config

Update runner configuration (jobs, roles, quiet hours).

```json
{
  "jobs": {
    "inbox": {
      "run_as_role": "Responder",
      "enabled": true
    }
  }
}
```

---

## POST /api/inbox/manual

Push a manual signal for processing.

```json
{
  "content": "Interesting discussion on HN about...",
  "author_handle": "@founder",
  "source_ref": "manual://note/1"
}
```
