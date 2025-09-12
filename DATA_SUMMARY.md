# Data Summary - KMRL Induction Planning Dataset

## 📊 Dataset Overview

**Generated**: September 12, 2025, 9:00 PM  
**Total Records**: 365 across 6 collections  
**Status**: Production-ready for AI/ML algorithms

---

## 📋 Collection Details

### 1. **users.csv** - 10 Records

**Purpose**: User management and role-based access control

| Field     | Type      | Description                                   |
| --------- | --------- | --------------------------------------------- |
| userId    | String    | Unique identifier (user002, user003, etc.)    |
| lastLogin | Timestamp | Most recent login (2025-09-12 format)         |
| createdAt | Timestamp | Account creation date                         |
| role      | String    | Admin/Supervisor/Maintenance Manager/Operator |

**Distribution**: 1 Admin, 1 Supervisor, 2 Maintenance Managers, 6 Operators

### 2. **trainsets.csv** - 25 Records

**Purpose**: Core trainset information and current operational status

| Field                  | Type      | Description                                 |
| ---------------------- | --------- | ------------------------------------------- |
| trainsetId             | String    | Unique ID (TS001-TS025)                     |
| fleetNumber            | Number    | Sequential fleet number (1-25)              |
| currentStatus          | String    | Revenue Service/Standby/Inspection Bay Line |
| lastUpdated            | Timestamp | Last status change                          |
| lastRevenueServiceDate | Timestamp | Most recent service operation               |
| stablingPosition       | String    | Current bay assignment (Bay001-Bay025)      |
| notes                  | String    | Operational notes and issues                |

**Status Distribution**:

- Revenue Service: 20 trainsets (80%)
- Standby: 4 trainsets (15%)
- Inspection Bay Line: 1 trainset (5%)

### 3. **health_and_maintenance.csv** - 190 Records

**Purpose**: Comprehensive maintenance tracking and fitness certification

| Field               | Type      | Description                                          |
| ------------------- | --------- | ---------------------------------------------------- |
| trainsetId          | String    | Links to trainsets.csv                               |
| category            | String    | Fitness Certificate/Job Card/Mileage                 |
| department          | String    | Rolling-Stock/Signalling/Telecom (certificates only) |
| validityWindowStart | Timestamp | Certificate start date                               |
| validityWindowEnd   | Timestamp | Certificate expiry date                              |
| isClear             | Boolean   | Certificate validity status                          |
| jobCardId           | String    | Work order ID (job cards only)                       |
| status              | String    | Open/Closed/In Progress/Pending Review               |
| description         | String    | Work description                                     |
| completionDate      | Timestamp | Job completion date                                  |
| value               | Number    | Mileage value (mileage records only)                 |
| lastRecordedDate    | Timestamp | Last mileage reading                                 |
| updatedBy           | String    | User who made the update                             |
| updatedAt           | Timestamp | Record update timestamp                              |

**Record Breakdown**:

- Fitness Certificates: 75 records (3 per trainset × 25 trainsets)
- Job Cards: 90 records (2-5 per trainset, varied statuses)
- Mileage Records: 25 records (1 per trainset, 80K-200K km range)

### 4. **branding_priorities.csv** - 20 Records

**Purpose**: Advertising contract management and exposure tracking

| Field                    | Type      | Description                                |
| ------------------------ | --------- | ------------------------------------------ |
| trainsetId               | String    | Links to trainsets.csv                     |
| advertiser               | String    | Company name (CocaCola, Nike, Apple, etc.) |
| contractId               | String    | Unique contract identifier                 |
| contractualHoursRequired | Number    | Total required exposure hours              |
| hoursExposedToDate       | Number    | Accumulated exposure hours                 |
| startDate                | Timestamp | Contract start date                        |
| endDate                  | Timestamp | Contract end date                          |
| updatedBy                | String    | User who updated record                    |
| updatedAt                | Timestamp | Last update timestamp                      |

**Coverage**: 80% of trainsets (20/25) have active branding contracts

### 5. **stabling_bays.csv** - 30 Records

**Purpose**: Physical infrastructure and trainset positioning

| Field        | Type      | Description                                 |
| ------------ | --------- | ------------------------------------------- |
| bayId        | String    | Unique bay identifier (Bay001-Bay030)       |
| trainsetId   | String    | Assigned trainset (nullable for empty bays) |
| bayType      | String    | Revenue/Standby/IBL                         |
| isClean      | Boolean   | Cleaning status                             |
| lastUsedDate | Timestamp | Most recent occupancy                       |
| updatedBy    | String    | User who updated record                     |
| updatedAt    | Timestamp | Last update timestamp                       |

**Occupancy**: 25 occupied bays (83%), 5 empty bays (17%) for operational flexibility

### 6. **cleaning_slots.csv** - 70 Records

**Purpose**: Maintenance scheduling and resource allocation

| Field             | Type      | Description                                              |
| ----------------- | --------- | -------------------------------------------------------- |
| slotId            | String    | Unique slot identifier                                   |
| startTime         | Timestamp | Slot start time                                          |
| endTime           | Timestamp | Slot end time                                            |
| isOccupied        | Boolean   | Slot availability status                                 |
| trainsetId        | String    | Assigned trainset (nullable)                             |
| manpowerAllocated | Number    | Number of maintenance staff                              |
| type              | String    | Deep Clean/Interior Detailing/Exterior Wash/Full Service |
| updatedBy         | String    | User who scheduled slot                                  |
| updatedAt         | Timestamp | Last update timestamp                                    |

**Schedule**: 5-day schedule with varied slot durations (2-4 hours)

---

## 🔗 Data Relationships

### Primary Keys:

- users.csv → userId
- trainsets.csv → trainsetId
- stabling_bays.csv → bayId
- cleaning_slots.csv → slotId

### Foreign Key Relationships:

- All collections reference users.userId via updatedBy field
- health_and_maintenance.trainsetId → trainsets.trainsetId
- branding_priorities.trainsetId → trainsets.trainsetId
- stabling_bays.trainsetId → trainsets.trainsetId
- cleaning_slots.trainsetId → trainsets.trainsetId
- trainsets.stablingPosition → stabling_bays.bayId

### Referential Integrity: ✅ VALIDATED

- All trainset references (TS001-TS025) exist and are consistent
- All user references point to valid users (user002, user003, user008, user016, user009, user011, user015, user018, user024, user030)
- No orphaned records or dangling references

---

## 📈 Data Quality Metrics

### Completeness:

- **100%** required fields populated
- **Realistic** null values only in appropriate nullable fields
- **Consistent** timestamp formats across all collections

### Accuracy:

- **Logical** status distributions (80% Revenue Service realistic for metro operations)
- **Realistic** mileage ranges (80K-200K km appropriate for metro trainsets)
- **Valid** date ranges (all timestamps within reasonable operational windows)

### Consistency:

- **Standardized** ID formats (TS### for trainsets, Bay### for bays)
- **Uniform** timestamp format (ISO 8601: YYYY-MM-DDTHH:MM:SSZ)
- **Aligned** bay assignments between trainsets and stabling_bays

---

## 🎯 Optimization-Ready Features

### Multi-Objective Inputs:

1. **Service Readiness**: trainsets.currentStatus, health_and_maintenance.isClear
2. **Maintenance Cost**: health_and_maintenance.jobCardId + status, trainsets.notes
3. **Branding Exposure**: branding_priorities.hoursExposedToDate vs contractualHoursRequired

### Constraint Validation:

1. **Hard Constraints**: Fitness certificate validity, critical job card status
2. **Soft Constraints**: Cleaning slot availability, bay type matching
3. **Operational Constraints**: Minimum service trainsets, mileage balancing

### Machine Learning Features:

- **Temporal**: lastUpdated, lastRevenueServiceDate, validityWindowEnd
- **Categorical**: role, currentStatus, category, bayType, type
- **Numerical**: fleetNumber, contractualHoursRequired, value (mileage), manpowerAllocated
- **Boolean**: isClear, isOccupied, isClean

---

## 🚀 Ready for Implementation

This dataset is **production-ready** for:

- Multi-objective optimization algorithms (pymoo/NSGA-II)
- Constraint satisfaction problems
- Predictive maintenance modeling
- Explainable AI systems
- Real-time decision support

**Next Step**: Begin algorithm implementation following `INSTRUCTIONS.md`
