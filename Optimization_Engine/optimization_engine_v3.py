import numpy as np
import pandas as pd
from pymoo.core.problem import Problem
from pymoo.algorithms.moo.nsga2 import NSGA2
from pymoo.optimize import minimize
from pymoo.core.callback import Callback
import matplotlib.pyplot as plt

# 1. Load and Process Data
# =============================================================================
try:
    # Make sure this base_path is correct for your file structure
    base_path = "KMRL-Document-Overload-Automation/ArtificialData/"
    train_df = pd.read_csv(f"{base_path}trainsets.csv")
    hm_df = pd.read_csv(f"{base_path}health_and_maintenance.csv")
    branding_df = pd.read_csv(f"{base_path}branding_priorities.csv")

    # --- Process Health & Maintenance Data ---
    mileage_df = hm_df[hm_df['category'] == 'Mileage'][['trainsetId', 'value']].rename(columns={'value': 'mileage'})
    job_cards_df = hm_df[hm_df['category'] == 'Job Card'].copy()
    open_statuses = ['Open', 'In Progress']
    job_cards_df['job_card_open'] = job_cards_df['status'].isin(open_statuses)
    open_cards_summary = job_cards_df.groupby('trainsetId')['job_card_open'].any().reset_index()
    certs_df = hm_df[hm_df['category'] == 'Fitness Certificate'].copy()
    rolling_stock_certs = certs_df[certs_df['department'] == 'Rolling-Stock']
    certs_summary = rolling_stock_certs.groupby('trainsetId')['isClear'].all().reset_index()
    certs_summary = certs_summary.rename(columns={'isClear': 'fitness_certificate_valid'})

    # --- Process Branding Data ---
    branding_df['endDate'] = pd.to_datetime(branding_df['endDate'])
    today = pd.to_datetime('today').tz_localize('UTC')
    branding_df['days_to_expiry'] = (branding_df['endDate'] - today).dt.days
    branding_df['hours_remaining'] = branding_df['contractualHoursRequired'] - branding_df['hoursExposedToDate']
    branding_df['branding_priority_score'] = branding_df['hours_remaining'] / branding_df['days_to_expiry'].clip(lower=1)
    branding_df.loc[branding_df['days_to_expiry'] <= 0, 'branding_priority_score'] = 9999

    # --- Merge all data ---
    train_df = pd.merge(train_df, mileage_df, on='trainsetId', how='left')
    train_df = pd.merge(train_df, open_cards_summary, on='trainsetId', how='left')
    train_df = pd.merge(train_df, certs_summary, on='trainsetId', how='left')
    train_df = pd.merge(train_df, branding_df[['trainsetId', 'branding_priority_score']], on='trainsetId', how='left')

    # --- Final Cleanup ---
    train_df['job_card_open'] = train_df['job_card_open'].fillna(False)
    train_df['fitness_certificate_valid'] = train_df['fitness_certificate_valid'].fillna(False)
    train_df['branding_priority_score'] = train_df['branding_priority_score'].fillna(0)
    min_mileage, max_mileage = train_df['mileage'].min(), train_df['mileage'].max()
    train_df['mileage_norm'] = (train_df['mileage'] - min_mileage) / (max_mileage - min_mileage)
    train_df['punctuality_score'] = 100 - (train_df['mileage_norm'] * 5)
    train_df['punctuality_score'] = train_df['punctuality_score'].round(2)

    print("--- Data Processing Complete (with Branding) ---")
    print(train_df[['trainsetId', 'mileage', 'job_card_open', 'fitness_certificate_valid', 'punctuality_score', 'branding_priority_score']].head())
    print("-------------------------------------------------")

except FileNotFoundError as e:
    print(f"Error: Could not find data files. Make sure the 'base_path' is correct. Details: {e}")
    exit()

# 2. Define the 3-Objective Optimization Problem
# =============================================================================
N_TO_SELECT = 15

class TrainSchedulingProblemV3(Problem):
    def __init__(self, df):
        super().__init__(n_var=len(df), n_obj=3, n_constr=3, xl=0, xu=1, vtype=bool)
        self.df = df

    def _evaluate(self, x, out, *args, **kwargs):
        f1 = np.sum(x * self.df["mileage"].values, axis=1)
        punctuality_scores = np.sum(x * self.df["punctuality_score"].values, axis=1)
        safe_divisor = np.where(np.sum(x, axis=1) > 0, np.sum(x, axis=1), 1)
        avg_punctuality = punctuality_scores / safe_divisor
        f2 = 100 - avg_punctuality
        f3 = -np.sum(x * self.df["branding_priority_score"].values, axis=1)
        g1 = (np.sum(x, axis=1) - N_TO_SELECT)**2
        g2 = np.sum(x * self.df["job_card_open"].values, axis=1)
        g3 = np.sum(x * ~self.df["fitness_certificate_valid"].values, axis=1)
        out["F"] = np.column_stack([f1, f2, f3])
        out["G"] = np.column_stack([g1, g2, g3])

# 3. Run the Optimization
# =============================================================================
problem = TrainSchedulingProblemV3(train_df)
algorithm = NSGA2(pop_size=200, eliminate_duplicates=True)

class MyCallback(Callback):
    def __init__(self) -> None:
        super().__init__()
        self.data["F"] = []

    def notify(self, algorithm):
        self.data["F"].append(algorithm.pop.get("F"))

callback = MyCallback()

res = minimize(problem,
               algorithm,
               ('n_gen', 400),
               seed=1,
               callback=callback,
               verbose=True)

# 4. Extract and Display Optimal Train Sets
# =============================================================================
print("\n--- Optimal Solutions Analysis ---")

# res.X from NSGA2 contains float values (probabilities). We need to convert them to boolean.
optimal_solutions_floats = res.X

# res.F contains the objective values for each corresponding solution.
optimal_objectives = res.F

# Loop through each optimal solution found by the algorithm
for i, solution_float_mask in enumerate(optimal_solutions_floats):
    
    # THE FIX: Convert the float array to a boolean array using a 0.5 threshold.
    solution_mask = solution_float_mask > 0.5
    
    # Use the proper boolean mask to filter the DataFrame to get the selected trains
    selected_trains_df = train_df[solution_mask]
    
    # Extract the list of trainset IDs
    selected_ids = selected_trains_df['trainsetId'].tolist()
    
    # Get the objective values for this solution
    mileage = optimal_objectives[i, 0]
    punctuality_score = 100 - optimal_objectives[i, 1]  # Convert back from objective
    branding_score = -optimal_objectives[i, 2]         # Convert back from objective
    
    print(f"\n✅ Optimal Fleet #{i+1}:")
    print(f"   - Performance: [Mileage: {mileage:.0f}, Punctuality: {punctuality_score:.2f}%, Branding: {branding_score:.2f}]")
    print(f"   - Selected Trains ({len(selected_ids)}): {selected_ids}")

print("\n----------------------------------")

# 5. Visualization using pure Matplotlib
# =============================================================================
# Get the final optimal solutions
plot_f = np.copy(res.F)
plot_f[:, 1] = 100 - plot_f[:, 1]   # convert punctuality back to %
branding_scores = -plot_f[:, 2]     # invert branding score

# Collect history from callback
history_f = np.vstack(callback.data["F"])
history_f[:, 1] = 100 - history_f[:, 1]

# Plot history and final solutions using matplotlib
plt.figure(figsize=(10, 6))

# Plot history
plt.scatter(history_f[:, 0], history_f[:, 1], color="gray", alpha=0.3, s=15, label="Considered Options")

# Plot final Pareto solutions
scatter = plt.scatter(plot_f[:, 0], plot_f[:, 1], c=branding_scores, cmap="viridis", s=150,
                      edgecolors='black', linewidths=0.5, label="Optimal Solutions")

# Labels, legend, and colorbar
plt.xlabel("Total Mileage (Cost Proxy)")
plt.ylabel("Punctuality Score (%)")
plt.legend()
plt.colorbar(scatter, label="Branding Score (Higher is Better)")

plt.title("Optimal Fleet Schedule vs. All Considered Options")
plt.show()