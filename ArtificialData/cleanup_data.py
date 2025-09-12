import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random

# Set random seed for reproducibility
np.random.seed(42)
random.seed(42)

print("Starting data cleanup for KMRL induction planning...")

# Helper function for realistic timestamps
def recent_timestamp(days_back=0, hours_back=0):
    base = datetime(2025, 9, 12, 21, 0, 0)  # Sept 12, 2025, 9 PM
    return base - timedelta(days=days_back, hours=hours_back)

# Constants
DEPARTMENTS = ['Rolling-Stock', 'Signalling', 'Telecom']
BAY_TYPES = ['Revenue', 'Standby', 'IBL']
CLEANING_TYPES = ['Deep Clean', 'Interior Detailing', 'Exterior Wash', 'Full Service']
JOB_STATUSES = ['Open', 'Closed', 'In Progress', 'Pending Review']

ADVERTISERS = ['CocaCola', 'Nike', 'Pepsi', 'Apple', 'Samsung', 'Amazon', 'Google', 
              'Microsoft', 'Flipkart', 'Paytm', 'HDFC', 'ICICI', 'SBI', 'Tata Motors', 
              'Mahindra', 'Hyundai', 'Reliance', 'Airtel', 'Jio', 'McDonald']

JOB_DESCRIPTIONS = ['Brake pad replacement', 'HVAC maintenance', 'Door system repair',
                   'Signal equipment check', 'Battery replacement', 'Branding update',
                   'Interior cleaning', 'Exterior wash', 'Wheel inspection',
                   'Safety system test', 'Communication equipment check', 'Bogie maintenance',
                   'Pantograph inspection', 'Emergency brake test', 'LED light replacement']

NOTES_OPTIONS = ['No issues', 'Minor cleaning required', 'Brake pad replacement', 
                'HVAC check', 'Branding update', 'Scheduled maintenance', 
                'Door system check', 'Signal system test', 'Battery replacement',
                'Safety inspection completed', 'Ready for service']

# 1. CREATE USERS (10 total)
print("Creating 10 users with specified roles...")
users_data = []

# 1 Admin
users_data.append({
    'userId': 'user002',
    'lastLogin': recent_timestamp(0, 2).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'createdAt': recent_timestamp(150).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'role': 'Admin'
})

# 1 Supervisor
users_data.append({
    'userId': 'user003',
    'lastLogin': recent_timestamp(0, 1).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'createdAt': recent_timestamp(120).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'role': 'Supervisor'
})

# 2 Maintenance Managers
users_data.extend([
    {
        'userId': 'user008',
        'lastLogin': recent_timestamp(0, 3).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'createdAt': recent_timestamp(100).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'role': 'Maintenance Manager'
    },
    {
        'userId': 'user016',
        'lastLogin': recent_timestamp(0, 4).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'createdAt': recent_timestamp(90).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'role': 'Maintenance Manager'
    }
])

# 6 Operators
for i, user_id in enumerate(['user009', 'user011', 'user015', 'user018', 'user024', 'user030']):
    users_data.append({
        'userId': user_id,
        'lastLogin': recent_timestamp(0, 5 + i).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'createdAt': recent_timestamp(80 + i*10).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'role': 'Operator'
    })

users_df = pd.DataFrame(users_data)
print(f"Generated {len(users_df)} users")

# 2. CREATE TRAINSETS (25 total)
print("Creating 25 trainsets with realistic status distribution...")
trainsets_data = []

# Status distribution: 80% Revenue Service (20), 15% Standby (4), 5% IBL (1)
statuses = (['Revenue Service'] * 20) + (['Standby'] * 4) + (['Inspection Bay Line'] * 1)
random.shuffle(statuses)

for i in range(1, 26):
    trainset_id = f"TS{i:03d}"
    status = statuses[i-1]
    bay_id = f"Bay{i:03d}"
    
    # Realistic timestamps
    last_revenue = recent_timestamp(random.randint(0, 7), random.randint(0, 12))
    last_updated = last_revenue + timedelta(hours=random.randint(1, 6))
    
    trainsets_data.append({
        'trainsetId': trainset_id,
        'fleetNumber': i,
        'currentStatus': status,
        'lastUpdated': last_updated.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'lastRevenueServiceDate': last_revenue.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'stablingPosition': bay_id,
        'notes': random.choice(NOTES_OPTIONS)
    })

trainsets_df = pd.DataFrame(trainsets_data)
print(f"Generated {len(trainsets_df)} trainsets")
print(f"Status distribution: {trainsets_df['currentStatus'].value_counts().to_dict()}")

# 3. CREATE HEALTH AND MAINTENANCE RECORDS
print("Creating health and maintenance records...")
health_maintenance_data = []
job_counter = 1

for trainset in trainsets_df['trainsetId']:
    user_id = random.choice(users_df['userId'])
    
    # 3 Fitness Certificates per trainset
    for dept in DEPARTMENTS:
        # Some certificates might be expired for realism
        start_date = recent_timestamp(random.randint(20, 60))
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
            'updatedAt': recent_timestamp(0, 1).strftime('%Y-%m-%dT%H:%M:%SZ')
        })
    
    # 2-5 Job Cards per trainset
    num_jobs = random.randint(2, 5)
    for j in range(num_jobs):
        job_id = f"JC{job_counter:04d}"
        status = random.choice(JOB_STATUSES)
        description = random.choice(JOB_DESCRIPTIONS)
        
        completion_date = ''
        if status == 'Closed':
            completion_date = recent_timestamp(random.randint(1, 30)).strftime('%Y-%m-%dT%H:%M:%SZ')
        
        health_maintenance_data.append({
            'trainsetId': trainset,
            'category': 'Job Card',
            'department': '',
            'validityWindowStart': '',
            'validityWindowEnd': '',
            'isClear': '',
            'jobCardId': job_id,
            'status': status,
            'description': description,
            'completionDate': completion_date,
            'value': '',
            'lastRecordedDate': '',
            'updatedBy': random.choice(users_df['userId']),
            'updatedAt': recent_timestamp(0, 1).strftime('%Y-%m-%dT%H:%M:%SZ')
        })
        job_counter += 1
    
    # 1 Mileage record per trainset
    mileage = random.randint(80000, 200000)
    last_recorded = recent_timestamp(random.randint(0, 3))
    
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
        'updatedBy': random.choice(users_df['userId']),
        'updatedAt': recent_timestamp(0, 1).strftime('%Y-%m-%dT%H:%M:%SZ')
    })

health_maintenance_df = pd.DataFrame(health_maintenance_data)
print(f"Generated {len(health_maintenance_df)} health and maintenance records")

# 4. CREATE BRANDING PRIORITIES (80% coverage = 20 trainsets)
print("Creating branding priorities...")
branding_data = []
selected_trainsets = random.sample(list(trainsets_df['trainsetId']), 20)

for trainset in selected_trainsets:
    advertiser = random.choice(ADVERTISERS)
    contract_id = f"BR{random.randint(1000, 9999)}"
    required_hours = random.randint(800, 1500)
    exposed_hours = random.randint(int(required_hours * 0.4), int(required_hours * 0.95))
    
    start_date = recent_timestamp(random.randint(60, 120))
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
        'updatedAt': recent_timestamp(0, 1).strftime('%Y-%m-%dT%H:%M:%SZ')
    })

branding_df = pd.DataFrame(branding_data)
print(f"Generated {len(branding_df)} branding priority records")

# 5. CREATE STABLING BAYS (30 total)
print("Creating 30 stabling bays...")
stabling_data = []

for i in range(1, 31):
    bay_id = f"Bay{i:03d}"
    
    # Assign trainsets to first 25 bays, leave 5 empty
    trainset_id = f"TS{i:03d}" if i <= 25 else ''
    
    # Bay type based on trainset status
    if trainset_id:
        trainset_status = trainsets_df[trainsets_df['trainsetId'] == trainset_id]['currentStatus'].iloc[0]
        if trainset_status == 'Revenue Service':
            bay_type = 'Revenue'
        elif trainset_status == 'Standby':
            bay_type = 'Standby'
        else:
            bay_type = 'IBL'
    else:
        bay_type = random.choice(BAY_TYPES)
    
    is_clean = random.choice([True, True, True, False])  # 75% clean
    last_used = recent_timestamp(random.randint(0, 7))
    
    stabling_data.append({
        'bayId': bay_id,
        'trainsetId': trainset_id,
        'bayType': bay_type,
        'isClean': is_clean,
        'lastUsedDate': last_used.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'updatedBy': random.choice(users_df['userId']),
        'updatedAt': recent_timestamp(0, 1).strftime('%Y-%m-%dT%H:%M:%SZ')
    })

stabling_df = pd.DataFrame(stabling_data)
print(f"Generated {len(stabling_df)} stabling bay records")

# 6. CREATE CLEANING SLOTS (Reduced to ~100 for 25 trainsets)
print("Creating cleaning slots...")
cleaning_data = []
base_date = datetime(2025, 9, 12)

# Generate slots for next 5 days
for day_offset in range(5):
    current_date = base_date + timedelta(days=day_offset)
    
    # 8 slots per day (every 3 hours)
    for hour in range(0, 24, 3):
        slot_start = current_date.replace(hour=hour, minute=0, second=0)
        slot_end = slot_start + timedelta(hours=3)
        
        slot_id = f"CS{day_offset+1:02d}{hour//3+1:02d}"
        
        # 60% occupied slots
        is_occupied = random.choice([True, True, True, False, False])
        trainset_id = random.choice(trainsets_df['trainsetId']) if is_occupied else ''
        
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
            'updatedAt': recent_timestamp(0, 1).strftime('%Y-%m-%dT%H:%M:%SZ')
        })

# Add some additional random slots
for i in range(30):
    slot_id = f"CSX{i+1:02d}"
    start_time = recent_timestamp(random.randint(0, 7), random.randint(0, 23))
    end_time = start_time + timedelta(hours=random.choice([2, 3, 4]))
    
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
        'updatedAt': recent_timestamp(0, 1).strftime('%Y-%m-%dT%H:%M:%SZ')
    })

cleaning_df = pd.DataFrame(cleaning_data)
print(f"Generated {len(cleaning_df)} cleaning slot records")

# SAVE ALL FILES
print("\nSaving cleaned data...")
users_df.to_csv('users.csv', index=False)
trainsets_df.to_csv('trainsets.csv', index=False)
health_maintenance_df.to_csv('health_and_maintenance.csv', index=False)
branding_df.to_csv('branding_priorities.csv', index=False)
stabling_df.to_csv('stabling_bays.csv', index=False)
cleaning_df.to_csv('cleaning_slots.csv', index=False)

print("\n✅ DATA CLEANUP COMPLETE!")
print(f"📊 FINAL RECORD COUNTS:")
print(f"- Users: {len(users_df)} (1 Admin, 1 Supervisor, 2 Maintenance Managers, 6 Operators)")
print(f"- Trainsets: {len(trainsets_df)} (80% Revenue Service, 15% Standby, 5% IBL)")
print(f"- Health & Maintenance: {len(health_maintenance_df)}")
print(f"- Branding Priorities: {len(branding_df)} (80% coverage)")
print(f"- Stabling Bays: {len(stabling_df)} (25 occupied, 5 empty)")
print(f"- Cleaning Slots: {len(cleaning_df)}")
print(f"📈 Total Records: {len(users_df) + len(trainsets_df) + len(health_maintenance_df) + len(branding_df) + len(stabling_df) + len(cleaning_df)}")
print("\n🎯 All data is now realistic and consistent with 25 trainsets and 10 users!")
