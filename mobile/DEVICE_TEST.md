# Run the app on your phone with cloud Firebase

Use this to get an installable build and test against your real Firebase project (not emulators).

---

## 1. Prerequisites

- **Expo account** (free): https://expo.dev/signup  
- **EAS CLI** (one-time):
  ```bash
  npm install -g eas-cli
  eas login
  ```
- **Firebase config** for your cloud project (from Firebase Console → Project settings → Your apps).

---

## 2. Firebase config for the build

The app reads Firebase from environment variables. EAS Build runs in the cloud, so `.env` is **not** uploaded. Use one of these:

**Option A – EAS environment variables (recommended for EAS Build)**

From the `mobile` folder, create variables for the **preview** environment (used by the preview profile):

```bash
cd mobile
eas env:create --name EXPO_PUBLIC_FIREBASE_API_KEY --value "your-api-key" --environment preview --visibility plaintext --force
eas env:create --name EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN --value "your-project.firebaseapp.com" --environment preview --visibility plaintext --force
eas env:create --name EXPO_PUBLIC_FIREBASE_PROJECT_ID --value "your-project-id" --environment preview --visibility plaintext --force
eas env:create --name EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET --value "your-project.appspot.com" --environment preview --visibility plaintext --force
eas env:create --name EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID --value "123456789" --environment preview --visibility plaintext --force
eas env:create --name EXPO_PUBLIC_FIREBASE_APP_ID --value "1:123456789:web:abcdef" --environment preview --visibility plaintext --force
```

Replace the values with your Firebase project’s web app config (Firebase Console → Project settings → Your apps).

Then tell the preview profile to use that environment by adding to `eas.json` under `build.preview`:

```json
"preview": {
  "distribution": "internal",
  "environment": "preview",
  ...
}
```

**Option B – `.env` for local builds only**

If you run `eas build --local`, your shell can load `mobile/.env`. Copy `mobile/.env.example` to `mobile/.env`, fill in real values, and keep `.env` out of git (it’s already in `.gitignore`). This does **not** apply to builds run on EAS servers.

---

## 3. Link the project to EAS (one-time)

From the `mobile` folder:

```bash
cd mobile
eas build:configure
```

If EAS asks to create a project, confirm so the app is linked to your Expo account. The existing `eas.json` is kept.

---

## 4. Build an installable app

**Android (easiest – get an APK):**

```bash
cd mobile
eas build --profile preview --platform android
```

When the build finishes, Expo shows a link to download the **APK**. Open that link on your Android phone (or download on computer and transfer) and install. No Play Store needed.

**iOS (needs Apple Developer account):**

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/) (paid).
2. Register the device:
   ```bash
   eas device:create
   ```
   Follow the prompts and add your iPhone.
3. Build:
   ```bash
   eas build --profile preview --platform ios
   ```
4. When the build is done, open the build page on your iPhone and install the profile + app (or use the link EAS emails you).

---

## 5. What “preview” does

- **preview** in `eas.json` is set up so that:
  - The app uses **cloud Firebase** (emulators are off).
  - **Android**: builds an APK you can install directly (internal distribution).
  - **iOS**: builds an IPA for internal distribution (registered devices only).

So the build you install on your phone talks to your real Firebase project, not the emulators.

---

## 6. Optional: development build (Metro + cloud Firebase)

If you want to run the app from your dev server (Metro) on the phone but still use cloud Firebase:

1. Install the dev client in the project:
   ```bash
   cd mobile
   npx expo install expo-dev-client
   ```
2. Build a development client:
   ```bash
   eas build --profile development --platform android
   ```
   (or `--platform ios` for iOS; device must be registered for iOS.)
3. Install the built APK/IPA on your phone.
4. Start the dev server:
   ```bash
   npm start
   ```
5. Open the “Gastrons” dev client on the phone and connect to your machine (same Wi‑Fi or tunnel). The app will use cloud Firebase because `EXPO_PUBLIC_USE_FIREBASE_EMULATOR` is set to `false` in the development profile.

---

## Quick reference

| Goal                         | Command                                              |
|-----------------------------|------------------------------------------------------|
| APK for Android (cloud)     | `eas build --profile preview --platform android`     |
| IPA for iOS (cloud)         | `eas build --profile preview --platform ios`         |
| Dev build (Metro + cloud)   | Install `expo-dev-client`, then `eas build --profile development --platform android` (or ios) |

Build status and download links: https://expo.dev/accounts/[your-account]/projects/gastrons/builds
