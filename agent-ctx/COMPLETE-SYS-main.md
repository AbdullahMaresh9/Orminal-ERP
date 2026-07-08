# Task ID: COMPLETE-SYS — Agent: main (Z.ai Code)

## Task
Complete 5 frontend modules + 1 missing API for the Enterprise ERP:
1. `src/app/api/erp/roles/[id]/route.ts` — Role GET/PUT/DELETE
2. `src/components/modules/users-module.tsx` → `UsersModule`
3. `src/components/modules/roles-module.tsx` → `RolesModule` (with permission matrix)
4. `src/components/modules/audit-logs-module.tsx` → `AuditLogsModule` (read-only)
5. `src/components/modules/notifications-module.tsx` → `NotificationsModule`
6. `src/components/modules/profile-module.tsx` → `ProfileModule` (4 tabs)
7. Update `module-registry.tsx` to wire all 5 modules as lazy-loaded components

## Context reviewed
- `worklog.md` (614 lines) — confirmed RECONSTRUCTION complete; 11 functional modules + 25 stubs; dev server on port 3000
- `prisma/schema.prisma` — User (nameAr, nameEn, username, passwordHash, mfaEnabled, defaultBranchId, userRoles[]), Role (isSystem, rolePermissions[]), Permission (moduleCode, actionCode), RolePermission (canCreate/Read/Update/Delete/Approve/Post/Cancel/Reverse/Export), AuditLog (append-only), Notification (type, category, isRead)
- `module-registry.tsx` — 5 stubs to replace: users, roles, audit-logs, notifications, profile (note: other agents had already wired Manufacturing + HR modules as lazy)
- `settings-module.tsx` & `partners-module.tsx` — patterns: ModuleShell + KpiCard + table + dialog form + exportToCSV
- `api-response.ts` — `ok/created/list/badRequest/notFound/serverError/forbidden` + `parsePagination/parseSearch`

## Work Log

### Backend

**1. Created `src/app/api/erp/roles/[id]/route.ts`** (NEW)
- `GET /api/erp/roles/[id]` — returns role with `rolePermissions` (including permission details) and `_count.userRoles`
- `PUT` — updates role fields (code immutable, isSystem cannot be deactivated) and atomically replaces `rolePermissions` (deleteMany + create per module). Auto-provisions Permission rows per module (FIN/SAL/PUR/INV/MFG/HR) using `findFirst + create` (Permission has no @@unique constraint)
- `DELETE` — blocks with 403 `SYSTEM_ROLE` when role.isSystem=true; blocks with 400 `ROLE_IN_USE` when active userRoles > 0; cascades delete rolePermissions first

**2. Rewrote `src/app/api/erp/users/route.ts`** (was broken — used old schema fields `name`, `password`, `role`, `branchId`)
- `GET` — pagination + search (username/nameAr/nameEn/email) + active/mfaEnabled filters. Returns standard envelope via `list()` with `userRoles.role` and `defaultBranch` included. No password fields returned.
- `POST` — validates username/email/nameAr/password required; duplicate check; stores `passwordHash` as `hashed$<base64>` (sandbox — production would use bcrypt); creates `userRoles` link when roleId provided

**3. Rewrote `src/app/api/erp/users/[id]/route.ts`** (was broken)
- `GET` — full profile including `defaultBranch`, `userRoles.role`, locale, timezone, lastLoginAt
- `PUT` — duplicate email check; updates all user fields; if `password` provided, updates `passwordHash`; if `roleId` provided, replaces userRoles atomically
- `DELETE` — blocks deletion of `admin` user (403 SYSTEM_USER); cascades userRoles (AuditLog.userId is nullable → SetNull, Notification cascades)

**4. Extended `src/app/api/erp/audit-logs/route.ts`** (was returning custom shape; no module/date filters)
- Added filters: `action` (validated against ALLOWED_ACTIONS), `module`/`moduleCode`, `userId`, `from`/`to` (ISO date range with end-of-day ceiling)
- Added KPI extras to meta: `today` (count since midnight), `byAction` ({create, update, delete, post}), `byModule` (groupBy)
- Standard envelope: `{data, meta: {pagination, extras}}`
- Read-only — no POST/PUT/DELETE (per ADR-014)

**5. Extended `src/app/api/erp/notifications/route.ts`**
- `GET` — filters: `type`, `category`, `isRead`, `q` (search title/message). Returns `{data, meta: {total, unread, byType, byCategory}}` (groupBy aggregations)
- `POST` — creates notification with type/category validation
- `PATCH` (new) — bulk "mark all as read" (`updateMany` with isRead:true); optional `?userId=` scope

### Frontend modules

**6. `users-module.tsx`** — User CRUD
- KPIs: total users, active, top role, with MFA
- Table: username, nameAr, email, role (badge), branch, MFA badge, status, lastLogin
- Add dialog: username, nameAr, nameEn, email, phone, role Select, branch Select, password (with show/hide eye), active Switch, mfaEnabled Switch
- Edit dialog: same minus username; password replaced with collapsible "change password" panel
- Delete blocked on `admin` user (button disabled + DELETE API returns 403)
- Export CSV; search by username/name/email; filter active/inactive

**7. `roles-module.tsx`** — Role CRUD + permission matrix
- KPIs: total roles, system, custom, total permissions
- Table: code, nameAr, type (system/custom badge), description, userCount, status
- Add dialog: code (immutable on edit), nameAr, nameEn, description, active
- Edit dialog: includes full **permission matrix** — table with rows = 6 modules (FIN/SAL/PUR/INV/MFG/HR), columns = 9 actions (canCreate/Read/Update/Delete/Approve/Post/Cancel/Reverse/Export); each cell a Checkbox; "select all / clear all" per module; matrix is loaded from `GET /api/erp/roles/[id]` and saved via `PUT` with `permissions[]` payload
- Delete blocked on `isSystem` roles (button disabled + API returns 403)
- Export CSV; filter system/custom

**8. `audit-logs-module.tsx`** — Read-only audit trail
- KPIs: total logs, today, top action, top module (driven by API extras)
- Table: timestamp, user, module (badge), documentType, documentId, action (colored badge), oldValue (truncated 40 chars), newValue (truncated), ipAddress
- Filters: action Select, module Select, dateFrom/dateTo (HTML date inputs)
- Click row → detail dialog showing all fields + pretty-printed JSON for oldValue/newValue (in `<pre>` blocks with mono font, dir="ltr")
- NO create/edit/delete actions (per ADR-014 — append-only)
- Export CSV; client-side search filter; pagination (25 per page)

**9. `notifications-module.tsx`** — Notification management
- KPIs: total, unread, top type, top category
- Table: type icon (info/success/warning/error), title (bold when unread + dot indicator), message (truncated), type badge, category badge, read status, date (relative time)
- Actions: "Mark as Read" (per-row PUT), "Mark All as Read" (bulk PATCH), Delete (per-row DELETE)
- Filters: type Select, category Select, read/unread/all buttons
- Export CSV; client-side search
- Unread rows highlighted with subtle emerald tint

**10. `profile-module.tsx`** — User profile + preferences (4 tabs)
- Header card: avatar (initials fallback), name, role badge, status, MFA badge, member since, last login
- Tab 1 **Personal Info**: nameAr, nameEn, email (with Mail icon), phone (with Phone icon), avatar URL, address Textarea → saves via PUT /api/erp/users/[id]
- Tab 2 **Security**: change password form (current/new/confirm with client-side validation: matching + min length 6) + MFA toggle Switch (immediate PUT). Info cards showing last password change + creation date.
- Tab 3 **Preferences**: theme (light/dark/system buttons via `useTheme`), language (ar/en buttons via `useI18n`), density Select (comfortable/compact, persisted to localStorage), timezone Select (11 Middle East timezones + UTC). Save button calls PUT with locale+timezone.
- Tab 4 **Activity**: KPI cards (member since, last login, total activities) + activity list from `GET /api/erp/audit-logs?userId={id}` showing action/module/documentType/timestamp/ipAddress
- Used render-phase state sync pattern (matches settings-module.tsx) to avoid `react-hooks/set-state-in-effect` lint rule

**11. Updated `module-registry.tsx`**
- Added 5 lazy imports: UsersModule, RolesModule, AuditLogsModule, NotificationsModule, ProfileModule
- Removed the 5 stub declarations (UsersModule, RolesModule, AuditLogsModule, NotificationsModule, ProfileModule) to avoid duplicate const declarations
- Registry entry now maps: `users`/`roles`/`audit-logs`/`notifications`/`profile` → real lazy modules

## Verification

```bash
# All endpoints return 200 with standard envelope:
curl -s http://localhost:3000/api/erp/users       # → {data:[{id,username,email,nameAr,...,userRoles,defaultBranch}], meta:{pagination}}
curl -s http://localhost:3000/api/erp/roles        # → {data:[{id,code,nameAr,isSystem,...,_count:{userRoles,rolePermissions}}], meta}
curl -s http://localhost:3000/api/erp/audit-logs   # → {data:[...], meta:{pagination, extras:{today, byAction, byModule}}}
curl -s http://localhost:3000/api/erp/notifications # → {data:[...], meta:{total, unread, byType, byCategory}}
curl -s http://localhost:3000/api/erp/roles/[id]   # → 200 GET / 200 PUT / 403 DELETE on isSystem role

# Lint:
bun run lint                                       # → EXIT=0 (no errors, no warnings)
```

## Decisions / Notes
- **Permissions table was empty** — the API auto-provisions one Permission per module (`{moduleCode}_ACCESS`) on first PUT, then links via RolePermission. Avoids needing a separate seed.
- **Password storage** uses `hashed$<base64>` obfuscation for the sandbox (production would use bcrypt via a separate lib, but no auth system is wired in this iteration).
- **Profile module** treats the first user (`admin`) as the "current user" since there's no NextAuth session in this sandbox.
- **AuditLog.userId is nullable** so deleting a user sets their audit logs to null (Prisma default for optional relations). Notifications cascade.
- **Render-phase state sync** (the pattern in settings-module.tsx) used in profile-module.tsx to mirror server state into local form without `setState` inside `useEffect` — keeps `react-hooks/set-state-in-effect` lint rule satisfied.
- Used `<span className="num" dir="ltr">` for all numeric/date cells, `ps-/pe-/ms-/me-` for logical CSS, emerald/teal palette throughout, no blue/indigo.

## Files Created/Modified
- NEW: `src/app/api/erp/roles/[id]/route.ts`
- MODIFIED: `src/app/api/erp/users/route.ts` (rewritten)
- MODIFIED: `src/app/api/erp/users/[id]/route.ts` (rewritten)
- MODIFIED: `src/app/api/erp/audit-logs/route.ts` (extended)
- MODIFIED: `src/app/api/erp/notifications/route.ts` (extended)
- NEW: `src/components/modules/users-module.tsx`
- NEW: `src/components/modules/roles-module.tsx`
- NEW: `src/components/modules/audit-logs-module.tsx`
- NEW: `src/components/modules/notifications-module.tsx`
- NEW: `src/components/modules/profile-module.tsx`
- MODIFIED: `src/components/erp/module-registry.tsx` (replaced 5 stubs with lazy)

## Stage Summary
- All 5 platform modules (users, roles, audit-logs, notifications, profile) now fully functional with ModuleShell + KPIs + tables + dialogs + CSV export
- Roles module includes a 6×9 permission matrix in the edit dialog (FIN/SAL/PUR/INV/MFG/HR × 9 actions) auto-provisioning Permission rows
- Audit-logs is read-only per ADR-014 with date range + action + module filters and JSON detail viewer
- All 4 user-facing API endpoints (users, roles, audit-logs, notifications) + roles/[id] return standard response envelope
- Lint passes with 0 errors; dev server compiles cleanly
- The SPA now has 16+ fully functional modules (was 11) + 5 newly wired
