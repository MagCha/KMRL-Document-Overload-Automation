# Firebase Integration for KMRL Induction Planning System

## 🔥 Setup Instructions

### 1. Install Required Packages

```bash
pip install firebase-admin pandas python-dotenv
```

### 2. Firebase Project Setup

1. **Create Firebase Project**:

   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Click "Add project"
   - Enter project name: `kmrl-induction-planning`
   - Disable Google Analytics (optional for hackathon)

2. **Enable Firestore**:

   - In Firebase console, go to "Firestore Database"
   - Click "Create database"
   - Start in "Test mode" (for hackathon)
   - Choose location closest to you

3. **Generate Service Account Key**:
   - Go to Project Settings → Service Accounts
   - Click "Generate new private key"
   - Download the JSON file
   - Save as `firebase-service-account.json` in project root
   - **IMPORTANT**: Add this file to `.gitignore`

### 3. Environment Configuration

Create `.env` file in project root:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_APP_ID=kmrl-hackathon-app
```

### 4. Security Rules (Firestore)

In Firebase Console → Firestore → Rules, set:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write for hackathon - CHANGE FOR PRODUCTION
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

## 🚀 Usage

1. Complete setup steps above
2. Run the upload script:

```bash
python firebase_uploader.py
```

3. Check Firebase Console to verify data upload
4. Use the returned project configuration in your app

## 📁 Generated Files

- `firebase-service-account.json` (DO NOT COMMIT)
- `.env` (DO NOT COMMIT)
- Firebase connection established and data uploaded

## ⚠️ Security Notes

- Service account key contains sensitive credentials
- Test mode rules allow public access - change for production
- Consider using Firebase Auth for user management in production
