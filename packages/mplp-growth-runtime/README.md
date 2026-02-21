# MPLP Growth Copilot

**Local-first Founder 7×24 Ops Cockpit for marketing, outreach, and community signal management.**

## Who It's For

Solo founders and one-person teams running community + outreach loops. The system drafts work automatically — you approve what matters.

## Key Idea

**Queue-first workflow**: Signals come in (HN mentions, manual tips), the system generates draft responses and outreach, and everything lands in a review queue. Nothing goes out without your explicit approval.

## Safety Defaults

| Setting          | Default  | Why                                          |
| ---------------- | -------- | -------------------------------------------- |
| Runner           | **OFF**  | No background jobs until you enable them     |
| Policy Level     | **safe** | Conservative content generation              |
| Auto-publish     | **OFF**  | No content published without approval        |
| External sending | **None** | Export-pack only — no email/social API calls |

## 3-Minute Docker Quickstart

```bash
# 1. Start the container
docker compose up -d --build

# 2. Open the Cockpit
open http://localhost:3000

# 3. Verify it's running
curl -s http://localhost:3000/api/health

# 4. Initialize Data (first run only)
# Open http://localhost:3000 -> Settings -> click "🌱 Seed Now"
```

## Founder Daily Flow (4 Steps)

1. **Pull signals** — Manual push via API or HN auto-pull (when Runner is ON)
2. **Review inbox** — Open Queue → Inbox tab → review interactions with platform badges
3. **Approve outreach** — Impact modal shows what will change and what will NOT happen → confirm
4. **Weekly review** — `cli review --since-last` → delta report with action suggestions

## Commands & API

### CLI (inside container)

| Command                                             | Description                       |
| --------------------------------------------------- | --------------------------------- |
| `seed`                                              | Initialize ground truth data      |
| `brief`                                             | Generate weekly planning brief    |
| `create <type>`                                     | Create content draft              |
| `inbox`                                             | Process incoming interactions     |
| `outreach --segment <type> --channel <ch>`          | Generate outreach drafts          |
| `approve --list` / `approve <id>` / `approve --all` | Manage approvals                  |
| `review --since-last`                               | Weekly retrospective with delta   |
| `serve`                                             | Start Cockpit (API + Runner + UI) |

### UI Pages

| Page      | URL                                    |
| --------- | -------------------------------------- |
| Dashboard | `http://localhost:3000`                |
| Queue     | `http://localhost:3000` (Queue tab)    |
| Settings  | `http://localhost:3000` (Settings tab) |

### API Endpoints

| Method | Endpoint                 | Description                    |
| ------ | ------------------------ | ------------------------------ |
| GET    | `/api/health`            | Version, uptime, policy status |
| GET    | `/api/queue`             | Pending approvals by category  |
| GET    | `/api/runner/status`     | Job schedules and run history  |
| POST   | `/api/inbox/manual`      | Push a signal manually         |
| POST   | `/api/runner/execute`    | Run a job manually             |
| POST   | `/api/queue/:id/approve` | Approve a queue item           |
| POST   | `/api/queue/:id/reject`  | Reject a queue item            |

## Data & Backup

Data lives in `./data` (bind-mounted to `/data` inside the container).

```bash
# Backup
tar czf mplp-backup-$(date +%Y%m%d).tar.gz ./data

# Restore
tar xzf mplp-backup-YYYYMMDD.tar.gz
docker compose restart
```

## Configuration via Environment

Override defaults in `docker-compose.yml` or at deploy time:

```bash
RUNNER_ENABLED=true POLICY_LEVEL=standard docker compose up -d
```

| Variable         | Default                    | Options                            |
| ---------------- | -------------------------- | ---------------------------------- |
| `RUNNER_ENABLED` | `false`                    | `true` / `false`                   |
| `POLICY_LEVEL`   | `safe`                     | `safe` / `standard` / `aggressive` |
| `AUTO_PUBLISH`   | `false`                    | `true` / `false`                   |
| `HN_KEYWORDS`    | `opensource,mplp,openclaw` | Comma-separated strings            |

_Note: You can also configure HackerNews keywords persistently by creating `./data/config.json` with `{"hn_keywords": ["..."]}`._

## License

Apache-2.0
