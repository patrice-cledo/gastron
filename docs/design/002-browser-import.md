DESIGN DOC 002: Browser Import (WebView + Server Extraction)
1) Overview
Goal

Allow users to:

Browse the web inside the app (embedded WebView)

Tap “Import this page”

Backend fetches the URL and extracts a structured recipe

App shows an Import Preview screen

User confirms and saves to their recipe library

Key requirements

Minimal friction UX

Works with most recipe sites (JSON-LD first, fallback parsing)

Doesn’t rely on brittle client-side scraping

Handles failures gracefully (fallback to “Paste Text” or manual editor)

Secure (no open proxy, prevent abuse)

Non-goals (v1)

Full web automation (logins/paywalls)

Perfect extraction from every video-only source

OCR for images inside the browser (handled by Camera flow)

2) User Experience
2.1 Entry point

Create Recipe screen includes:

Browser Import

Camera Import

Paste Text

Start from Scratch

Tap Browser Import → opens BrowserImportScreen.

2.2 BrowserImportScreen (WebView Browser)

UI layout:

Top bar:

Back / Forward

URL/search input

Reload

“…” menu (Open in external browser, Copy link)

Main content:

WebView

Bottom sticky CTA:

Primary button: Import this page

Secondary (optional): “Paste link instead”

Behavior:

CTA enabled only when currentUrl is http/https

Button label can show domain:

“Import from allrecipes.com”

Loading states:

If WebView still loading, CTA still allowed, but import uses latest known URL.

Error states:

WebView fails to load → show inline error + “Open in external browser” option

2.3 Import Progress Modal

When user taps Import this page:

Show modal/screen:

“Importing recipe…”

Spinner

Optional: “This can take a moment on some sites” (don’t overpromise)

Allow cancel:

Cancel returns to browser without losing page state.

2.4 Import Preview Screen

Display extracted content:

Title

Cover image (if available)

Servings, prep/cook time (if available)

Ingredients list (editable)

Instructions (editable)

Tags (optional)

Source URL (read-only)

Confidence indicator (subtle): “Imported with high/medium confidence”

Actions:

Save Recipe

Back (returns to browser)

“Report problem” (sends extraction logs + url + user feedback)

If extraction is partial:

Show warning banner:

“We couldn’t extract everything. You can fix it before saving.”

If extraction fails:

Show failure screen:

“Couldn’t import this page”

Buttons:

“Try again”

“Paste text instead”

“Start from scratch”

“Open in external browser”

3) Architecture
3.1 Mobile (React Native)

react-native-webview for embedded browsing

Track URL + title using onNavigationStateChange

Call Firebase Cloud Function to import URL

Poll or subscribe to import job status (Firestore doc listener recommended)

Navigate to preview when ready

3.2 Backend (Firebase)

Cloud Functions:

startRecipeImport (callable/https)

processRecipeImport (background, can be Task Queue / pubsub-like pattern)

Firestore:

Store import jobs (status/progress/result pointers)

Store recipes after user confirms save (or store as draft)

Firebase Storage:

Store fetched images (optional: re-host to avoid hotlinking)

Store raw HTML snapshot (optional, short retention, for debugging)

4) Data Model (Firestore)
4.1 Collections
/users/{userId}

Basic user profile, plan, etc.

/imports/{importId}

Represents one import attempt.

Example:

{
  "userId": "abc",
  "sourceUrl": "https://example.com/recipe",
  "status": "queued | fetching | extracting | ready | failed",
  "createdAt": 1730000000,
  "updatedAt": 1730000100,
  "errorCode": null,
  "errorMessage": null,
  "result": {
    "recipeDraftId": "draft_123",
    "confidence": 0.82,
    "parser": "jsonld | microdata | heuristic",
    "warnings": ["Missing servings", "Unit mismatch"]
  },
  "metrics": {
    "fetchMs": 840,
    "extractMs": 210,
    "contentBytes": 143220
  }
}

/recipeDrafts/{draftId}

Temporary extracted recipe before save.

{
  "userId": "abc",
  "sourceUrl": "https://example.com/recipe",
  "title": "Best Pancakes",
  "imageUrl": "gs://...",
  "servings": 4,
  "prepMinutes": 10,
  "cookMinutes": 15,
  "totalMinutes": 25,
  "ingredients": [
    { "raw": "2 cups flour", "name": "flour", "quantity": 2, "unit": "cup", "notes": "" }
  ],
  "instructions": [
    { "step": 1, "text": "Mix dry ingredients." }
  ],
  "tags": ["breakfast"],
  "confidence": 0.82,
  "parser": "jsonld",
  "createdAt": 1730000000
}

/recipes/{recipeId}

Final user recipe after confirmation.

5) Cloud Function API
5.1 Start Import

Callable function: startRecipeImport

Input:

{ "url": "https://example.com/recipe" }


Validation:

Must be http/https

Block localhost / private IP ranges

Block file://, chrome://

Optional allowlist/denylist of domains

Rate limit per user (e.g., 20/day free tier, unlimited premium)

Enforce plan entitlements

Output:

{ "importId": "imp_123" }


Behavior:

Create /imports/{importId} with status queued

Trigger background processing (see 5.2)

5.2 Process Import (background)

Function: processRecipeImport(importId)

Steps:

Fetch HTML

Use a real user-agent

Follow redirects

Enforce timeouts + max content size

Extract recipe data (see Section 6)

Optionally fetch primary image + store in Firebase Storage

Write /recipeDrafts/{draftId} and update /imports/{importId} to ready

On failure: set status failed with errorCode/message

5.3 Client subscription

Mobile listens to:

/imports/{importId} doc updates
When status becomes ready → navigate to preview using recipeDraftId

6) Extraction Strategy (Server-Side)

Priority order (v1):

JSON-LD (<script type="application/ld+json">)

Find objects where @type includes Recipe (or array containing Recipe)

Microdata/RDFa (schema.org Recipe)

Heuristic HTML parsing

Identify ingredients list patterns

Identify instruction steps patterns

Title/image via OpenGraph as fallback

Normalization rules:

Ingredients stored as:

raw text always preserved

attempt parsed fields: name, quantity, unit, notes, confidence

Instructions stored as ordered list of steps

Times normalized into minutes

Servings normalized numeric if possible

Confidence scoring (simple):

Start at 1.0

Subtract for missing title/ingredients/instructions/image

Subtract for ambiguous parsing (e.g., ingredients < 3)

Store warnings list

Failure classification:

FETCH_FAILED

BLOCKED_DOMAIN

PAYWALL_OR_LOGIN

NO_RECIPE_FOUND

PARSING_ERROR

TIMEOUT

7) Security & Abuse Prevention (Important)

Because “fetch arbitrary URL” is basically “please let attackers use my backend as a free proxy”.

Mitigations:

Reject private IP ranges (SSRF protection)

Reject non-http(s)

Enforce max response size (e.g., 2–5 MB)

Enforce strict timeout (e.g., 10s)

Rate limit per user + per IP

Require authenticated Firebase user

Optional: allowlist common recipe sites early; expand gradually

Log domain-level failures for tuning

Storage controls:

If storing HTML snapshots, keep them short-lived (e.g., delete after 7 days)

Never store cookies or authenticated session data

8) Offline / Bad Network UX

WebView browsing requires network, obviously.
But import flow should handle shaky connections:

If import request fails immediately:

show error “Could not start import”

If import started but user loses connection:

import can still succeed server-side

app continues listening when network returns

If user closes screen:

import continues

user can see “Recent Imports” list and open the result later (optional v1.1)

9) Implementation Plan
Phase 1 (MVP)

WebView browser screen

“Import this page” -> Cloud Function start

Firestore import job status

Basic JSON-LD extraction

Preview screen with edit/save

Save recipe

Phase 2 (Stability)

Microdata + heuristic fallback

Better ingredient parsing normalization

Image re-hosting to Storage

Domain-level retry policies

“Report problem” feedback loop

Phase 3 (Performance + Costs)

Cache results by canonical URL hash to avoid repeated extraction

De-dupe imports

Background queue with concurrency control

10) Testing
Mobile

URL tracking works on:

normal navigation

redirects

SPA-style URL changes

Import button uses correct URL

Import status listener navigates correctly

Preview edits persist and save

Backend

Unit tests for JSON-LD parser (several sample pages)

SSRF protection tests (localhost, 169.254.x.x, private ranges)

Timeout tests

Size limit tests

Domain redirect tests

11) Definition of Done

User can import from a standard recipe blog that uses JSON-LD

Preview is editable and saves cleanly

Import does not block UI on cold starts (client optimistic)

SSRF mitigations + rate limiting exist

Logs support debugging failures

12) Cursor Tasks Checklist

 BrowserImportScreen (WebView + URL/search bar + Import CTA)

 startRecipeImport Cloud Function

 processRecipeImport worker

 Firestore schema + indexes (imports by userId/createdAt)

 ImportProgressModal

 ImportPreviewScreen + editing UI

 Recipe save flow

 Error handling & fallback actions