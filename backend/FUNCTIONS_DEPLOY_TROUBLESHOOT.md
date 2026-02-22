# Functions deploy: Eventarc Service Agent error

## What happened

These functions failed to create:

- `onMealPlanEntryChange` (Firestore `onDocumentWritten`)
- `processPhotoImport` (Firestore `onDocumentCreated`)
- `processRecipeImport` (Firestore `onDocumentCreated`)

Error:

```text
Permission denied while using the Eventarc Service Agent. If you recently started
to use Eventarc, it may take a few minutes before all necessary permissions are
propagated to the Service Agent.
```

Firebase 2nd Gen functions that use Firestore triggers (Eventarc) need the **Eventarc Service Agent** to be fully provisioned. Right after enabling the APIs (Cloud Build, Eventarc, Artifact Registry, Cloud Run), that can take a few minutes.

## Fix 1: Wait and retry (try this first)

1. Wait **5–10 minutes**.
2. From the `backend` folder, run:
   ```bash
   firebase deploy --only functions
   ```
3. Only the three failed functions will be created; the rest are already deployed.

## Fix 2: If it still fails – grant Eventarc Service Agent role

1. Open [Google Cloud Console → IAM](https://console.cloud.google.com/iam-admin/iam?project=cookthispage).
2. Turn on **“Include Google-provided role grants”** (top of the table).
3. Find the principal:  
   `PROJECT_NUMBER@gcp-sa-eventarc.iam.gserviceaccount.com`  
   (Project number: [Firebase Console → Project settings](https://console.firebase.google.com/project/cookthispage/settings/general) or GCP Console overview.)
4. If that service agent is missing or has no **Eventarc Service Agent** role:
   - Click **Grant access**.
   - New principals: `PROJECT_NUMBER@gcp-sa-eventarc.iam.gserviceaccount.com`
   - Role: **Eventarc Service Agent**.
   - Save.
5. Wait a couple of minutes, then run again:
   ```bash
   firebase deploy --only functions
   ```

## Summary

- **Cause:** First-time 2nd Gen + Eventarc; service agent permissions not yet propagated.
- **First step:** Wait 5–10 minutes and redeploy.
- **If needed:** Manually add the Eventarc Service Agent role in IAM as above.
