# MPLP Growth Copilot — Demo Guide

> **Time to complete**: ~5 minutes  
> **Prerequisites**: Node.js ≥18, npm

---

## 1. Preconditions

```bash
# Check Node version
node --version  # Must be ≥18

# Navigate to package
cd packages/mplp-growth-runtime

# Install dependencies (if not already)
npm install
```

---

## 2. One-Command Setup

Initialize the seed data (Brand, Channels, Audiences):

```bash
npm run seed
```

**Expected output:**
```
🌱 MPLP Growth Copilot — Phase 2 Seed Data

📁 VSL initialized at: ~/.openclaw/mplp-growth
  ✅ Context: <uuid>
  ✅ ChannelProfiles: x, linkedin, medium, hn, youtube (5)
  ...
```

---

## 3. Run the MVP Loop

### Step A: Weekly Brief

```bash
npm run cli brief
```

**Expected output:**
```
## 📅 Weekly Brief

Theme: ...
Week: ...

**Plan**: `abc12345...`
**Trace**: `def67890...`

**Next Actions**:
- `/create thread` — Generate a thread
```

---

### Step B: Create Content

```bash
npm run cli create thread
```

**Expected output:**
```
## ✍️ Content Created: thread

Asset: MPLP thread for developers
Status: reviewed
Variants: x, linkedin, medium

**Asset ID**: `<copy-this-uuid>`
**Plan**: `abc12345...`

**Next Actions**:
- `/publish <asset_id> x` — Publish to X
```

**Copy the Asset ID from output.**

---

### Step C: Publish

```bash
npm run cli publish <paste-asset-id-here> x
```

**Expected output:**
```
## 🚀 Published to x

Asset: <asset_id>
Status: published
Export: ~/.openclaw/mplp-growth/exports/<run_id>/x.md

**Next Actions**:
- Open `~/.openclaw/mplp-growth/exports/<run_id>/x.md` and copy content
```

---

## 4. Inspect Artifacts

### Export Pack (Paste-Ready Content)

```bash
# Find most recent export
ls -la ~/.openclaw/mplp-growth/exports/

# View export
cat ~/.openclaw/mplp-growth/exports/<run_id>/x.md
```

### Events Log

```bash
# View recent events
tail -20 ~/.openclaw/mplp-growth/vsl/events.ndjson

# Count event types
grep -c '"event_family":"graph_update"' ~/.openclaw/mplp-growth/vsl/events.ndjson
grep -c '"event_family":"pipeline_stage"' ~/.openclaw/mplp-growth/vsl/events.ndjson
```

### VSL Objects

```bash
# List all stored objects
ls ~/.openclaw/mplp-growth/vsl/objects/

# View a specific Plan
cat ~/.openclaw/mplp-growth/vsl/objects/Plan/*.json | head -50
```

---

## 5. What to Screenshot

For MPLP marketing/demo:

1. **CLI output** showing Plan/Trace/Confirm IDs
2. **Export file** content (paste-ready markdown)
3. **Events log** showing GraphUpdateEvent + PipelineStageEvent counts
4. **VSL objects** directory structure

---

## 6. Run Tests

Verify everything works:

```bash
npm run test:all
```

**Expected:**
```
 ✓ gates.test.ts              (18 tests)
 ✓ phase2-gates.test.ts        (7 tests)
 ✓ phase3-workflows.test.ts   (10 tests)
 ✓ phase4-commands.test.ts     (8 tests)
 ✓ phase5-demo-readme.test.ts  (3 tests)

 Tests: 46 passed (46)
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "No context found" | Run `npm run seed` first |
| "Asset not found" | Use correct asset_id from `/create` output |
| Permission denied | Check `~/.openclaw/mplp-growth/` permissions |

---

## Clean Reset

To start fresh:

```bash
rm -rf ~/.openclaw/mplp-growth
npm run seed
```
