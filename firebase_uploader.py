import pandas as pd
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class FirebaseUploader:
    def __init__(self):
        """Initialize Firebase connection"""
        self.db = None
        self.project_id = os.getenv('FIREBASE_PROJECT_ID', 'kmrl-induction-planning')
        self.app_id = os.getenv('FIREBASE_APP_ID', 'kmrl-hackathon-app')
        
        # Initialize Firebase Admin SDK
        try:
            # Use service account key file
            cred = credentials.Certificate('firebase-service-account.json')
            firebase_admin.initialize_app(cred, {
                'projectId': self.project_id
            })
            self.db = firestore.client()
            print(f"✅ Connected to Firebase project: {self.project_id}")
        except Exception as e:
            print(f"❌ Firebase connection failed: {e}")
            print("📋 Make sure you have:")
            print("   1. Created firebase-service-account.json")
            print("   2. Set up .env file with project details")
            print("   3. Installed firebase-admin package")
            raise

    def convert_timestamp(self, timestamp_str):
        """Convert CSV timestamp to Firestore timestamp"""
        if pd.isna(timestamp_str) or timestamp_str == '':
            return None
        try:
            return datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        except:
            return None

    def convert_boolean(self, bool_str):
        """Convert CSV boolean to Python boolean"""
        if pd.isna(bool_str) or bool_str == '':
            return None
        return str(bool_str).lower() == 'true'

    def upload_users(self):
        """Upload users data to Firestore"""
        print("\n📤 Uploading users...")
        
        df = pd.read_csv('ArtificialData/users.csv')
        collection_ref = self.db.collection('users')
        
        uploaded_count = 0
        for _, row in df.iterrows():
            doc_data = {
                'lastLogin': self.convert_timestamp(row['lastLogin']),
                'createdAt': self.convert_timestamp(row['createdAt']),
                'role': row['role']
            }
            
            # Remove None values
            doc_data = {k: v for k, v in doc_data.items() if v is not None}
            
            collection_ref.document(row['userId']).set(doc_data)
            uploaded_count += 1
        
        print(f"✅ Uploaded {uploaded_count} users")
        return df['userId'].tolist()

    def upload_trainsets(self, user_ids):
        """Upload trainsets data to Firestore"""
        print("\n📤 Uploading trainsets...")
        
        df = pd.read_csv('ArtificialData/trainsets.csv')
        
        # Direct collection at root level
        collection_ref = self.db.collection('trainsets')
        
        uploaded_count = 0
        for _, row in df.iterrows():
            doc_data = {
                'trainsetId': row['trainsetId'],
                'fleetNumber': int(row['fleetNumber']),
                'currentStatus': row['currentStatus'],
                'lastUpdated': self.convert_timestamp(row['lastUpdated']),
                'lastRevenueServiceDate': self.convert_timestamp(row['lastRevenueServiceDate']),
                'stablingPosition': row['stablingPosition'],
                'notes': row['notes']
            }
            
            # Remove None values
            doc_data = {k: v for k, v in doc_data.items() if v is not None}
            
            collection_ref.document(row['trainsetId']).set(doc_data)
            uploaded_count += 1
        
        print(f"✅ Uploaded {uploaded_count} trainsets")

    def upload_health_maintenance(self, user_ids):
        """Upload health and maintenance data to Firestore"""
        print("\n📤 Uploading health and maintenance records...")
        
        df = pd.read_csv('ArtificialData/health_and_maintenance.csv')
        
        # Direct collection at root level
        collection_ref = self.db.collection('health_and_maintenance')
        
        uploaded_count = 0
        for _, row in df.iterrows():
            doc_data = {
                'trainsetId': row['trainsetId'],
                'category': row['category'],
                'updatedBy': row['updatedBy'],
                'updatedAt': self.convert_timestamp(row['updatedAt'])
            }
            
            # Add category-specific fields
            if row['category'] == 'Fitness Certificate':
                doc_data.update({
                    'department': row['department'],
                    'validityWindowStart': self.convert_timestamp(row['validityWindowStart']),
                    'validityWindowEnd': self.convert_timestamp(row['validityWindowEnd']),
                    'isClear': self.convert_boolean(row['isClear'])
                })
            elif row['category'] == 'Job Card':
                doc_data.update({
                    'jobCardId': row['jobCardId'],
                    'status': row['status'],
                    'description': row['description']
                })
                if pd.notna(row['completionDate']) and row['completionDate'] != '':
                    doc_data['completionDate'] = self.convert_timestamp(row['completionDate'])
            elif row['category'] == 'Mileage':
                doc_data.update({
                    'value': int(row['value']) if pd.notna(row['value']) else None,
                    'lastRecordedDate': self.convert_timestamp(row['lastRecordedDate'])
                })
            
            # Remove None values
            doc_data = {k: v for k, v in doc_data.items() if v is not None}
            
            collection_ref.add(doc_data)
            uploaded_count += 1
        
        print(f"✅ Uploaded {uploaded_count} health and maintenance records")

    def upload_branding_priorities(self):
        """Upload branding priorities to public collection"""
        print("\n📤 Uploading branding priorities...")
        
        df = pd.read_csv('ArtificialData/branding_priorities.csv')
        collection_ref = self.db.collection('branding_priorities')
        
        uploaded_count = 0
        for _, row in df.iterrows():
            doc_data = {
                'trainsetId': row['trainsetId'],
                'advertiser': row['advertiser'],
                'contractId': row['contractId'],
                'contractualHoursRequired': int(row['contractualHoursRequired']),
                'hoursExposedToDate': int(row['hoursExposedToDate']),
                'startDate': self.convert_timestamp(row['startDate']),
                'endDate': self.convert_timestamp(row['endDate']),
                'updatedBy': row['updatedBy'],
                'updatedAt': self.convert_timestamp(row['updatedAt'])
            }
            
            # Remove None values
            doc_data = {k: v for k, v in doc_data.items() if v is not None}
            
            collection_ref.add(doc_data)
            uploaded_count += 1
        
        print(f"✅ Uploaded {uploaded_count} branding priorities")

    def upload_stabling_bays(self, user_ids):
        """Upload stabling bays data to Firestore"""
        print("\n📤 Uploading stabling bays...")
        
        df = pd.read_csv('ArtificialData/stabling_bays.csv')
        
        # Direct collection at root level
        collection_ref = self.db.collection('stabling_bays')
        
        uploaded_count = 0
        for _, row in df.iterrows():
            doc_data = {
                'bayId': row['bayId'],
                'bayType': row['bayType'],
                'isClean': self.convert_boolean(row['isClean']),
                'lastUsedDate': self.convert_timestamp(row['lastUsedDate']),
                'updatedBy': row['updatedBy'],
                'updatedAt': self.convert_timestamp(row['updatedAt'])
            }
            
            # Add trainsetId if not empty
            if pd.notna(row['trainsetId']) and row['trainsetId'] != '':
                doc_data['trainsetId'] = row['trainsetId']
            
            # Remove None values
            doc_data = {k: v for k, v in doc_data.items() if v is not None}
            
            collection_ref.document(row['bayId']).set(doc_data)
            uploaded_count += 1
        
        print(f"✅ Uploaded {uploaded_count} stabling bays")

    def upload_cleaning_slots(self, user_ids):
        """Upload cleaning slots data to Firestore"""
        print("\n📤 Uploading cleaning slots...")
        
        df = pd.read_csv('ArtificialData/cleaning_slots.csv')
        
        # Direct collection at root level
        collection_ref = self.db.collection('cleaning_slots')
        
        uploaded_count = 0
        for _, row in df.iterrows():
            doc_data = {
                'slotId': row['slotId'],
                'startTime': self.convert_timestamp(row['startTime']),
                'endTime': self.convert_timestamp(row['endTime']),
                'isOccupied': self.convert_boolean(row['isOccupied']),
                'manpowerAllocated': int(row['manpowerAllocated']),
                'type': row['type'],
                'updatedBy': row['updatedBy'],
                'updatedAt': self.convert_timestamp(row['updatedAt'])
            }
            
            # Add trainsetId if not empty
            if pd.notna(row['trainsetId']) and row['trainsetId'] != '':
                doc_data['trainsetId'] = row['trainsetId']
            
            # Remove None values
            doc_data = {k: v for k, v in doc_data.items() if v is not None}
            
            collection_ref.add(doc_data)
            uploaded_count += 1
        
        print(f"✅ Uploaded {uploaded_count} cleaning slots")

    def upload_all_data(self):
        """Upload all CSV data to Firestore"""
        print("🚀 Starting Firebase data upload...")
        print(f"📊 Target: {self.project_id}")
        
        try:
            # Upload in dependency order
            user_ids = self.upload_users()
            self.upload_trainsets(user_ids)
            self.upload_health_maintenance(user_ids)
            self.upload_branding_priorities()
            self.upload_stabling_bays(user_ids)
            self.upload_cleaning_slots(user_ids)
            
            print("\n🎉 All data uploaded successfully!")
            print(f"🔗 View your data at: https://console.firebase.google.com/project/{self.project_id}/firestore")
            
            # Return connection details for app
            return {
                'projectId': self.project_id,
                'appId': self.app_id,
                'collections': {
                    'users': 'users',
                    'trainsets': 'trainsets',
                    'health_and_maintenance': 'health_and_maintenance',
                    'branding_priorities': 'branding_priorities',
                    'stabling_bays': 'stabling_bays',
                    'cleaning_slots': 'cleaning_slots'
                }
            }
            
        except Exception as e:
            print(f"❌ Upload failed: {e}")
            raise

def main():
    """Main execution function"""
    # Check if required files exist
    required_files = [
        'firebase-service-account.json',
        'ArtificialData/users.csv',
        'ArtificialData/trainsets.csv',
        'ArtificialData/health_and_maintenance.csv',
        'ArtificialData/branding_priorities.csv',
        'ArtificialData/stabling_bays.csv',
        'ArtificialData/cleaning_slots.csv'
    ]
    
    missing_files = [f for f in required_files if not os.path.exists(f)]
    if missing_files:
        print("❌ Missing required files:")
        for file in missing_files:
            print(f"   - {file}")
        print("\n📋 Please check FIREBASE_SETUP.md for setup instructions")
        return
    
    # Upload data
    uploader = FirebaseUploader()
    config = uploader.upload_all_data()
    
    # Save config for app use
    print("\n📁 Firebase configuration saved to firebase_config.py")
    with open('firebase_config.py', 'w') as f:
        f.write("# Firebase Configuration for KMRL Induction Planning\n")
        f.write(f"# Generated: {datetime.now().isoformat()}\n\n")
        f.write(f"FIREBASE_CONFIG = {config}\n")

if __name__ == "__main__":
    main()
