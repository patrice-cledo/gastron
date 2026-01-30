# Cook Mode – Specification

## Overview
Cook Mode is a focused, step-by-step cooking experience designed to minimize cognitive load while following a recipe. It prioritizes visual guidance, large touch targets, and distraction-free interaction during active cooking.

Cook Mode supports:
- step sequencing
- ingredient check-off
- timers
- visual instruction icons
- accessibility for visual learners

---

## Objectives
- Provide a hands-free-friendly, glanceable interface
- Prevent users from losing track of progress while cooking
- Reduce text-based instruction dependency
- Support multi-step timing without leaving the main flow

---

## Entry Points
Cook Mode may be launched from:
- Recipe detail screen (“Cook Mode” button)
- After generating a visual recipe
- Recently cooked recipes list
- Timer notification (“Return to Cook Mode”)

---

## Layout Structure

### 1. Header
- Back button
- Recipe title (truncated if necessary)
- Step progress indicator (e.g., “Step 2 of 7”)

### 2. Main Content Area
Displays the current step in a focused view:

- Large step icon (visual instruction)
- Step title
- Short instruction text (1–2 lines)
- Related ingredient chips or icons
- Optional substitute suggestions (collapsed by default)

### 3. Action Area (Bottom)
Primary navigation controls:

- Previous step
- Next step (primary emphasis)

If step contains a timer:
- Start/Pause timer control
- Remaining time display
- Notification permission fallback message when needed

---

## Interaction Model

### Step Navigation
- “Next step” advances to next instruction
- “Previous step” returns to prior instruction
- Swiping left/right is optional secondary navigation

### Ingredient Tracking
- Ingredient chips toggle checked/unchecked
- Checked items visually confirm completion
- State is persistent within the session

### Timer Behavior
- Timer runs in background when app is minimized
- System notifications announce completion
- Users can stop, pause, or restart timers
- Multiple timers allowed in later versions

---

## Visual Design Principles
- High contrast, low clutter
- Large buttons and text
- Minimal scrolling
- Max 2–3 elements per view
- Icons prioritized over paragraphs

---

## Safety & Usability Considerations
- Avoid long reading during active cooking
- Clear confirmation for exiting Cook Mode
- Prevent accidental step jumps
- Provide offline fallback if connection drops

---

## Accessibility
Cook Mode supports:
- Dynamic text scaling
- Screen reader labels for icons
- Non-color-dependent status indication
- Haptic confirmations where applicable

---

## States & Edge Cases
Cook Mode includes the following states:

- Active step
- Timer running
- Timer finished
- Offline mode
- Interrupted session (resume option)
- End of recipe (“Recipe complete”)

---

## Analytics Events (Optional)
Trackable events include:

- Cook Mode opened
- Step advanced
- Step completed
- Timer started/completed
- Recipe completed
- Cook Mode abandoned

---

## Future Enhancements
Planned iterative improvements:

- Hands-free voice navigation (“next step”, “repeat”)
- Guided video snippets per step
- Wearable/companion device support
- Multi-dish cooking synchronization
- Smart step reordering based on timing

---
