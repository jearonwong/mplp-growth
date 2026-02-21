# Release Notes: v0.5.1 (App Experience Patch)

**Release Date**: 2026-02-21

This patch release focuses on improving the "App-like" experience for non-engineering users, reducing the need for CLI commands, and optimizing the Inbox review workflow.

## 🌟 What Shipped (The 3 Polish Items)

1. **P1: Configurable HackerNews Keywords**  
   You no longer need to modify code to change what HackerNews mentions are ingested.
   - Set the `HN_KEYWORDS` environment variable (e.g., `HN_KEYWORDS=startup,saas,ai`).
   - Or, create a `./data/config.json` file containing `{"hn_keywords": ["..."]}`.
   - The current active keywords are now visible read-only in the **Settings** UI.

2. **P2: One-Click UI Data Initialization ("Seed")**  
   For a brand new installation, you no longer need to run `docker exec` to seed ground truth targets and templates. Instead, simply navigate to the **Settings** tab and click the **🌱 Seed Now** button. This action is idempotent and completely safe to run multiple times.

3. **P3: Inbox Card First-Screen Summaries**  
   The **Queue** UI now renders a high-level summary directly on the Inbox card surface. It shows the total `pending interactions count` and excerpts of the first 2 interactions (with platform badges and author names). This drastically reduces the "click depth" required to understand what is waiting in the inbox.

## 🛡 Verification Steps Executed

1. **Config Validation**: `loadConfig()` successfully prioritizes ENV overrides over `config.json` fallbacks.
2. **Seed Idempotency**: `POST /api/admin/seed` confirmed to return "Already seeded" without duplicate object creation if a Domain Context already exists.
3. **Queue Shape**: Inbox QueueItem payloads contain new `interactions_count` and max-2 `interaction_summaries` arrays safely generated without JS execution context.
