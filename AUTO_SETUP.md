# Trading System — Auto-Scan Setup Guide

## Option 1: Windows Task Scheduler (Laptop Sleep Mode)

Your laptop can be in **sleep/hibernate** — it will wake up automatically to run scans.

### Setup Steps:

```bash
# 1. Create scheduled tasks (run once)
node setup-scheduler.js

# 2. Configure tasks to wake computer
# Open Task Scheduler → find "Zerodha Morning Scan", "Zerodha Noon Scan", etc.
# Right-click → Properties → Conditions → Check "Wake the computer to run this task"
# Also check "Start only if on AC power" to prevent battery drain
```

### Schedule Times:
| Task | Time | Why |
|------|------|-----|
| Morning Scan | 9:00 AM | Before market opens (9:15 AM) |
| Noon Scan | 12:30 PM | Mid-session check |
| Evening Scan | 3:00 PM | Before market close (3:30 PM) |

### View/Delete Tasks:
```bash
# List all tasks
schtasks /query /tn "Zerodha*" /v

# Delete a task
schtasks /delete /tn "Zerodha Morning Scan" /f
```

---

## Option 2: Keep Laptop Running (Simpler)

If your college has charging spots in classrooms/labs:

```bash
# Start before leaving
npm run dev -- --auto

# It will keep scanning until you stop it (Ctrl+C) or close the terminal
```

**Power settings:**
- Control Panel → Power Options → "Prevent automatic sleeping"
- Or set to never sleep when plugged in

---

## Option 3: Cloud VPS (No Laptop Needed)

Run on a cheap cloud server (₹200-500/month):
- **AWS Free Tier** (1 year free)
- **DigitalOcean Droplet** ($5/month)
- **Raspberry Pi at home** (if you have one)

---

## Recommended: Option 1 (Task Scheduler)

✅ Laptop stays off/sleep most of the day  
✅ Scans run automatically at key times  
✅ Alerts sent to your Telegram  
✅ No battery drain

**Next Step:** Run `node setup-scheduler.js` then configure Wake settings in Task Scheduler.
