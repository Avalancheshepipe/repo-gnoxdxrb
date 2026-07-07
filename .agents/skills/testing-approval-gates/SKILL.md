---
name: testing-approval-gates
description: Test Julow's Approval Gates (per-workspace rules gating agent write actions) end-to-end. Use when verifying approval rules, pending requests, badge/dialog UI, or agent gating behavior.
---

# Testing Approval Gates in Julow

## Environment setup
1. Stack: `docker compose up -d` (postgres :5432 julow/julow, redis :6379), then run three processes: `npm run dev` (:3000), `npm run worker` (BullMQ), `npm run ws` (:1234). All three must be running — gating happens in the worker.
2. AI runs need `AI_GATEWAY_API_KEY` in `.env` (Vercel AI Gateway; cheap model like openai/gpt-4o-mini is enough).
3. `.env` may have DOS line endings after being copied from Windows — if S3/env vars misbehave, run `sed -i 's/\r$//' .env` first.
4. Sign in as a test user via the UI; use an existing project with tasks so the inbox isn't empty.

## Key behaviors to know
- Gates apply to **autonomous** agent runs (prompts like "Delegate autonomously: … run in the background" or tool calls executed by the worker). Chat proposals confirmed manually by the user ("Подтвердить" button) **bypass** gates by design — don't file that as a bug.
- Defaults: create/update task, create document, split task, canvas note = AUTO; delete task, send email, github push, devin delegate = APPROVE.
- Approvals UI: checkmark button in topbar → dialog with tabs Ожидают / История / Правила; red badge shows pending count.

## Test flow
1. Rules tab: verify 9 action types and defaults.
2. Set «Создание задачи» → «Согласование», send an autonomous run to create a task; expect pending request + badge, no task; approve; expect История «Одобрено» + task in inbox.
3. Set → «Запрещено», autonomous run again; expect no task AND no approval request (verify via `psql` if needed).
4. Reset the rule to «Авто» afterwards.
5. Adaptivity: `wmctrl -r "Workspace" -e 0,50,30,400,740` resizes Chrome to ~400px; dialog should become a bottom sheet, app switches to mobile bottom nav.

## Testing the agent UI refinements (auto-approve, proposals, task documents)
- Agent auto-approve settings: gear icon («Права агента») next to the agent picker in the agent panel header → per-action Авто/Спрашивать toggles + «Разрешить все действия». To test end-to-end: set «Создание задачи» = Авто, send "Create a task: …" in chat; the proposal card should flip to «Принято / Задача создана» with no click and the task appears in Входящие. Reset the toggle afterwards.
- Proposal cards in chat are compact by design: verb line («Создание задачи») + title + Принять/Отклонить only.
- Task detail panel shows a «Документы» section (agent-generated attachments) instead of a chat composer.
- Responsive checks: use `wmctrl -r :ACTIVE: -b remove,maximized_vert,maximized_horz` then `wmctrl -r :ACTIVE: -e 0,0,0,<width>,900`. At ~800px the board keeps fixed-width columns with horizontal scroll; at ~420px columns stack and mobile bottom nav appears. Re-maximize with `-b add,maximized_vert,maximized_horz` when done.

## Pitfalls / possible breakages
- xdotool `type` may fail on Cyrillic text (only ASCII gets typed). Send agent prompts in English — UI labels stay Russian so features are still verified — or paste Cyrillic via clipboard (`xclip` + ctrl+v).
- Old pending proposals from prior runs can clutter the chat; decline them before starting a new proposal test.
- Document creation (`create_document`) uploads to S3 (Beget-compatible endpoint in `.env`). The storage account might be suspended (`UserSuspended` on PutObject) — verify with a minimal PutObject script before blaming the code.
- If the topbar badge doesn't update, the tRPC `approval.requests.pendingCount` polls; refresh the page.
- Worker logs are the best place to see gate decisions during autonomous runs.

## Devin Secrets Needed
- `AI_GATEWAY_API_KEY` (Vercel AI Gateway) — already in repo `.env` in past sessions.
- Valid S3 credentials (S3_ENDPOINT/REGION/BUCKET/ACCESS_KEY_ID/SECRET_ACCESS_KEY) if testing document creation.
