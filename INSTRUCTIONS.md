# KMRL Induction Planning System - Implementation Instructions

## 🚀 IMMEDIATE NEXT TASKS (Priority Order)

### **PHASE 2A: Core Algorithm Development (4-5 hours)**

#### **Task 1: Data Ingestion Pipeline (30 minutes)**

```python
# File: src/data_ingestion.py
```

**Objective**: Create pandas-based data loader for all CSV files

**Implementation Steps**:

1. Create `src/` directory
2. Implement `DataLoader` class:

   ```python
   class DataLoader:
       def load_all_data(self):
           # Load all CSV files from ArtificialData/
           # Return structured dictionary of DataFrames
           pass

       def validate_data_integrity(self):
           # Check referential integrity
           # Validate timestamp formats
           # Report data quality metrics
           pass
   ```

3. **Key Functions**:

   - `load_users()`, `load_trainsets()`, `load_health_maintenance()`
   - `load_branding()`, `load_stabling_bays()`, `load_cleaning_slots()`
   - `validate_references()` - ensure all trainsetId/userId exist
   - `get_data_summary()` - return statistics

4. **Validation Checks**:
   - All trainsetId references exist in trainsets.csv
   - All userId references exist in users.csv
   - Timestamp format consistency
   - No null values in critical fields

#### **Task 2: Multi-Objective Optimization Engine (2.5 hours)**

```python
# File: src/optimization_engine.py
```

**Objective**: Implement NSGA-II based induction planning

**Installation**: `pip install pymoo`

**Core Implementation**:

```python
from pymoo.algorithms.moo.nsga2 import NSGA2
from pymoo.core.problem import Problem

class InductionPlanningProblem(Problem):
    def __init__(self, trainset_data, constraints_data):
        # Define decision variables: 25 trainsets × 3 states
        super().__init__(n_var=25, n_obj=3, n_constr=5)

    def _evaluate(self, X, out):
        # Objective 1: Maximize service readiness
        # Objective 2: Minimize maintenance cost
        # Objective 3: Maximize branding exposure
        pass
```

**Objectives to Implement**:

1. **Service Readiness** (Maximize):

   - Count trainsets assigned to "Revenue Service"
   - Weight by fitness certificate validity
   - Penalize expired certificates

2. **Maintenance Cost** (Minimize):

   - Cost = open job cards × complexity weight
   - Add mileage-based degradation cost
   - Include cleaning requirement costs

3. **Branding Exposure** (Maximize):
   - Sum of contractual hours for service-assigned trainsets
   - Weight by remaining contract duration
   - Penalize under-exposure contracts

**Constraints to Implement**:

1. **Fitness Constraint**: No service if certificate expired
2. **Job Card Constraint**: No service if critical job card open
3. **Cleaning Constraint**: Respect cleaning slot availability
4. **Bay Constraint**: Trainsets must fit stabling geometry
5. **Capacity Constraint**: Min 15 trainsets in service (operational requirement)

#### **Task 3: Constraint Validation System (1 hour)**

```python
# File: src/constraints.py
```

**Hard Constraints** (Must be satisfied):

- Fitness certificate validity for Rolling-Stock, Signalling, Telecom
- No open job cards for brake, safety, signal systems
- Physical bay assignment consistency

**Soft Constraints** (Preferential):

- Mileage balancing across fleet
- Cleaning schedule optimization
- Branding exposure targets

#### **Task 4: Decision Explanation Engine (1 hour)**

```python
# File: src/explainer.py
```

Using SHAP for decision transparency:

```python
import shap

class InductionExplainer:
    def explain_decision(self, trainset_id, recommendation):
        # Generate human-readable explanation
        # Return factors influencing the decision
        pass
```

### **PHASE 2B: Integration & Interface (3-4 hours)**

#### **Task 5: Main Orchestrator (1 hour)**

```python
# File: src/main.py
```

Integrate all components:

```python
class InductionPlanner:
    def __init__(self):
        self.data_loader = DataLoader()
        self.optimizer = OptimizationEngine()
        self.explainer = InductionExplainer()

    def generate_induction_plan(self):
        # 1. Load data
        # 2. Run optimization
        # 3. Validate constraints
        # 4. Generate explanations
        # 5. Return ranked recommendations
        pass
```

#### **Task 6: Output Generation (1 hour)**

```python
# File: src/output_generator.py
```

Generate structured outputs:

- **Induction List**: Ranked trainsets with assignments
- **Conflict Report**: Constraint violations and alerts
- **Explanation Report**: Decision rationale for each trainset
- **What-if Analysis**: Alternative scenarios

#### **Task 7: Simple Web Interface (2 hours)**

```python
# File: app.py (Flask/FastAPI)
```

**MVP Dashboard**:

- Display current trainset status
- Show optimization results
- Present explanation summaries
- Allow manual overrides

### **PHASE 2C: Advanced Features (If Time Permits)**

#### **Task 8: Predictive Maintenance Integration**

```python
# File: src/predictive_maintenance.py
```

- Implement anomaly detection for mileage patterns
- Predict component failure probabilities
- Feed predictions into constraint system

#### **Task 9: Digital Twin Simulation**

```python
# File: src/simulation.py
```

- Model fleet dynamics
- Test "what-if" scenarios
- Evaluate long-term impacts

## 📦 Required Python Libraries

```bash
pip install pandas numpy scikit-learn pymoo shap lime flask plotly dash
```

## 🗂️ Project Structure to Create

```
src/
├── data_ingestion.py      # Data loading and validation
├── optimization_engine.py # NSGA-II implementation
├── constraints.py         # Constraint validation
├── explainer.py          # SHAP-based explanations
├── output_generator.py   # Results formatting
├── simulation.py         # Digital twin (optional)
└── main.py               # Main orchestrator

app.py                    # Web interface
requirements.txt          # Dependencies
tests/                    # Unit tests
```

## 🎯 Success Metrics

1. **Functional**: Generate valid induction plan in <30 seconds
2. **Quality**: 95%+ constraint satisfaction rate
3. **Explainability**: Human-readable decision rationale
4. **Scalability**: Handle 25-40 trainsets efficiently

## 🔧 Development Tips

1. **Start Simple**: Implement 2 objectives first, add third later
2. **Validate Early**: Test with known scenarios
3. **Modular Design**: Keep components loosely coupled
4. **Data First**: Ensure data loading works before optimization
5. **Incremental Testing**: Test each component individually

## 📊 Test Scenarios

Create these test cases:

1. **Normal Operations**: All certificates valid, few open job cards
2. **Maintenance Rush**: Multiple trainsets need maintenance
3. **Certificate Expiry**: Some certificates expired
4. **High Branding Demand**: Multiple contracts near deadlines
5. **Cleaning Backlog**: Limited cleaning slots available

## 🚨 Critical Path

1. Data loading (30 min) →
2. Basic optimization (2 hours) →
3. Constraint validation (1 hour) →
4. Integration (1 hour) →
5. Basic interface (1.5 hours)

**Total MVP Time**: ~6 hours (leaves buffer for debugging and refinement)

## 🔄 Iteration Strategy

1. **Version 1**: Single objective (service readiness)
2. **Version 2**: Add constraints validation
3. **Version 3**: Multi-objective optimization
4. **Version 4**: Add explanations
5. **Version 5**: Web interface

This approach ensures you have a working system at each stage, perfect for hackathon time constraints!
