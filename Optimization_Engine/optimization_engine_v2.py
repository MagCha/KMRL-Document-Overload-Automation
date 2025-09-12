import numpy as np
import pandas as pd
from pymoo.core.problem import Problem
from pymoo.algorithms.moo.nsga2 import NSGA2
from pymoo.optimize import minimize
from pymoo.core.callback import Callback
from pymoo.visualization.scatter import Scatter

# 1. Load and Process Data from `ArtificialData`
# =============================================================================
try:
    # Step 1: Load Base Data
    base_path = "KMRL-Document-Overload-Automation/ArtificialData/"
    train_df = pd.read_csv(f"{base_path}trainsets.csv")
    hm_df = pd.read_csv(f"{base_path}health_and_maintenance.csv")

    # Step 2: Process `health_and_maintenance.csv`
    
    # --- Mileage ---
    mileage_df = hm_df[hm_df['category'] == 'Mileage'][['trainsetId', 'value']].rename(columns={'value': 'mileage'})

    # --- Job Cards (Relaxed Rule 1) ---
    job_cards_df = hm_df[hm_df['category'] == 'Job Card'].copy()
    open_statuses = ['Open', 'In Progress'] # Rule: 'Pending Review' is OK
    job_cards_df['job_card_open'] = job_cards_df['status'].isin(open_statuses)
    open_cards_summary = job_cards_df.groupby('trainsetId')['job_card_open'].any().reset_index()

    # --- Fitness Certificates (Relaxed Rule 2) ---
    certs_df = hm_df[hm_df['category'] == 'Fitness Certificate'].copy()
    # Rule: Only the 'Rolling-Stock' certificate must be clear
    rolling_stock_certs = certs_df[certs_df['department'] == 'Rolling-Stock']
    certs_summary = rolling_stock_certs.groupby('trainsetId')['isClear'].all().reset_index()
    certs_summary = certs_summary.rename(columns={'isClear': 'fitness_certificate_valid'})

    # Step 3: Merge all data into the base train_df
    train_df = pd.merge(train_df, mileage_df, on='trainsetId', how='left')
    train_df = pd.merge(train_df, open_cards_summary, on='trainsetId', how='left')
    train_df = pd.merge(train_df, certs_summary, on='trainsetId', how='left')

    # Fill NaN values for trains that might have been missing records
    # If a train has no job cards, it has no open ones.
    train_df['job_card_open'] = train_df['job_card_open'].fillna(False)
    # If a train is missing a Rolling-Stock cert, assume it's not valid.
    train_df['fitness_certificate_valid'] = train_df['fitness_certificate_valid'].fillna(False)

    # Step 4: Create Punctuality Score
    min_mileage = train_df['mileage'].min()
    max_mileage = train_df['mileage'].max()
    train_df['mileage_norm'] = (train_df['mileage'] - min_mileage) / (max_mileage - min_mileage)
    train_df['punctuality_score'] = 100 - (train_df['mileage_norm'] * 5)
    train_df['punctuality_score'] = train_df['punctuality_score'].round(2)

    print("--- Data Processing Complete ---")
    print(f"Final processed data for {len(train_df)} trains:")
    print(train_df[['trainsetId', 'mileage', 'job_card_open', 'fitness_certificate_valid', 'punctuality_score']].head())
    print("--------------------------------")

except FileNotFoundError as e:
    print(f"Error: Could not find data files. Make sure the folder path is correct. Details: {e}")
    exit()


# 2. Define the Optimization Problem
# =============================================================================
N_TO_SELECT = 15

class TrainSchedulingProblem(Problem):
    def __init__(self, df):
        super().__init__(n_var=len(df), n_obj=2, n_constr=3, xl=0, xu=1, vtype=bool)
        self.df = df

    def _evaluate(self, x, out, *args, **kwargs):
        f1 = np.sum(x * self.df["mileage"].values, axis=1)
        
        punctuality_scores = np.sum(x * self.df["punctuality_score"].values, axis=1)
        safe_divisor = np.where(np.sum(x, axis=1) > 0, np.sum(x, axis=1), 1)
        avg_punctuality = punctuality_scores / safe_divisor
        f2 = 100 - avg_punctuality

        g1 = (np.sum(x, axis=1) - N_TO_SELECT)**2
        g2 = np.sum(x * self.df["job_card_open"].values, axis=1)
        g3 = np.sum(x * ~self.df["fitness_certificate_valid"].values, axis=1)

        out["F"] = np.column_stack([f1, f2])
        out["G"] = np.column_stack([g1, g2, g3])


# 3. Run the Optimization
# =============================================================================
problem = TrainSchedulingProblem(train_df)

algorithm = NSGA2(pop_size=200, eliminate_duplicates=True)

# Define the callback to store history
class MyCallback(Callback):
    def __init__(self) -> None:
        super().__init__()
        self.data["F"] = []

    def notify(self, algorithm):
        self.data["F"].append(algorithm.pop.get("F"))

# Execute the optimization with the callback
res = minimize(problem,
               algorithm,
               ('n_gen', 400),
               seed=1,
               callback=MyCallback(),
               verbose=True)


# 4. Print and Visualize Results
# =============================================================================
print("\n--- Optimization Results ---")

eligible_trains = train_df[(train_df['job_card_open'] == False) & (train_df['fitness_certificate_valid'] == True)]
print(f"There are {len(eligible_trains)} eligible trains available to choose from.")

if res.X is None:
    print("Could not find any valid solution. The constraints might still be too strict.")
else:
    print(f"Found {len(res.F)} optimal solutions.")
    # Display the results
    for i, (solution_vars, solution_objectives) in enumerate(zip(res.X, res.F)):
        print(f"\n--- Solution {i+1} ---")
        print(f"Cost (Mileage): {solution_objectives[0]:.0f}")
        print(f"Punctuality: {100 - solution_objectives[1]:.2f}%")
        selected_trains = train_df[solution_vars.astype(bool)].sort_values(by='mileage')
        print("Selected Trains:")
        print(selected_trains[['trainsetId', 'mileage', 'punctuality_score']].to_string(index=False))

    # Create the plot with the history
    plot = Scatter(
        title="Optimal Fleet Schedule vs. All Considered Options",
        labels=["Total Mileage (Cost Proxy)", "Punctuality Score (%)"]
    )
    
    # Get the history of all evaluated solutions from the callback
    history_f = np.vstack(res.algorithm.callback.data["F"])
    
    # Transform punctuality for plotting
    history_f[:, 1] = 100 - history_f[:, 1]
    
    # Add the cloud of all considered solutions
    plot.add(history_f, color="gray", alpha=0.3, s=15, label="Considered Options")
    
    # Add the final optimal solution(s)
    plot_f = np.copy(res.F)
    plot_f[:, 1] = 100 - plot_f[:, 1]
    plot.add(plot_f, color="green", s=100, label="Optimal Solution")
    
    plot.show()

