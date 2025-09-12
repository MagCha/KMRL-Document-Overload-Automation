# 🔥 Firebase Integration Guide

## Quick Firebase Access

Your KMRL data is now live on Firebase! Here's how to access it in your algorithms:

### 📦 Installation

```bash
pip install firebase-admin python-dotenv
```

### 🔑 Connection (Already Set Up)

```python
from firebase_config import FIREBASE_CONFIG
import firebase_admin
from firebase_admin import credentials, firestore

# Initialize connection (use existing service account)
cred = credentials.Certificate('firebase-service-account.json')
firebase_admin.initialize_app(cred, {
    'projectId': FIREBASE_CONFIG['projectId']
})
db = firestore.client()
```

### 📊 Data Access Examples

#### Get All Trainsets

```python
trainsets = []
for doc in db.collection('trainsets').stream():
    trainsets.append({**doc.to_dict(), 'id': doc.id})
print(f"Found {len(trainsets)} trainsets")
```

#### Get Health Data for Specific Trainset

```python
health_data = []
query = db.collection('health_and_maintenance').where('trainsetId', '==', 'TS001')
for doc in query.stream():
    health_data.append(doc.to_dict())
```

#### Get Available Cleaning Slots

```python
available_slots = []
query = db.collection('cleaning_slots').where('isOccupied', '==', False)
for doc in query.stream():
    available_slots.append(doc.to_dict())
```

#### Get Branding Contracts Needing Exposure

```python
# Find contracts where exposure < 80% of requirement
contracts = []
for doc in db.collection('branding_priorities').stream():
    data = doc.to_dict()
    exposure_ratio = data['hoursExposedToDate'] / data['contractualHoursRequired']
    if exposure_ratio < 0.8:  # Less than 80% exposed
        contracts.append({**data, 'exposure_ratio': exposure_ratio})
```

### 🎯 Collections Available

| Collection                 | Path                      | Records | Purpose                       |
| -------------------------- | ------------------------- | ------- | ----------------------------- |
| **users**                  | `/users`                  | 10      | User roles and authentication |
| **trainsets**              | `/trainsets`              | 25      | Fleet status and positioning  |
| **health_and_maintenance** | `/health_and_maintenance` | 190     | Certificates, jobs, mileage   |
| **branding_priorities**    | `/branding_priorities`    | 25      | Advertising contracts         |
| **stabling_bays**          | `/stabling_bays`          | 30      | Physical bay assignments      |
| **cleaning_slots**         | `/cleaning_slots`         | 70      | Maintenance scheduling        |

### 🔗 Firebase Console

View live data: https://console.firebase.google.com/project/k-m-r-lchronos-hn2nri/firestore

### 📈 Ready for Algorithm Development!

Your optimization algorithms can now work with live, validated data directly from Firebase. No more CSV parsing - just query what you need!
