import pandas as pd
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class SimpleFirebaseUploader:
    def __init__(self, use_simple_structure=True):
        """Initialize Firebase connection with configurable structure"""
        self.db = None
        self.project_id = os.getenv('FIREBASE_PROJECT_ID', 'k-m-r-lchronos-hn2nri')
        self.app_id = os.getenv('FIREBASE_APP_ID', 'kmrl-hackathon-app')
        self.use_simple_structure = use_simple_structure
        
        # Initialize Firebase Admin SDK
        try:
            cred = credentials.Certificate('firebase-service-account.json')
            firebase_admin.initialize_app(cred, {
                'projectId': self.project_id
            })
            self.db = firestore.client()
            print(f"✅ Connected to Firebase project: {self.project_id}")
            
            if use_simple_structure:
                print("📁 Using SIMPLE structure: /users/user002")
            else:
                print("📁 Using ORGANIZED structure: /artifacts/kmrl-hackathon-app/users/user002")
                
        except Exception as e:
            print(f"❌ Firebase connection failed: {e}")
            raise

    def get_collection_path(self, collection_name, user_id=None, is_public=False):
        """Get collection path based on structure preference"""
        if self.use_simple_structure:
            # Simple structure: /users/user002/trainsets
            if user_id:
                return f"users/{user_id}/{collection_name}"
            elif is_public:
                return f"public/{collection_name}"
            else:
                return collection_name
        else:
            # Organized structure: /artifacts/app/users/user002/trainsets
            if user_id:
                return f"artifacts/{self.app_id}/users/{user_id}/{collection_name}"
            elif is_public:
                return f"artifacts/{self.app_id}/public/data/{collection_name}"
            else:
                return f"artifacts/{self.app_id}/{collection_name}"

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
        print(f"\n📤 Uploading users to: {self.get_collection_path('users')}")
        
        df = pd.read_csv('ArtificialData/users.csv')
        
        uploaded_count = 0
        for _, row in df.iterrows():
            doc_data = {
                'lastLogin': self.convert_timestamp(row['lastLogin']),
                'createdAt': self.convert_timestamp(row['createdAt']),
                'role': row['role']
            }
            
            # Remove None values
            doc_data = {k: v for k, v in doc_data.items() if v is not None}
            
            # Get reference based on structure
            if self.use_simple_structure:
                doc_ref = self.db.document(f"users/{row['userId']}")
            else:
                doc_ref = self.db.document(f"artifacts/{self.app_id}/users/{row['userId']}")
            
            doc_ref.set(doc_data)
            uploaded_count += 1
        
        print(f"✅ Uploaded {uploaded_count} users")
        return df['userId'].tolist()

    def upload_trainsets(self, user_ids):
        """Upload trainsets data to Firestore"""
        admin_user = 'user002'
        collection_path = self.get_collection_path('trainsets', admin_user)
        print(f"\n📤 Uploading trainsets to: {collection_path}")
        
        df = pd.read_csv('ArtificialData/trainsets.csv')
        collection_ref = self.db.collection(collection_path)
        
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
            
            doc_data = {k: v for k, v in doc_data.items() if v is not None}
            collection_ref.document(row['trainsetId']).set(doc_data)
            uploaded_count += 1
        
        print(f"✅ Uploaded {uploaded_count} trainsets")

def main():
    """Test both structures"""
    print("🤔 Which structure do you prefer?")
    print("1. SIMPLE: /users/user002/trainsets")
    print("2. ORGANIZED: /artifacts/kmrl-hackathon-app/users/user002/trainsets")
    
    # For this demo, let's show both
    print("\n" + "="*60)
    print("🧪 TESTING SIMPLE STRUCTURE")
    print("="*60)
    
    uploader_simple = SimpleFirebaseUploader(use_simple_structure=True)
    user_ids = uploader_simple.upload_users()
    uploader_simple.upload_trainsets(user_ids)
    
    print(f"\n🔗 Simple structure view: https://console.firebase.google.com/project/k-m-r-lchronos-hn2nri/firestore")

if __name__ == "__main__":
    main()
