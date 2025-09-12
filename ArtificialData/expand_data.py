import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random
import string

# Set random seed for reproducibility
np.random.seed(42)
random.seed(42)

# Helper functions
def random_date_between(start_date, end_date):
    time_between = end_date - start_date
    days_between = time_between.days
    random_days = random.randrange(days_between)
    return start_date + timedelta(days=random_days)

def random_timestamp_between(start_dt, end_dt):
    time_between = end_dt - start_dt
    random_seconds = random.randrange(int(time_between.total_seconds()))
    return start_dt + timedelta(seconds=random_seconds)

# Constants from GTFS data
STATIONS = ['ALVA', 'PNCU', 'CPPY', 'ATTK', 'MUTT', 'KLMT', 'CCUV', 'PDPM', 
           'EDAP', 'CGPP', 'PARV', 'JLSD', 'KALR', 'TNHL', 'MGRD', 'MACE', 
           'ERSH', 'KVTR', 'EMKM', 'VYTA', 'THYK', 'PETT', 'VAKK', 'SNJN', 'TPHT']

ADVERTISERS = ['CocaCola', 'Nike', 'Pepsi', 'Apple', 'Samsung', 'Amazon', 'Google', 
              'Microsoft', 'Facebook', 'Twitter', 'McDonald', 'KFC', 'Subway', 
              'Dominos', 'Pizza Hut', 'Zomato', 'Swiggy', 'Flipkart', 'Paytm', 
              'PhonePe', 'HDFC', 'ICICI', 'SBI', 'Axis Bank', 'Kotak', 'Bajaj',
              'Tata Motors', 'Mahindra', 'Hyundai', 'Toyota', 'Honda', 'Maruti',
              'Reliance', 'Airtel', 'Jio', 'Vodafone', 'BSNL', 'Vi', 'Idea']

DEPARTMENTS = ['Rolling-Stock', 'Signalling', 'Telecom', 'Electrical', 'Civil']
BAY_TYPES = ['Revenue', 'Standby', 'IBL']
CLEANING_TYPES = ['Deep Clean', 'Interior Detailing', 'Exterior Wash', 'Full Service']
STATUSES = ['Revenue Service', 'Standby', 'Inspection Bay Line']
JOB_STATUSES = ['Open', 'Closed', 'In Progress', 'Pending Review']
ROLES = ['Supervisor', 'Admin', 'Operator', 'Maintenance Manager']

print("Generating expanded artificial data...")

# 1. Generate Users (50 users)
users_data = []
for i in range(1, 51):
    user_id = f"user{i:03d}"
    role = random.choice(ROLES)
    created_at = random_date_between(datetime(2025, 1, 1), datetime(2025, 8, 1))
    last_login = random_date_between(datetime(2025, 9, 1), datetime(2025, 9, 12))
    
    users_data.append({
        'userId': user_id,
        'lastLogin': last_login.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'createdAt': created_at.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'role': role
    })

users_df = pd.DataFrame(users_data)
users_df.to_csv('users.csv', index=False)
print(f"Generated {len(users_df)} users")

# 2. Generate Trainsets (50 trainsets)
trainsets_data = []
for i in range(1, 51):
    trainset_id = f"TS{i:03d}"
    fleet_number = i
    status = random.choice(STATUSES)
    bay_id = f"Bay{i:03d}"
    
    # Generate realistic timestamps
    last_revenue = random_date_between(datetime(2025, 9, 1), datetime(2025, 9, 12))
    last_updated = last_revenue + timedelta(hours=random.randint(1, 24))
    
    notes_options = ['No issues', 'Minor cleaning required', 'Brake pad replacement', 
                    'HVAC check', 'Branding update', 'Scheduled maintenance', 
                    'Door system check', 'Signal system test', 'Battery replacement']
    
    trainsets_data.append({
        'trainsetId': trainset_id,
        'fleetNumber': fleet_number,
        'currentStatus': status,
        'lastUpdated': last_updated.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'lastRevenueServiceDate': last_revenue.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'stablingPosition': bay_id,
        'notes': random.choice(notes_options)
    })

trainsets_df = pd.DataFrame(trainsets_data)
trainsets_df.to_csv('trainsets.csv', index=False)
print(f"Generated {len(trainsets_df)} trainsets")

# 3. Generate Health and Maintenance (1500+ records)
health_maintenance_data = []
record_id = 1

for trainset in trainsets_df['trainsetId']:
    user_id = random.choice(users_df['userId'])
    
    # Fitness Certificates (3 per trainset - one for each department)
    for dept in ['Rolling-Stock', 'Signalling', 'Telecom']:
        start_date = random_date_between(datetime(2025, 8, 1), datetime(2025, 9, 1))
        end_date = start_date + timedelta(days=30)
        is_clear = random.choice([True, True, True, False])  # 75% clear
        
        health_maintenance_data.append({
            'trainsetId': trainset,
            'category': 'Fitness Certificate',
            'department': dept,
            'validityWindowStart': start_date.strftime('%Y-%m-%dT%H:%M:%SZ'),
            'validityWindowEnd': end_date.strftime('%Y-%m-%dT%H:%M:%SZ'),
            'isClear': is_clear,
            'jobCardId': '',
            'status': '',
            'description': '',
            'completionDate': '',
            'value': '',
            'lastRecordedDate': '',
            'updatedBy': user_id,
            'updatedAt': datetime.now().strftime('%Y-%m-%dT%H:%M:%SZ')
        })
    
    # Job Cards (2-5 per trainset)
    num_jobs = random.randint(2, 5)
    for j in range(num_jobs):
        job_id = f"JC{record_id:04d}"
        status = random.choice(JOB_STATUSES)
        descriptions = ['Brake pad replacement', 'HVAC maintenance', 'Door system repair',
                       'Signal equipment check', 'Battery replacement', 'Branding update',
                       'Interior cleaning', 'Exterior wash', 'Wheel inspection',
                       'Safety system test', 'Communication equipment check']
        
        completion_date = ''
        if status == 'Closed':
            completion_date = random_date_between(datetime(2025, 8, 1), datetime(2025, 9, 12)).strftime('%Y-%m-%dT%H:%M:%SZ')
        
        health_maintenance_data.append({
            'trainsetId': trainset,
            'category': 'Job Card',
            'department': '',
            'validityWindowStart': '',
            'validityWindowEnd': '',
            'isClear': '',
            'jobCardId': job_id,
            'status': status,
            'description': random.choice(descriptions),
            'completionDate': completion_date,
            'value': '',
            'lastRecordedDate': '',
            'updatedBy': user_id,
            'updatedAt': datetime.now().strftime('%Y-%m-%dT%H:%M:%SZ')
        })
        record_id += 1
    
    # Mileage records (1 per trainset)
    mileage = random.randint(80000, 200000)
    last_recorded = random_date_between(datetime(2025, 9, 10), datetime(2025, 9, 12))
    
    health_maintenance_data.append({
        'trainsetId': trainset,
        'category': 'Mileage',
        'department': '',
        'validityWindowStart': '',
        'validityWindowEnd': '',
        'isClear': '',
        'jobCardId': '',
        'status': '',
        'description': '',
        'completionDate': '',
        'value': mileage,
        'lastRecordedDate': last_recorded.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'updatedBy': user_id,
        'updatedAt': datetime.now().strftime('%Y-%m-%dT%H:%M:%SZ')
    })

health_maintenance_df = pd.DataFrame(health_maintenance_data)
health_maintenance_df.to_csv('health_and_maintenance.csv', index=False)
print(f"Generated {len(health_maintenance_df)} health and maintenance records")

# 4. Generate Branding Priorities (80% of trainsets have branding)
branding_data = []
selected_trainsets = random.sample(list(trainsets_df['trainsetId']), int(len(trainsets_df) * 0.8))

for trainset in selected_trainsets:
    advertiser = random.choice(ADVERTISERS)
    contract_id = f"BR{random.randint(1000, 9999)}"
    required_hours = random.randint(800, 1500)
    exposed_hours = random.randint(int(required_hours * 0.5), int(required_hours * 0.95))
    
    start_date = random_date_between(datetime(2025, 7, 1), datetime(2025, 8, 15))
    end_date = start_date + timedelta(days=random.randint(90, 180))
    
    branding_data.append({
        'trainsetId': trainset,
        'advertiser': advertiser,
        'contractId': contract_id,
        'contractualHoursRequired': required_hours,
        'hoursExposedToDate': exposed_hours,
        'startDate': start_date.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'endDate': end_date.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'updatedBy': random.choice(users_df['userId']),
        'updatedAt': datetime.now().strftime('%Y-%m-%dT%H:%M:%SZ')
    })

branding_df = pd.DataFrame(branding_data)
branding_df.to_csv('branding_priorities.csv', index=False)
print(f"Generated {len(branding_df)} branding priority records")

# 5. Generate Stabling Bays (60 bays total)
stabling_data = []
for i in range(1, 61):
    bay_id = f"Bay{i:03d}"
    
    # 80% occupied, 20% empty
    is_occupied = random.choice([True, True, True, True, False])
    trainset_id = ''
    if is_occupied and i <= len(trainsets_df):
        trainset_id = f"TS{i:03d}"
    
    bay_type = random.choice(BAY_TYPES)
    is_clean = random.choice([True, True, True, False])  # 75% clean
    last_used = random_date_between(datetime(2025, 9, 1), datetime(2025, 9, 12))
    
    stabling_data.append({
        'bayId': bay_id,
        'trainsetId': trainset_id,
        'bayType': bay_type,
        'isClean': is_clean,
        'lastUsedDate': last_used.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'updatedBy': random.choice(users_df['userId']),
        'updatedAt': datetime.now().strftime('%Y-%m-%dT%H:%M:%SZ')
    })

stabling_df = pd.DataFrame(stabling_data)
stabling_df.to_csv('stabling_bays.csv', index=False)
print(f"Generated {len(stabling_df)} stabling bay records")

# 6. Generate Cleaning Slots (200 slots across multiple days)
cleaning_data = []
base_date = datetime(2025, 9, 12)

for day_offset in range(7):  # 7 days of slots
    current_date = base_date + timedelta(days=day_offset)
    
    # Generate slots throughout the day (every 2 hours)
    for hour in range(0, 24, 2):
        slot_start = current_date.replace(hour=hour, minute=0, second=0)
        slot_end = slot_start + timedelta(hours=2)
        
        slot_id = f"CS{day_offset+1:02d}{hour:02d}"
        
        # 60% occupied slots
        is_occupied = random.choice([True, True, True, False, False])
        trainset_id = ''
        if is_occupied:
            trainset_id = random.choice(trainsets_df['trainsetId'])
        
        manpower = random.randint(2, 5)
        cleaning_type = random.choice(CLEANING_TYPES)
        
        cleaning_data.append({
            'slotId': slot_id,
            'startTime': slot_start.strftime('%Y-%m-%dT%H:%M:%SZ'),
            'endTime': slot_end.strftime('%Y-%m-%dT%H:%M:%SZ'),
            'isOccupied': is_occupied,
            'trainsetId': trainset_id,
            'manpowerAllocated': manpower,
            'type': cleaning_type,
            'updatedBy': random.choice(users_df['userId']),
            'updatedAt': datetime.now().strftime('%Y-%m-%dT%H:%M:%SZ')
        })

# Add some random additional slots for variety
for i in range(100):
    slot_id = f"CS{i+200:03d}"
    start_time = random_timestamp_between(
        datetime(2025, 9, 12), 
        datetime(2025, 9, 19)
    )
    end_time = start_time + timedelta(hours=random.choice([1, 2, 3, 4]))
    
    is_occupied = random.choice([True, False])
    trainset_id = random.choice(trainsets_df['trainsetId']) if is_occupied else ''
    
    cleaning_data.append({
        'slotId': slot_id,
        'startTime': start_time.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'endTime': end_time.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'isOccupied': is_occupied,
        'trainsetId': trainset_id,
        'manpowerAllocated': random.randint(1, 6),
        'type': random.choice(CLEANING_TYPES),
        'updatedBy': random.choice(users_df['userId']),
        'updatedAt': datetime.now().strftime('%Y-%m-%dT%H:%M:%SZ')
    })

cleaning_df = pd.DataFrame(cleaning_data)
cleaning_df.to_csv('cleaning_slots.csv', index=False)
print(f"Generated {len(cleaning_df)} cleaning slot records")

print("\nData generation complete!")
print(f"Total records generated:")
print(f"- Users: {len(users_df)}")
print(f"- Trainsets: {len(trainsets_df)}")
print(f"- Health & Maintenance: {len(health_maintenance_df)}")
print(f"- Branding Priorities: {len(branding_df)}")
print(f"- Stabling Bays: {len(stabling_df)}")
print(f"- Cleaning Slots: {len(cleaning_df)}")
print(f"Grand Total: {len(users_df) + len(trainsets_df) + len(health_maintenance_df) + len(branding_df) + len(stabling_df) + len(cleaning_df)} records")
