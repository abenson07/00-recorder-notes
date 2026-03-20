## note-007 — Project Templates + Structured Output Formats (JSON Tasks, etc.)

### Prerequisites
1. `note-recording-app/tasks/note-006.md` completed (vector search working and transcripts embedded).
2. `note-recording-app/tasks/note-003.md` completed (transcription pipeline writes output/summary fields).

### Detailed Implementation Steps
#### A) Add template/direction configuration to projects
1. Extend the `projects` model with template metadata (use one approach):
   - Approach 1: store a `template` jsonb inside `projects.direction_files`
   - Approach 2: add a dedicated `projects.template` column
2. Template content should support:
   - instructions for how to summarize a new transcript chunk
   - output format (plain text vs structured JSON)
   - schema hints (fields, types, and example outputs)
3. Provide templates as presets (for v1):
   - Default “Summary” template (text outline)
   - “Tasks” template (structured JSON)

#### B) Update processing after transcription completes
1. When **OpenAI transcription** completes successfully, you should have:
   - `transcriptText` for the recording
   - optionally `segments`
2. Apply the project template during update:
   - Inputs:
     - existing `projects.summary` (or existing structured output)
     - new recording transcript
     - template instructions/schema
   - Outputs:
     - per-recording `recordings.output_summary` in the template’s format
     - updated `projects.summary` (or updated structured summary)
3. If output is structured JSON:
   - Store as text or jsonb depending on how you want to render it.
   - Recommended:
     - `recordings.output_summary_json` jsonb (future) OR store JSON string but validate before saving

#### C) UI for templates and structured outputs
1. On `Project Detail` page:
   - Add a “Direction/Template” panel (editable for unlocked titles)
   - For v1, editing can be a simple textarea + save button
2. On `Individual Recording` page:
   - `Output/Summary` tab should render:
     - text outlines, or
     - JSON structured output:
       - format into readable cards/lists
3. Handle template mismatches:
   - If template expects JSON but generation fails, show an error and store raw output for debugging.

### Acceptance Criteria
1. A project can be configured with a template/direction.
2. When a new recording is transcribed:
   - the template is applied
   - recording output and project summary/outline update accordingly
3. Structured outputs render correctly in the UI (at least for the “Tasks” template).

### Testing that I will do (agent)
1. Template configuration test:
   - Create a project and set template/direction to both:
     - default summary (text)
     - “Tasks” JSON template
   - Verify persistence in the DB and that it impacts the next transcription.
2. Structured output test (“Tasks”):
   - Record audio containing explicit tasks/action items.
   - After transcription, confirm:
     - `recordings.output_summary` matches the expected JSON schema (or validated parse succeeds)
     - UI renders the tasks list/cards correctly.
3. Regression test:
   - Switch back to default summary template.
   - Transcribe again and confirm output format returns to text outline.
4. Failure handling test:
   - Simulate invalid JSON from template generation.
   - Confirm:
     - UI shows a safe error state
     - app does not crash
     - raw output is preserved for debugging (as defined in implementation).

### Your check-off acceptance criteria
1. Template selection/editing is visible in the Project Detail screen and affects subsequent recording processing.
2. For the “Tasks” template, structured output is valid and renders in the Output/Summary tab.
3. Switching templates changes the output format as expected.
4. Invalid structured output fails gracefully without breaking the UI.

