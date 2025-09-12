# KMRL Document Overload Automation - Project Summary

## 🚆 Project Overview

This project develops an AI-driven decision-support platform for Kochi Metro Rail Limited (KMRL) to automate the nightly induction planning process for their 25 four-car trainsets. The system transforms manual, error-prone operations into a data-driven, optimized workflow.

## 🎯 Problem Statement

Kochi Metro must decide every night which trainsets enter revenue service, remain on standby, or undergo maintenance. This decision depends on six interdependent variables:

1. **Fitness Certificates** - validity from Rolling-Stock, Signalling, Telecom departments
2. **Job-Card Status** - open vs. closed work orders from IBM Maximo
3. **Branding Priorities** - contractual advertising exposure commitments
4. **Mileage Balancing** - kilometer allocation for component wear equalization
5. **Cleaning & Detailing Slots** - available manpower and bay occupancy
6. **Stabling Geometry** - physical positions to minimize shunting time

## 📊 Current Data Status

**✅ COMPLETED: Data Preparation & Schema Design**

### Artificial Dataset Generated:

- **Users**: 10 users (1 Admin, 1 Supervisor, 2 Maintenance Managers, 6 Operators)
- **Trainsets**: 25 trainsets (TS001-TS025)
  - 80% Revenue Service (20 trainsets)
  - 15% Standby (4 trainsets)
  - 5% Inspection Bay Line (1 trainset)
- **Health & Maintenance**: 190 records
  - 75 Fitness Certificates (3 per trainset)
  - 90 Job Cards (2-5 per trainset)
  - 25 Mileage Records (1 per trainset)
- **Branding Priorities**: 20 records (80% coverage)
- **Stabling Bays**: 30 bays (25 occupied, 5 empty)
- **Cleaning Slots**: 70 records (5-day schedule)

**Total Records**: 365 (Perfect scale for hackathon development)

### Schema Design:

Firebase Firestore schema implemented with 6 collections supporting all operational variables and user management.

## 🔄 Development Status

### ✅ PHASE 1: COMPLETED

- [x] Problem analysis and requirements gathering
- [x] Database schema design (Firestore)
- [x] Artificial data generation (365 realistic records)
- [x] Data validation and cleanup
- [x] Referential integrity verification

### 🔄 PHASE 2: IN PROGRESS

**Next Tasks** (See INSTRUCTIONS.md for details):

1. Data ingestion pipeline setup
2. Multi-objective optimization engine
3. Predictive maintenance module
4. Explainable AI implementation
5. Digital twin simulation
6. Frontend dashboard development

## 🏗️ Architecture Components

### Core Modules:

1. **Data Ingestion & Preparation** (pandas, scikit-learn)
2. **Multi-Objective Optimization** (pymoo, NSGA-II)
3. **Predictive Maintenance** (scikit-learn, tensorflow)
4. **Explainable AI** (SHAP, LIME)
5. **Digital Twin Simulation** (pandas, custom models)

### Technology Stack:

- **Backend**: Python, Firebase Firestore
- **ML/AI**: scikit-learn, tensorflow, pymoo, SHAP
- **Data**: pandas, numpy
- **Frontend**: (TBD - React/Vue recommended)

## 📁 Project Structure

```
KMRL-Document-Overload-Automation/
├── ArtificialData/           # Generated dataset (365 records)
│   ├── users.csv
│   ├── trainsets.csv
│   ├── health_and_maintenance.csv
│   ├── branding_priorities.csv
│   ├── stabling_bays.csv
│   └── cleaning_slots.csv
├── KMRLOpenData/             # Original GTFS data
├── Reference_Resource/       # Documentation and schemas
│   ├── FirestoreSchema_Hackathon.txt
│   └── workPlan.txt
├── README.md
└── INSTRUCTIONS.md           # Detailed next steps
```

## 🎯 Hackathon Goals

**Time Remaining**: ~8-10 hours

### Minimum Viable Product (MVP):

1. Basic optimization engine (2-3 objectives)
2. Simple constraint validation
3. Explainable recommendation output
4. Basic web interface

### Stretch Goals:

1. Predictive maintenance integration
2. Real-time simulation capabilities
3. Advanced multi-objective optimization
4. Machine learning feedback loops

## 🚀 Getting Started

1. Review `INSTRUCTIONS.md` for detailed implementation steps
2. Set up Python environment with required libraries
3. Load data from `ArtificialData/` folder
4. Begin with data ingestion pipeline
5. Implement optimization engine core

## 📞 Context for AI Agents

This project is in active development for SIH Prelims 2025 hackathon. The data foundation is complete and validated. Next phase focuses on AI/ML implementation following the detailed workPlan.txt methodology.

**Current Date**: September 12, 2025, 9:00 PM
**Status**: Ready for Algorithm Implementation Phase
