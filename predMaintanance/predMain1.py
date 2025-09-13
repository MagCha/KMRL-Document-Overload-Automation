import pandas as pd
from sklearn.linear_model import LinearRegression
from datetime import datetime, timedelta
import firebase_admin
from firebase_admin import credentials, firestore

# --- Function to fetch data from Firestore ---
def get_maintenance_data_from_firestore(app_id: str, user_id: str) -> pd.DataFrame:
    """
    Fetches historical maintenance data from the Firestore 'health_and_maintenance' collection.

    This function requires Firebase Admin SDK setup and a service account key for authentication.

    Args:
        app_id (str): The application ID for the Firestore path.
        user_id (str): The user's ID for the Firestore path.

    Returns:
        pd.DataFrame: A DataFrame containing the fetched maintenance records,
                      or an empty DataFrame if an error occurs.
    """
    try:
        # NOTE: You MUST replace 'path/to/your/serviceAccountKey.json' with the actual path
        # to the service account key file downloaded from your Firebase project.
        # This key is required for authentication.
        cred = credentials.Certificate('path/to/your/serviceAccountKey.json')
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)
        
        db = firestore.client()
        
        # Define the collection path based on your schema
        collection_path = f'artifacts/{app_id}/users/{user_id}/health_and_maintenance'
        
        # Query the collection for all documents
        docs = db.collection(collection_path).stream()
        
        # Convert Firestore documents to a list of dictionaries
        data_list = []
        for doc in docs:
            doc_data = doc.to_dict()
            data_list.append(doc_data)
            
        if not data_list:
            print("No data found in the health_and_maintenance collection.")
            return pd.DataFrame()
            
        # Convert the list of dictionaries to a pandas DataFrame
        df = pd.DataFrame(data_list)
        
        print(f"Successfully fetched {len(df)} records from Firestore.")
        return df

    except Exception as e:
        print(f"An error occurred while fetching data from Firestore: {e}")
        return pd.DataFrame()

# --- The MaintenancePredictor class (same as before) ---
class MaintenancePredictor:
    """
    A class to predict the next maintenance date using linear regression based on
    historical maintenance and operational dates.
    """
    def __init__(self, data: pd.DataFrame):
        self.data = data
        self.reference_date = datetime(2020, 1, 1)
        self.model = None

    def _preprocess_data(self, df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
        """
        Preprocesses the input DataFrame by converting date columns to a numerical format.
        """
        for col in ['validityWindowStart', 'validityWindowEnd', 'completionDate', 'lastRecordedDate']:
            # Handle potential non-datetime types or missing values
            df[col] = pd.to_datetime(df[col], errors='coerce')
        
        df.dropna(subset=['completionDate'], inplace=True)
        
        df_processed = df.copy()
        for col in ['validityWindowStart', 'validityWindowEnd', 'lastRecordedDate']:
            df_processed[col] = (df[col] - self.reference_date).dt.days
        
        y = (df_processed['completionDate'] - self.reference_date).dt.days
        
        X = df_processed[['validityWindowStart', 'validityWindowEnd', 'lastRecordedDate']]
        X = X.fillna(X.mean())

        return X, y

    def train_model(self):
        """
        Trains the linear regression model using the provided data.
        """
        try:
            X, y = self._preprocess_data(self.data)
            
            self.model = LinearRegression()
            self.model.fit(X, y)
            
            print("Model training complete.")
        except Exception as e:
            print(f"Error during model training: {e}")
            self.model = None

    def predict_next_maintenance(self, new_data: dict) -> datetime | None:
        """
        Predicts the future maintenance date for a new trainset.
        """
        if not self.model:
            print("Model has not been trained. Please run train_model() first.")
            return None
        
        try:
            new_df = pd.DataFrame([new_data])
            for col in ['validityWindowStart', 'validityWindowEnd', 'lastRecordedDate']:
                new_df[col] = pd.to_datetime(new_df[col], errors='coerce')
                new_df[col] = (new_df[col] - self.reference_date).dt.days
            
            predicted_days = self.model.predict(new_df)
            predicted_date = self.reference_date + timedelta(days=int(predicted_days[0]))
            
            return predicted_date
        except Exception as e:
            print(f"Error during prediction: {e}")
            return None

# --- Main Execution Block ---
if __name__ == "__main__":
    # Define placeholder values for your app ID and user ID
    # In a real application, you would get these from your environment or a login session.
    app_id = "default-app-id"  
    user_id = "your-user-id"

    # 1. Fetch data directly from Firestore
    firestore_data_df = get_maintenance_data_from_firestore(app_id, user_id)

    if not firestore_data_df.empty:
        # 2. Instantiate the predictor with the Firestore data
        predictor = MaintenancePredictor(firestore_data_df)

        # 3. Train the model
        predictor.train_model()

        # 4. Define new data for a trainset to get a prediction
        new_trainset_data = {
            'validityWindowStart': '2025-08-01',
            'validityWindowEnd':   '2025-10-15',
            'lastRecordedDate':    '2025-08-20'
        }

        # 5. Get the prediction
        predicted_maintenance_date = predictor.predict_next_maintenance(new_trainset_data)

        if predicted_maintenance_date:
            print("\n--- Prediction for New Trainset ---")
            print(f"New data attributes: {new_trainset_data}")
            print(f"Predicted maintenance date: {predicted_maintenance_date.strftime('%Y-%m-%d')}")
        else:
            print("\nPrediction failed.")
    else:
        print("Prediction could not be performed due to missing or empty data from Firestore.")
-