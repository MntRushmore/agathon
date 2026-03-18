# Agathon Static Analysis Report

**Date:** 2026-03-12
**Branch:** `marcus-staging`
**Codebase:** ~96,000 lines across 632 TypeScript/TSX files

---

## Executive Summary

| Category | Status | Key Finding |
|----------|--------|-------------|
| **Security** | GOOD (post-audit fixes) | 0 CRITICAL, 1 HIGH (no rate limiting), 2 MEDIUM |
| **Dead Code** | MODERATE | See `dead-code-analysis.txt` for verified findings |
| **Code Duplication** | 6.97% | 374 clone pairs detected across 892 files |
| **Cyclomatic Complexity** | HIGH in 4 files | `board/page.tsx` (312), `journal/page.tsx` (195), `RichTextEditor` (117), `page.tsx` (102) |
| **Circular Dependencies** | NONE | No circular imports detected |
| **Formatting/Linting** | MIXED | Inconsistent quote style, 2 `@ts-ignore`/`@ts-expect-error` |
| **Maintainability** | NEEDS ATTENTION | 4 files over 1,000 lines; 21 files over 500 lines |

---

## 1. Security Analysis

**Full report:** [`security-analysis.txt`](security-analysis.txt)

### Summary by Severity
- **CRITICAL:** 0 (previously 3, all fixed on `marcus-staging`)
- **HIGH:** 1 -- No rate limiting on any API route (FINDING-19)
- **MEDIUM:** 2 -- Admin token in request body; Supabase error messages leaked to client
- **LOW:** 9 -- Various minor issues (XSS mitigated, verbose logging, CSRF noted)
- **INFO:** 8 -- Positive observations, acceptable patterns

### Priority Fixes Remaining
1. **Implement rate limiting** on AI endpoints (20-30 req/min), auth endpoints (5-10 req/min per IP), and public endpoints (3-5 req/min per IP)
2. **Stop returning raw Supabase errors** in `documents/route.ts` and `knowledge/search/route.ts`
3. **Review admin token storage** -- consider httpOnly cookies for switch-user flow

### Positive Observations
- All `dangerouslySetInnerHTML` properly sanitized with DOMPurify
- No `eval()`, `Function()`, or `innerHTML=` patterns
- No hardcoded secrets; all credentials via env vars
- Pino logger has built-in field redaction
- Comprehensive security headers (CSP, HSTS, X-Frame-Options)

---

## 2. Dead Code Analysis

**Full report:** [`dead-code-analysis.txt`](dead-code-analysis.txt)

Analysis covers unused exports, unused files, unused internal functions, and unreachable code. Each finding verified via grep to confirm the export/function is truly never imported/called elsewhere.

---

## 3. Code Duplication

**Full report:** [`duplication-summary.txt`](duplication-summary.txt) | [`jscpd-report/jscpd-report.json`](jscpd-report/jscpd-report.json)

| Metric | Value |
|--------|-------|
| Total files analyzed | 892 |
| Total lines | 105,259 |
| Total clones | 374 |
| Duplicated lines | 7,336 |
| **Duplication percentage** | **6.97%** |

### Top Duplication Hotspots
- **Email templates** (`WaitlistParent.tsx`, `WaitlistTeacher.tsx`, `WaitlistWelcome.tsx`, `ReferralAnnouncement.tsx`) -- massive structural duplication (100-200+ lines per pair). **Recommendation:** Extract shared email layout component.
- **TipTap table node hooks** -- Significant duplication across `use-table-*.ts` hooks. These are likely from the TipTap template and may not be worth refactoring.
- **Board page** (`board/[id]/page.tsx`) -- Internal duplication within the 3,334-line file.

---

## 4. Cyclomatic Complexity

**Full report:** [`cyclomatic-complexity.txt`](cyclomatic-complexity.txt)

### Files Requiring Refactoring (complexity > 50)

| Complexity | File | Lines | Notes |
|-----------|------|-------|-------|
| **312** | `src/app/board/[id]/page.tsx` | 3,334 | God component -- 182 if/else, 54 for loops, 30 catch blocks |
| **195** | `src/app/journal/[id]/page.tsx` | 2,481 | 96 if/else, 36 for loops |
| **117** | `src/components/journal/RichTextEditor.tsx` | 1,727 | 88 if/else |
| **102** | `src/app/page.tsx` | 2,165 | Dashboard with 59 if/else |
| **60** | `src/app/api/generate-solution/route.ts` | 436 | Most complex API route |
| **55** | `src/app/api/knowledge/sync/route.ts` | 289 | 30 if statements in 289 lines |

### Recommendation
The board page (`board/[id]/page.tsx`) at 3,334 lines with complexity 312 is the highest-priority refactoring target. Consider splitting into:
- Board canvas logic
- AI tutor integration
- Toolbar/controls
- Shape management hooks
- Animation/styling utilities

---

## 5. Circular Dependencies

**Full report:** [`circular-dependencies.txt`](circular-dependencies.txt)

**No circular dependencies found.** The import graph is clean.

---

## 6. Formatting & Linting

**Full report:** [`formatting-analysis.txt`](formatting-analysis.txt)

### Consistency Issues

| Issue | Details |
|-------|---------|
| **Quote style** | Mixed: 1,040 single-quoted imports vs 1,703 double-quoted imports |
| **Semicolons** | Used consistently in API routes (45/46 files) |
| **`any` type usage** | 140+ occurrences across 30 files. Top offenders: `board/page.tsx` (39), `platform.ts` (10), `MyScriptMathOverlay.tsx` (10) |
| **`@ts-ignore`/`@ts-expect-error`** | 2 occurrences total (acceptable for math libraries) |
| **Non-null assertions (`!.`)** | 15+ files, mostly in canvas/math components |
| **TODO/FIXME comments** | 9 active TODOs (mostly in tiptap-collab-utils.ts template code) |
| **console.log statements** | 50+ across the codebase; should migrate to pino logger |

### Linting Status
- **ESLint:** Cannot run -- `node_modules` not installed (requires `TIPTAP_PRO_TOKEN`)
- **TypeScript strict mode:** Enabled in tsconfig.json
- **No Prettier configured** -- manual formatting only

---

## 7. Maintainability Index

### Composite Score by Area

| Area | Score | Rationale |
|------|-------|-----------|
| **API Routes** | B+ | Good auth patterns, input validation; needs rate limiting and error sanitization |
| **Components** | C | 4 "god components" over 1,000 lines; high complexity in board/journal |
| **Library Code** | A- | Clean, focused modules; proper error handling |
| **Database/Migrations** | B | RLS policies well-structured; some policies overly broad (now fixed) |
| **Type Safety** | B- | 140+ `any` usages; strict mode enabled but not fully leveraged |
| **Test Coverage** | F | No test files found in the repository |

### Files Needing Attention (sorted by urgency)

1. **`src/app/board/[id]/page.tsx`** (3,334 lines, complexity 312) -- Split into smaller components
2. **`src/app/journal/[id]/page.tsx`** (2,481 lines, complexity 195) -- Extract journal editor, chat, and sidebar
3. **`src/app/page.tsx`** (2,165 lines, complexity 102) -- Extract dashboard sections
4. **`src/components/journal/RichTextEditor.tsx`** (1,727 lines, complexity 117) -- Extract toolbar, formatting logic

---

## 8. API Routes Auth Check

**Full report:** [`api-auth-check.txt`](api-auth-check.txt)

| Status | Count | Routes |
|--------|-------|--------|
| **Authenticated** | 42 | All user-facing routes properly check `getUser()` |
| **Intentionally public** | 4 | `waitlist`, `polar/webhook`, `referral/leaderboard`, `referral/[code]` |

---

## Artifacts Index

| File | Description |
|------|-------------|
| `REPORT.md` | This consolidated report |
| `security-analysis.txt` | 21 security findings with severity ratings |
| `dead-code-analysis.txt` | Verified unused exports, functions, and files |
| `duplication-summary.txt` | Code clone analysis summary (374 pairs) |
| `jscpd-report/jscpd-report.json` | Raw jscpd JSON output |
| `cyclomatic-complexity.txt` | Complexity scores for all API routes and large components |
| `circular-dependencies.txt` | Circular dependency check (none found) |
| `formatting-analysis.txt` | Quote style, `any` usage, TODOs, console.log, ts-ignore |
| `maintainability-analysis.txt` | File sizes, function lengths, nesting depth, type safety |
| `api-auth-check.txt` | Auth verification status for all 46 API routes |
| `large-files.txt` | All files over 200 lines sorted by size |
