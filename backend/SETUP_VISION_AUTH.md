# Setting Up Google Cloud Vision API Authentication

## Step 2: Authentication Setup

For Firebase Cloud Functions, authentication works differently depending on whether you're running locally or in production.

## Production (Deployed Functions)

When you deploy Firebase Cloud Functions, they automatically use the **App Engine default service account**. This service account should already have access to Vision API if you've enabled it.

**To verify/enable Vision API access:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Navigate to **IAM & Admin** > **IAM**
4. Find the service account: `PROJECT_ID@appspot.gserviceaccount.com`
5. Click **Edit** and ensure it has the **Cloud Vision API User** role, or at minimum:
   - `roles/vision.user` (or `roles/ml.developer`)

**Alternatively, grant the role via CLI:**
```bash
# Replace PROJECT_ID with your Firebase project ID
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:PROJECT_ID@appspot.gserviceaccount.com" \
  --role="roles/vision.user"
```

## Local Development (Emulators)

For local development, you need to set up **Application Default Credentials (ADC)**.

### Option 1: Use gcloud CLI (Recommended)

```bash
# Authenticate with your Google account
gcloud auth application-default login

# Set your project
gcloud config set project YOUR_PROJECT_ID
```

This will:
- Authenticate you with your Google account
- Store credentials locally
- Allow the Vision API client to automatically use these credentials

### Option 2: Use Service Account Key File

1. **Create a service account** (if you don't have one):
   ```bash
   gcloud iam service-accounts create vision-api-user \
     --display-name="Vision API User"
   ```

2. **Grant Vision API access**:
   ```bash
   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
     --member="serviceAccount:vision-api-user@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/vision.user"
   ```

3. **Create and download key**:
   ```bash
   gcloud iam service-accounts keys create ~/vision-api-key.json \
     --iam-account=vision-api-user@YOUR_PROJECT_ID.iam.gserviceaccount.com
   ```

4. **Set environment variable**:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="$HOME/vision-api-key.json"
   ```

   Or add to your `.env.local` file:
   ```
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/vision-api-key.json
   ```

### Option 3: Use Firebase Admin SDK Credentials

If you already have Firebase Admin SDK credentials set up, you can reuse them:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="path/to/serviceAccountKey.json"
```

## Verify Setup

Test that authentication works:

```bash
# Test Vision API access
gcloud auth application-default print-access-token

# Or test with a simple Node.js script
node -e "
const {ImageAnnotatorClient} = require('@google-cloud/vision');
const client = new ImageAnnotatorClient();
console.log('✅ Vision API client initialized successfully');
"
```

## Troubleshooting

### Error: "Could not load the default credentials"

**Solution**: Make sure you've run `gcloud auth application-default login` or set `GOOGLE_APPLICATION_CREDENTIALS`.

### Error: "Permission denied" or "403 Forbidden"

**Solution**: Ensure the service account has the `roles/vision.user` role:
```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/vision.user"
```

### Error: "API not enabled"

**Solution**: Make sure Vision API is enabled:
```bash
gcloud services enable vision.googleapis.com
```

## For Your Current Setup

Since you're using Firebase Functions, here's what you need to do:

1. **For local development**:
   ```bash
   cd backend
   gcloud auth application-default login
   gcloud config set project YOUR_FIREBASE_PROJECT_ID
   ```

2. **For production deployment**:
   - The App Engine default service account should already work
   - If not, grant it the Vision API role as shown above

3. **Test locally**:
   ```bash
   cd backend
   npm run firebase:emulators
   # In another terminal, test your photo import function
   ```

## Next Steps

After authentication is set up:
- Step 3: Test the photo import functionality
- Step 4: Deploy functions to production
