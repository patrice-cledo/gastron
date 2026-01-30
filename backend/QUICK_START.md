# ✅ Step 2 Complete: Authentication Setup

## What We Did
1. ✅ Installed Google Cloud SDK (`gcloud`)
2. ✅ Set project to `cookthispage`
3. ✅ Authenticated with Application Default Credentials

## Credentials Location
Your credentials are saved at:
`~/.config/gcloud/application_default_credentials.json`

These credentials will be automatically used by:
- Google Cloud Vision API client
- Other Google Cloud services
- Firebase Functions (when running locally)

## Next Steps

### Step 3: Test Photo Import Locally

1. **Start Firebase Emulators**:
   ```bash
   cd backend
   npm run firebase:emulators
   ```

2. **In another terminal, test the function** (you'll need to upload an image first):
   ```bash
   # Upload a test image to Storage emulator
   # Then call startPhotoImport function
   ```

### Step 4: Deploy to Production

When you deploy Firebase Functions, they'll automatically use the App Engine default service account. Make sure it has Vision API access:

```bash
# Verify the service account has Vision API access
gcloud projects get-iam-policy cookthispage \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:cookthispage@appspot.gserviceaccount.com"
```

If needed, grant access:
```bash
gcloud projects add-iam-policy-binding cookthispage \
  --member="serviceAccount:cookthispage@appspot.gserviceaccount.com" \
  --role="roles/vision.user"
```

## Testing

You can test Vision API access with:
```bash
cd backend/functions
node -e "const {ImageAnnotatorClient} = require('@google-cloud/vision'); new ImageAnnotatorClient(); console.log('✅ Ready!');"
```

## Troubleshooting

If you get authentication errors:
- Make sure you completed the browser login
- Check credentials: `cat ~/.config/gcloud/application_default_credentials.json`
- Re-authenticate: `gcloud auth application-default login`
