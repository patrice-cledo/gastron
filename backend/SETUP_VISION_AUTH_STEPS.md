# Step 2: Set Up Google Cloud Vision API Authentication

## Current Status
✅ Vision API is enabled  
✅ Vision API client can be initialized  
⚠️ Authentication credentials need to be configured

## Choose Your Setup Method

### Option A: Install gcloud CLI (Recommended for Local Development)

1. **Install Google Cloud SDK**:
   ```bash
   # macOS
   brew install google-cloud-sdk
   
   # Or download from: https://cloud.google.com/sdk/docs/install
   ```

2. **Authenticate**:
   ```bash
   gcloud auth login
   gcloud auth application-default login
   gcloud config set project cookthispage
   ```

3. **Verify**:
   ```bash
   gcloud auth application-default print-access-token
   ```

### Option B: Use Service Account Key (Alternative)

1. **Create service account** (via Google Cloud Console):
   - Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=cookthispage
   - Click "Create Service Account"
   - Name: `vision-api-user`
   - Grant role: `Cloud Vision API User` (or `roles/vision.user`)

2. **Create and download key**:
   - Click on the service account
   - Go to "Keys" tab
   - Click "Add Key" > "Create new key"
   - Choose JSON format
   - Save the file (e.g., `vision-api-key.json`)

3. **Set environment variable**:
   ```bash
   # Add to your .env.local file in backend/
   echo "GOOGLE_APPLICATION_CREDENTIALS=/path/to/vision-api-key.json" >> backend/.env.local
   ```

### Option C: Use Firebase Admin SDK Credentials (If Available)

If you already have Firebase Admin SDK credentials:

```bash
# Set the path to your service account key
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/firebase-service-account-key.json"
```

## For Production Deployment

When you deploy Firebase Cloud Functions, they automatically use the **App Engine default service account**. 

**Verify it has Vision API access:**

1. Go to: https://console.cloud.google.com/iam-admin/iam?project=cookthispage
2. Find: `cookthispage@appspot.gserviceaccount.com`
3. Ensure it has role: `Cloud Vision API User` or `roles/vision.user`

If not, grant it:
```bash
# If you have gcloud installed
gcloud projects add-iam-policy-binding cookthispage \
  --member="serviceAccount:cookthispage@appspot.gserviceaccount.com" \
  --role="roles/vision.user"
```

Or via Console:
- Click "Edit" on the service account
- Click "Add Another Role"
- Select "Cloud Vision API User"
- Save

## Quick Test

After setting up authentication, test it:

```bash
cd backend/functions
node -e "
const {ImageAnnotatorClient} = require('@google-cloud/vision');
const client = new ImageAnnotatorClient();
console.log('✅ Vision API client ready');
"
```

## Next Steps

Once authentication is set up:
- ✅ Step 2: Authentication (you are here)
- Step 3: Test photo import locally
- Step 4: Deploy to production
