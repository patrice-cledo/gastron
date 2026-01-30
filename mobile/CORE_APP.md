Gastrons – Core App Screens (Post-Onboarding)
Navigation model

Bottom tab bar, 3 tabs only:

Recipes (default home)

Create

Profile

Because anything more becomes a scavenger hunt.

🏠 MAIN TAB 1 — Recipes (Home)
Screen: Recipe Library / Home

Purpose: Fast discovery. First thing users see after onboarding & plans.

Layout (top → bottom):

Top app bar:

left: small logo

right: search icon

Search field below bar
Placeholder: “Search recipes”

Horizontal category chips:

All

Quick

Vegetarian

Kids

30-min dinners

etc.

Recipe cards list/grid:

Each card includes:

parchment-style thumbnail

name

time icon + minutes

servings icon

bookmark icon

Empty state (brand-new user)

Center illustration + text:

No recipes yet.
Create one from a screenshot or browse our starter set.

Buttons:

Browse starter recipes

Create from screenshot

Screen: Recipe Details (Visual Sheet View)

This is your signature experience.

Layout:

Top bar:

Back arrow

Recipe title (truncated if long)

Save/bookmark

Share / export icon

Main body:

Large scrollable visual parchment layout

Tap targets mapped on ingredient icons & outlines

Bottom sticky actions:

Cook Mode

Print / Export

Interactions

tap ingredient outline → checkmark overlays it

tap step icon → toggles completion

pinch to zoom parchment

States

checked = higher contrast outline and check

unchecked = normal line weight

accessibility: not color-only changes

🍳 COOK MODE — “I’m actually cooking now”
Screen: Step-by-step cooking mode

Purpose: Remove distraction and scrolling during cooking.

Layout:

Top bar:

back

recipe title

Progress indicator
Horizontal dots or step numbers (1 of 6)

Main content block:

Large step icon

Step number + title

Very short instruction (max 2 lines)

Ingredients relevant to this step (icons or chips)

Timer widget if time-based

Bottom navigation:

“Previous”

“Next step” (primary)

Timer behavior

large center timer

background safe from accidental taps

alert sounds even if app backgrounded (OS-permitted)

Don’t do:

paragraph steps

hidden gestures

microscopic text while someone is sautéing onions

📸 MAIN TAB 2 — Create

This is the magic trick.

Screen: Create Options

Layout

Title:

Create a visual recipe

Buttons stacked:

Take photo of recipe

Upload screenshot / photo

Paste recipe text

Helper text below:

Works with cookbooks, blogs, screenshots, handwritten cards.

Screen: Camera Capture

live camera view full screen

ghost guide rectangle frame

overlay hint:

Make sure the whole recipe text is visible

Buttons:

shutter

flash toggle

gallery shortcut

After capture:

Retake

Use Photo

Screen: OCR Parsing Confirmation

Split view:

Left panel: Ingredients

Right panel: Steps

Each item:

editable text row

reorder drag handle

delete option

“+ Add item”

Top instructional text:

Review and edit anything that looks wrong before we convert it.

Bottom sticky actions:

Back

Convert to visual layout

Screen: Generated Visual Recipe Preview

Large parchment-style page shown.

Over it:

Editable title text

Tap to edit ingredient icons or distributions

Tap-and-hold to move elements (future, not MVP)

Button row under preview:

Save recipe

Cook now

Export / Print

Watermark appears for free users. Paid removes it. Subtle but visible.

👤 MAIN TAB 3 — Profile

Simple. Don’t turn this into Facebook.

Screen: Profile Overview

Top block:

avatar (initials)

phone/email

“Edit profile” small button

Sections below as rows:

Saved recipes

My converted recipes

Print/export history

Manage subscription

Notifications

Settings

Log out

Screen: Settings

Rows:

Dark mode

Notifications toggle

Cooking reminders

Language (later)

Data & privacy

Delete account (danger zone highlighted red)

Confirmations required for destructive actions. No “oops I deleted my soul” UX.

🚫 ERROR / EDGE CASE SCREENS
OCR failed screen

Icon: confused document

Text:

We couldn’t read that very well.

Buttons:

Try again

Edit manually

No internet

Text:

You’re offline.
You can still view saved recipes.

Button:

Retry

🧭 COMPLETE USER JOURNEY MAP (Post-Onboarding)

User enters home:

Lands on Recipes

Either browses or taps Create

Uploads picture

Confirms parsed text

Gets auto-generated visual recipe

Saves it

Uses Cook Mode

Prints if needed

This avoids:

forced tutorials

endless tooltips

social feeds nobody asked for

🧠 UX RULES WE ARE FOLLOWING ON PURPOSE

no screen exists without a “why”

always show a back button

everything thumb-reachable

text stays short because humans

“next obvious step” always visible

no dark patterns

guest mode always possible but limited