DESIGN DOC 005: Import Recipe from Photo/Screenshot (Google Vision AI OCR)
0) Goal

Users can import a recipe from:

a photo (camera)

a screenshot (photo library)

System will:

upload image to Firebase Storage

run OCR via Google Cloud Vision API server-side

structure the OCR text into a recipe draft (ingredients/instructions/times)

show an editable Import Preview

save into /recipes

Primary success metric: user gets a usable draft with minor edits for most cookbook photos + screenshots.

1) UX Flow
1.1 Entry Points

From “Create Recipe”:

Camera / Photo Import

From other failures:

Browser import failure → “Try photo/screenshot”

Paste text import → optional “Use screenshot instead” (later)

1.2 Screens
A) PhotoImportPickerScreen

Options:

“Take a photo”

“Choose from library”

(v1.1) “Select multiple pages”

After selection:

show PhotoImportCropScreen (recommended) OR go straight to upload (minimum MVP)

B) PhotoImportCropScreen (Recommended even for MVP)

user crops to recipe area

reduces OCR noise/cost

output is a processed image blob

C) PhotoImportUploadingScreen

upload progress

“Cancel” allowed (cancels upload + deletes partial file)

D) Import Progress Modal

Status messages:

“Reading text…”

“Building recipe…”

“Almost done…”

E) ImportPreviewScreen (Shared Component)

Editable:

title

servings/times

ingredients list

instructions steps

tags (optional)
Read-only:

source: “Photo import”

image preview (optional)

CTA:

Save Recipe

Failure screen:

“We couldn’t read a recipe from this image”

Actions: try again, crop tighter, paste text, start from scratch

2) Architecture
Mobile (React Native)

Image selection: expo-image-picker or react-native-image-picker

Crop: expo-image-manipulator or a cropping library

Upload: Firebase Storage SDK

Start job: Firebase callable function startPhotoImport

Track job: Firestore listener on /imports/{importId}

Preview/save: same as other imports

Backend (Firebase)

Firestore: import job state + draft storage

Storage: input image storage (+ optional stored preview)

Cloud Functions:

startPhotoImport (callable)

processPhotoImport (background)

Google Vision AI OCR: call images:annotate (Document Text Detection)

3) Firestore Data Model
3.1 /imports/{importId}
{
  "userId": "uid_123",
  "source": "photo",
  "storagePath": "imports/uid_123/imp_abc.jpg",
  "status": "queued|ocr|extracting|ready|failed",
  "createdAt": 1730000000,
  "updatedAt": 1730000100,
  "errorCode": null,
  "errorMessage": null,
  "result": {
    "recipeDraftId": "draft_123",
    "confidence": 0.78,
    "parser": "vision_ocr+heuristic",
    "warnings": ["Missing servings", "Possible OCR errors"]
  },
  "metrics": {
    "ocrMs": 640,
    "extractMs": 190,
    "imageBytes": 1200340
  }
}

3.2 /recipeDrafts/{draftId}
{
  "userId": "uid_123",
  "source": "photo",
  "importId": "imp_abc",
  "title": "Untitled Recipe",
  "imageStoragePath": "imports/uid_123/imp_abc.jpg",
  "ingredients": [
    { "raw": "2 cups flour", "name": "flour", "quantity": 2, "unit": "cup", "notes": "" }
  ],
  "instructions": [
    { "step": 1, "text": "Mix dry ingredients." }
  ],
  "servings": null,
  "prepMinutes": null,
  "cookMinutes": null,
  "totalMinutes": null,
  "ocrText": null,
  "confidence": 0.78,
  "warnings": ["Missing servings"],
  "createdAt": 1730000000
}


Note on ocrText:

For MVP: store ocrText only if needed for debugging.

If stored, consider truncation + short retention (7–14 days).

4) Storage Layout
4.1 Input images

imports/{userId}/{importId}.jpg

Rules:

limit size (client compress)

set content-type

optionally generate thumbnail for preview

4.2 Optional derived assets

imports/{userId}/{importId}_thumb.jpg

5) Cloud Functions
5.1 Callable: startPhotoImport

Input:

{ "storagePath": "imports/uid_123/imp_abc.jpg" }


Validations:

user authenticated

storagePath belongs to userId

file exists (optional check)

file size <= max (e.g., 6 MB)

rate limit (free vs premium)

Output:

{ "importId": "imp_abc" }


Behavior:

create /imports/{importId} status queued

enqueue background processing processPhotoImport(importId)

5.2 Background: processPhotoImport(importId)

Steps:

set status ocr

read image bytes from Storage

call Vision API OCR (Document Text Detection)

sanitize OCR output (normalize whitespace, fix common OCR mistakes)

set status extracting

parse OCR text into structured recipe (heuristics v1, LLM later optional)

write /recipeDrafts/{draftId}

set import status ready with result metadata

On failure:

set status failed

set errorCode, errorMessage (client-safe)

6) Vision AI OCR Implementation Details
6.1 API Call

Use Google Cloud Vision API images:annotate with DOCUMENT_TEXT_DETECTION.

Prefer returning:

fullTextAnnotation.text

optionally blocks/paragraphs if you want layout analysis later

6.2 Preprocessing (Highly recommended)

On the client (preferred):

resize longest edge to ~1600–2000px

JPEG compress (quality 0.7–0.85)

optional contrast/brightness tweak (later)

Reason: reduces cost + improves OCR reliability for gigantic photos.

6.3 OCR Postprocessing

Clean OCR text:

normalize line breaks

replace common confusions:

I tsp → 1 tsp (context-based)

O → 0 in temperature/time contexts

strip footer/header noise if repeated (optional)

7) Recipe Structuring (Heuristic v1)
7.1 Section detection

Find headings (case-insensitive):

Ingredients

Directions / Instructions / Method / Steps

Prep Time / Cook Time / Total Time

Servings / Yield

If not found:

infer ingredients by lines containing quantities/units

infer steps by numbered lines / sentences longer than X chars

7.2 Ingredient parsing

For each ingredient line:

preserve raw

parse:

quantity (number/fraction)

unit (tsp, tbsp, cup, g, kg, oz, lb, ml, l, etc.)

ingredient name (rest of line)

notes/modifiers (chopped, divided)

If parse fails:

keep raw line as ingredient with null fields

7.3 Instructions parsing

Split into steps by:

numbered patterns ^\d+[\).\s]

otherwise split by blank lines and sentence boundaries

7.4 Confidence scoring

Start 1.0; subtract for:

missing ingredients or < 3 lines

missing instructions or < 2 steps

too much noise / low OCR quality indicators
Return warnings accordingly.

8) Client State Management (Zustand)
8.1 Store shape
type ImportJobState = {
  currentImportId: string | null;
  status: "idle" | "uploading" | "queued" | "ocr" | "extracting" | "ready" | "failed";
  progress: number; // upload only
  error: string | null;

  startPhotoImport: (localUri: string) => Promise<void>;
  cancelImport: () => Promise<void>;
  subscribeToImport: (importId: string) => () => void;
};

8.2 Flow

startPhotoImport(localUri):

compress/resize local image

upload to Storage

call startPhotoImport(storagePath)

subscribe to /imports/{importId}

on ready → navigate to preview with draftId

9) Security Rules
9.1 Firestore

Client can read:

/imports/{importId} only if userId == request.auth.uid

/recipeDrafts/{draftId} only if userId == request.auth.uid

Client cannot write import jobs directly (optional, but recommended).

Client writes only final recipes (/recipes) and user edits in preview.

9.2 Storage

Write only to imports/{uid}/...

Read rules:

allow user to read their own import image for preview

disallow public reads

10) Rate Limits and Cost Controls

Limits (example):

Free: 5 photo imports/day

Premium: unlimited (reasonable abuse protection still)

Controls:

enforce max image size

compress client-side

block repeated retries by hashing image bytes:

if same hash imported within last X minutes, reuse prior draft

11) Error Handling

Error codes:

IMAGE_TOO_LARGE

OCR_NO_TEXT

NO_RECIPE_FOUND

OCR_FAILED

PARSING_FAILED

RATE_LIMITED

UX mapping:

show actionable suggestion:

crop tighter

retake with better light

use paste text

manual entry

12) Testing
Mobile

upload works (camera + library)

cancellation deletes storage object

import job subscription updates UI

preview loads correctly

Backend

OCR integration test with known recipe screenshot

SSR (not needed, but validate storage path ownership)

failure cases: no text, huge image, timeouts

Parser unit tests

section detection cases

ingredient parsing for common formats

instruction splitting

13) Definition of Done

User can import a recipe from a screenshot and save it

Cookbook photo works in good lighting

Crop improves results

No plaintext OTP-style mistakes here: no sensitive data leaks

Import jobs are observable and debuggable (statuses + errors)

14) Cursor Task Checklist

 PhotoImportPickerScreen (camera + library)

 PhotoImportCropScreen (recommended)

 client compression/resize utility

 Storage upload helper

 Zustand import store + Firestore listener

 Cloud Function startPhotoImport

 Cloud Function processPhotoImport with Vision OCR

 Heuristic parser v1

 ImportPreviewScreen reuse + save

 Firestore + Storage security rules