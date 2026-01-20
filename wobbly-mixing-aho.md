# Platform Improvement Roadmap

## Overview
Strategic improvements and new features for the educational math whiteboard platform, prioritized by impact and effort.

---

## Quick Wins (1-2 days each)

### 1. Fix "AI Assists Today" Dashboard Metric
- **File:** `src/app/teacher/page.tsx` (lines 376-390)
- **What:** Query `ai_usage` table filtered by today's date for teacher's classes
- **Why:** Currently shows "--" placeholder, undermines analytics trust

### 2. Implement Class Editing Dialog
- **File:** `src/app/teacher/classes/[id]/page.tsx` (line 158 - TODO)
- **What:** Create EditClassDialog based on CreateClassDialog pattern
- **Why:** Teachers can't modify class details after creation

### 3. Add Hint Usage Warning
- **File:** `src/app/board/[id]/page.tsx` (trackAIUsage function)
- **What:** Show toast when 1-2 hints remaining before limit
- **Why:** Students hit limit unexpectedly, causes frustration

### 4. Track Quick Mode (MyScript) in Analytics
- **File:** `src/app/board/[id]/page.tsx` (lines 1831-1834)
- **What:** Ensure all MyScript calculations logged to ai_usage table
- **Why:** Teachers lose visibility into this popular mode

### 5. Add Dashboard Metric Tooltips
- **File:** `src/app/teacher/page.tsx`
- **What:** Tooltip explanations for each metric card
- **Why:** New teachers don't understand what metrics mean

---

## Core Improvements (3-5 days each)

### 6. Rate Limiting on AI Requests
- **Files:** `src/app/api/generate-solution/route.ts`, `src/app/api/chat/route.ts`
- **What:** Token bucket rate limiting (30 req/min per user)
- **Why:** No limits = cost risk and abuse potential

### 7. Persist Chat History to Database
- **Files:** `src/hooks/useChat.ts`, new `chat_history` table
- **What:** Save conversations, enable resume and teacher review
- **Why:** Chat lost on refresh, teachers can't see student conversations

### 8. Enforce Socratic Mode in All AI Routes
- **File:** `src/app/api/generate-solution/route.ts` (lines 92-168)
- **What:** Accept `isSocratic` param, modify prompts accordingly
- **Why:** Students can bypass Socratic restrictions via generate-solution

### 9. Bulk Student Operations
- **File:** `src/components/teacher/ClassRoster.tsx`
- **What:** Multi-select with bulk remove, message, export
- **Why:** Managing large classes one-by-one is tedious

### 10. Token/Cost Tracking Display
- **File:** New StudentAIUsage component
- **What:** Show students their AI usage stats educationally
- **Why:** Teaches resource awareness, no current visibility

### 11. Class Performance Trends
- **File:** `src/app/teacher/classes/[id]/page.tsx` + new API
- **What:** Time-series charts of submission rates, AI usage
- **Why:** Teachers only see snapshots, can't track intervention effectiveness

---

## New Features (1-2 weeks each)

### 12. Student Personal Progress Dashboard
- **File:** New `src/app/student/dashboard/page.tsx`
- **What:** Assignment history, AI usage patterns, concept mastery, streaks
- **Why:** Students have no holistic view of their learning journey

### 13. Gradebook Interface
- **File:** New `src/app/teacher/classes/[id]/gradebook/page.tsx`
- **What:** Spreadsheet view with inline grading, bulk operations
- **Why:** No grading interface exists, critical gap

### 14. Auto-Concept Tagging
- **File:** `src/app/api/generate-solution/route.ts`
- **What:** AI extracts concept tags from student work automatically
- **Why:** Manual tagging rarely happens, heatmap stays empty

### 15. Teacher Welcome Tour
- **File:** Extend `src/lib/hooks/useOnboarding.ts`
- **What:** Interactive onboarding for class creation, assignments
- **Why:** Complex dashboard with no introduction

### 16. Assignment Templates Library
- **File:** Extend `src/app/teacher/templates/page.tsx`
- **What:** Shareable, searchable template library by subject/grade
- **Why:** Teachers recreate from scratch, no best practice sharing

### 17. Student-Teacher Messaging
- **File:** New `src/app/messages/page.tsx`
- **What:** Direct messaging, class announcements, realtime notifications
- **Why:** No communication channel exists in platform

---

## Future Vision (1+ months)

### 18. Predictive At-Risk Detection
- ML model predicting struggle before it happens
- Enables proactive intervention

### 19. Parent/Guardian Portal
- Read-only access to child's progress
- Weekly email digests

### 20. Offline-First PWA
- Service worker, IndexedDB storage
- Sync when connection restored

### 21. Multi-Language Support
- i18n extraction, RTL support
- Language-aware AI prompts

### 22. Real-Time Collaboration
- TLDraw multiplayer with cursors
- CRDT-based conflict resolution

---

## Recommended Priority Order

| # | Item | Impact | Effort |
|---|------|--------|--------|
| 1 | Fix AI Assists Metric | High | Low |
| 2 | Class Editing | Medium | Low |
| 3 | Rate Limiting | High | Medium |
| 4 | Hint Warning | Medium | Low |
| 5 | Chat Persistence | High | Medium |
| 6 | Auto-Concept Tagging | High | Medium |
| 7 | Gradebook | Very High | High |
| 8 | Student Dashboard | High | High |
| 9 | Teacher Onboarding | Medium | Medium |
| 10 | Messaging | Medium | High |

---

## Verification

After implementing any item:
1. Run `npm run build` to ensure no TypeScript errors
2. Test the specific feature manually in browser
3. For API changes, test with curl/Postman
4. For database changes, verify RLS policies work correctly
