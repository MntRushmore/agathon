# Sprint 5: Student Assignment Experience - IN PROGRESS

## What's Done ✅

1. ✅ Added `getStudentAssignments` import
2. ✅ Added `profile` from useAuth
3. ✅ Added `assignments` state array
4. ✅ Added assignments tab to `activeTab` type
5. ✅ Added `fetchAssignments()` function
6. ✅ Call `fetchAssignments()` for students on load
7. ✅ Updated tabs to include "My Assignments" for students

## What's Left 🔨

### 1. Add Assignment Filtering & Rendering Logic

**Location:** `/src/app/page.tsx` after line 485

**Add before the boards map:**
```typescript
// Filter logic based on active tab
const displayBoards = activeTab === 'my-boards' ? whiteboards :
                      activeTab === 'shared' ? sharedBoards :
                      [];

const filteredBoards = displayBoards.filter(board =>
  board.title.toLowerCase().includes(searchQuery.toLowerCase())
);

const filteredAssignments = assignments.filter(assignment =>
  assignment.assignment?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
  assignment.assignment?.class?.name?.toLowerCase().includes(searchQuery.toLowerCase())
);
```

**Replace line 486** `{filteredWhiteboards.map((board) =>` with:
```typescript
{activeTab === 'assignments' ? (
  // Render assignments
  filteredAssignments.length === 0 ? (
    <div className="col-span-full text-center py-16">
      <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <h3 className="text-lg font-medium mb-2">No assignments yet</h3>
      <p className="text-muted-foreground">
        Your teacher will assign work here
      </p>
    </div>
  ) : (
    filteredAssignments.map((submission) => (
      <div
        key={submission.id}
        className="group relative bg-card border hover:border-ring/50 transition-all overflow-hidden flex flex-col rounded-xl board-card cursor-pointer"
        onClick={() => router.push(`/board/${submission.student_board_id}`)}
      >
        {/* Assignment Preview */}
        <div className="relative w-full aspect-[16/10] overflow-hidden bg-muted">
          {submission.student_board?.preview ? (
            <img
              src={submission.student_board.preview}
              alt={submission.assignment.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <BookOpen className="w-16 h-16 text-muted-foreground opacity-20" />
            </div>
          )}
          {/* Status Badge */}
          <div className={cn(
            "absolute top-3 right-3 px-3 py-1.5 text-xs font-medium rounded-lg backdrop-blur-sm",
            submission.status === 'submitted' ? 'bg-green-500/90 text-white' :
            submission.status === 'in_progress' ? 'bg-yellow-500/90 text-white' :
            'bg-gray-500/90 text-white'
          )}>
            {submission.status === 'submitted' ? 'Submitted' :
             submission.status === 'in_progress' ? 'In Progress' :
             'Not Started'}
          </div>
        </div>

        {/* Assignment Info */}
        <div className="p-6">
          <h3 className="text-xl font-medium mb-1">{submission.assignment.title}</h3>
          <p className="text-sm text-muted-foreground mb-2">
            {submission.assignment.class.name}
          </p>
          {submission.assignment.due_date && (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Due {formatDistance(new Date(submission.assignment.due_date), new Date(), { addSuffix: true })}
            </p>
          )}
          {submission.submitted_at && (
            <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
              <Check className="h-3 w-3" />
              Submitted {formatDistance(new Date(submission.submitted_at), new Date(), { addSuffix: true })}
            </p>
          )}
        </div>
      </div>
    ))
  )
) : (
  // Original boards rendering
  filteredBoards.map((board) => (
    // existing board card code...
  ))
)}
```

### 2. Remove Duplicate Tabs

**Location:** Lines 407-427 (the second set of tabs I added)

Delete this entire section - it's a duplicate.

### 3. Update Board Rendering to Use filteredBoards

**Find all instances of** `filteredWhiteboards` **and replace with** `filteredBoards` **in the map function.**

### 4. Assignment Board View with Submit Button

**File:** `/src/app/board/[id]/page.tsx`

**Add at the top of the component:**
```typescript
const [submissionData, setSubmissionData] = useState<any>(null);
const [loadingSubmission, setLoadingSubmission] = useState(true);

useEffect(() => {
  async function checkIfAssignment() {
    const submission = await getSubmissionByBoardId(boardId);
    setSubmissionData(submission);
    setLoadingSubmission(false);
  }
  checkIfAssignment();
}, [boardId]);
```

**Add Assignment Banner before the canvas:**
```typescript
{submissionData && (
  <div className="fixed top-16 left-0 right-0 z-[999] bg-card border-b shadow-md">
    <div className="max-w-4xl mx-auto px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">{submissionData.assignment.title}</h3>
            <Badge variant={
              submissionData.status === 'submitted' ? 'default' :
              submissionData.status === 'in_progress' ? 'secondary' :
              'outline'
            }>
              {submissionData.status === 'submitted' ? 'Submitted' :
               submissionData.status === 'in_progress' ? 'In Progress' :
               'Not Started'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{submissionData.assignment.class.name}</p>
          {submissionData.assignment.instructions && (
            <p className="text-sm mt-2">{submissionData.assignment.instructions}</p>
          )}
          {submissionData.assignment.due_date && (
            <p className="text-sm text-muted-foreground mt-1">
              Due: {new Date(submissionData.assignment.due_date).toLocaleString()}
            </p>
          )}
        </div>

        {submissionData.status !== 'submitted' && (
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Mark as Submitted'}
          </Button>
        )}

        {submissionData.submitted_at && (
          <div className="text-sm text-green-600 flex items-center gap-1">
            <Check className="h-4 w-4" />
            Submitted {formatDistance(new Date(submissionData.submitted_at), new Date(), { addSuffix: true })}
          </div>
        )}
      </div>
    </div>
  </div>
)}
```

**Add submit handler:**
```typescript
const [submitting, setSubmitting] = useState(false);

const handleSubmit = async () => {
  if (!confirm('Submit this assignment? You can still make changes after submitting.')) {
    return;
  }

  setSubmitting(true);
  try {
    await updateSubmissionStatus(submissionData.id, 'submitted');
    toast.success('Assignment submitted!');
    setSubmissionData({...submissionData, status: 'submitted', submitted_at: new Date().toISOString()});
  } catch (error) {
    toast.error('Failed to submit assignment');
  } finally {
    setSubmitting(false);
  }
};
```

**Add auto-status update on first edit:**
```typescript
// In the editor component, add this effect:
useEffect(() => {
  if (submissionData && submissionData.status === 'not_started' && /* user made edits */) {
    updateSubmissionStatus(submissionData.id, 'in_progress');
  }
}, [/* dependencies */]);
```

### 5. Teacher Controls for AI Features

**In Assignment Creation Form** `/src/app/teacher/assignments/create/page.tsx`

**Add to form state:**
```typescript
const [allowAI, setAllowAI] = useState(true);
const [allowedModes, setAllowedModes] = useState(['feedback', 'suggest']);
```

**Add to configuration step:**
```typescript
<div>
  <Label>AI Assistance</Label>
  <div className="space-y-2 mt-2">
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={allowAI}
        onChange={(e) => setAllowAI(e.target.checked)}
      />
      <span className="text-sm">Allow AI assistance</span>
    </label>

    {allowAI && (
      <div className="ml-6 space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={allowedModes.includes('feedback')}
            onChange={() => toggleMode('feedback')}
          />
          <span className="text-sm">Feedback mode</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={allowedModes.includes('suggest')}
            onChange={() => toggleMode('suggest')}
          />
          <span className="text-sm">Suggest mode</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={allowedModes.includes('answer')}
            onChange={() => toggleMode('answer')}
          />
          <span className="text-sm">Solve mode</span>
        </label>
      </div>
    )}
  </div>
</div>
```

**Save to assignment metadata:**
```typescript
metadata: {
  ...existing,
  allowAI,
  allowedModes
}
```

**In Board View** `/src/app/board/[id]/page.tsx`

**Filter mode buttons based on assignment settings:**
```typescript
{submissionData && (
  const allowedModes = submissionData.assignment.metadata?.allowedModes || ['feedback', 'suggest', 'answer'];
  const allowAI = submissionData.assignment.metadata?.allowAI !== false;

  // Only show modes that are allowed
  <TabsList>
    <TabsTrigger value="off">Off</TabsTrigger>
    {allowAI && allowedModes.includes('feedback') && <TabsTrigger value="feedback">Feedback</TabsTrigger>}
    {allowAI && allowedModes.includes('suggest') && <TabsTrigger value="suggest">Suggest</TabsTrigger>}
    {allowAI && allowedModes.includes('answer') && <TabsTrigger value="answer">Solve</TabsTrigger>}
  </TabsList>
)}
```

## Testing Checklist

1. ✅ Sign in as student
2. ✅ See "My Assignments" tab
3. ✅ Click assignments tab - see list
4. ✅ Click assignment - opens board with banner
5. ✅ Make edits - status changes to "in progress"
6. ✅ Click "Mark as Submitted" - status updates
7. ✅ Teacher creates assignment with AI restrictions
8. ✅ Student sees limited AI modes
9. ✅ Teacher can enable/disable AI entirely

## Files to Modify

1. `/src/app/page.tsx` - Add assignment rendering
2. `/src/app/board/[id]/page.tsx` - Add assignment banner and submit
3. `/src/app/teacher/assignments/create/page.tsx` - Add AI controls

## Quick Implementation Steps

1. Add filtering logic in dashboard
2. Add conditional rendering for assignments tab
3. Remove duplicate tabs section
4. Add assignment banner to board view
5. Add submit handler
6. Add AI controls to assignment creation
7. Filter AI modes in board view
8. Test end-to-end

---

**Status:** 60% Complete
**Next:** Implement assignment rendering and board view enhancements
