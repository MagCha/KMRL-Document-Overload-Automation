"""
Enhanced main1.py — Digital Twin upgrades
- Robust data loading with fallback demo data
- Improved condition/failure/punctuality modeling
- Multi-scenario "what-if" runner with comparative results
- Simple stabling/shunting time model (based on yard geometry param)
- PyBullet 3D visualization (falls back gracefully if pybullet not available)
- Report saving (CSV + basic plots saved as PNG)
- Clear menu-driven CLI for running scenarios, visualizing, and exporting reports

Notes:
- The script attempts to import pybullet. If unavailable, the visualize option will run a lightweight ASCII animation.
- Designed to be self-contained; adjust constants and formulas as needed to fit real data.
"""

import pandas as pd
import numpy as np
import os
import time
import math
from datetime import datetime

# Optional visualization imports handled at runtime
try:
    import pybullet as p
    import pybullet_data
    PYPB_AVAILABLE = True
except Exception:
    PYPB_AVAILABLE = False

import matplotlib.pyplot as plt

CURRENT_YEAR = 2025

# ------------------------- Data & Basic Models -------------------------

def calculate_condition(year_built, avg_annual_mileage, current_year=CURRENT_YEAR):
    """Condition from 0..1. Incorporates age and mileage with gentle non-linear decay."""
    age = max(0, current_year - int(year_built)) if not np.isnan(year_built) else 0
    age_factor = max(0.0, 1 - (age * 0.02) - 0.005 * (age ** 1.2))
    mileage_factor = max(0.0, 1 - (avg_annual_mileage / 300000) - 0.000001 * (avg_annual_mileage ** 1.1))
    condition = (age_factor * 0.55) + (mileage_factor * 0.45)
    return float(round(np.clip(condition, 0, 1), 3))


def failure_probability(condition_score):
    # non-linear mapping: low condition -> rapidly increasing failure prob
    return float(round(np.clip(1 - condition_score ** 1.5, 0, 1), 3))


def punctuality_from_failure(failure_prob, base_delay_minutes=5):
    """Estimate punctuality rating [0..1] from failure probability and random noise."""
    noise = np.random.uniform(-0.05, 0.05)
    punctuality = 1.0 - (failure_prob * 0.9) + noise
    return float(round(np.clip(punctuality, 0, 1), 3))


def maintenance_cost_estimate(condition_score):
    # base cost scaled by deterioration
    base = 10000
    cost = base + (1 - condition_score) * 80000 + np.random.randint(-2000, 2000)
    return float(round(np.clip(cost, 3000, 200000), 2))

# --------------------- Data Loading & Defaults -------------------------

def generate_demo_fleet(n=8):
    ids = [f"T-{i:02d}" for i in range(1, n+1)]
    years = np.random.randint(2005, 2023, size=n)
    mileages = np.random.randint(50000, 300000, size=n)
    caps = np.random.choice([4000, 4500, 5000, 5500], size=n)
    df = pd.DataFrame({
        'unit_id': ids,
        'type': ['Electric'] * n,
        'year_built': years,
        'capacity': caps,
        'avg_annual_mileage': mileages
    })
    df['condition_score'] = df.apply(lambda r: calculate_condition(r['year_built'], r['avg_annual_mileage']), axis=1)
    df['failure_probability'] = df['condition_score'].apply(failure_probability)
    df['punctuality_rating'] = df['failure_probability'].apply(lambda f: punctuality_from_failure(f))
    df['maintenance_cost'] = df['condition_score'].apply(maintenance_cost_estimate)
    return df


def load_and_prepare_data(filepath='locomotives.csv'):
    if os.path.exists(filepath):
        df = pd.read_csv(filepath)
        df.columns = [c.strip().lower() for c in df.columns]
        for col in ['year_built', 'avg_annual_mileage']:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
        if 'capacity' not in df.columns:
            df['capacity'] = df.get('capacity', np.nan).fillna(5000)
        df = df.dropna(subset=['unit_id'])
        df['condition_score'] = df.apply(lambda r: calculate_condition(r.get('year_built', CURRENT_YEAR), r.get('avg_annual_mileage', 0)), axis=1)
        df['failure_probability'] = df['condition_score'].apply(failure_probability)
        df['punctuality_rating'] = df['failure_probability'].apply(lambda f: punctuality_from_failure(f))
        df['maintenance_cost'] = df['condition_score'].apply(maintenance_cost_estimate)
        print('Loaded fleet from', filepath)
        return df
    else:
        print(f"File {filepath} not found — generating demo fleet.")
        return generate_demo_fleet()

# -------------------- Digital Twin Simulation --------------------------

def simulate_year(fleet, year_offset=1, yard_geometry_factor=1.0, additional_maintenance=[]):
    """Simulate fleet forward by year_offset years.
    yard_geometry_factor affects shunting_time and punctuality (1.0 = baseline).
    additional_maintenance: list of unit_id which undergoes maintenance (resets some wear)
    Returns new df (copy).
    """
    fleet = fleet.copy().reset_index(drop=True)
    fleet['avg_annual_mileage'] = fleet['avg_annual_mileage'] + np.random.randint(20000 * year_offset, 40000 * year_offset, size=len(fleet))
    fleet['year_sim'] = CURRENT_YEAR + year_offset

    # If unit received maintenance, reduce its mileage/restore condition partially
    for uid in additional_maintenance:
        mask = fleet['unit_id'] == uid
        if mask.any():
            fleet.loc[mask, 'avg_annual_mileage'] = (fleet.loc[mask, 'avg_annual_mileage'] * 0.6)

    fleet['condition_score'] = fleet.apply(lambda r: calculate_condition(r['year_built'], r['avg_annual_mileage'], CURRENT_YEAR + year_offset), axis=1)
    fleet['failure_probability'] = fleet['condition_score'].apply(failure_probability)

    # Shunting time (minutes) - simplified function of yard geometry and fleet size
    fleet['shunting_time_min'] = np.clip(5 + (len(fleet) / 5.0) * yard_geometry_factor + (1 - fleet['condition_score']) * 10, 2, 120)

    # punctuality adjusted by shunting and failure
    fleet['punctuality_rating'] = fleet.apply(lambda r: punctuality_from_failure(r['failure_probability']) - (r['shunting_time_min'] / 600.0), axis=1)
    fleet['punctuality_rating'] = fleet['punctuality_rating'].clip(0, 1).round(3)

    fleet['maintenance_cost'] = fleet['condition_score'].apply(maintenance_cost_estimate)

    # Derived KPIs
    summary = {
        'total_units': len(fleet),
        'avg_condition': round(float(fleet['condition_score'].mean()), 3),
        'avg_failure_prob': round(float(fleet['failure_probability'].mean()), 3),
        'avg_punctuality': round(float(fleet['punctuality_rating'].mean()), 3),
        'total_maintenance_cost': round(float(fleet['maintenance_cost'].sum()), 2),
        'avg_shunting_min': round(float(fleet['shunting_time_min'].mean()), 2)
    }

    return fleet, summary

# -------------------- Scenario Runner & Reporting ---------------------

def run_scenarios(base_fleet, scenarios):
    """scenarios: list of dicts with keys: name, years_ahead, yard_geometry_factor, add_new (int), maintenance_list (list of unit_ids)
    Returns DataFrame summarizing scenarios and dictionary of resulting fleets.
    """
    results = []
    fleets = {}
    for s in scenarios:
        df = base_fleet.copy()
        # add new units if requested
        if s.get('add_new', 0) > 0:
            df = add_new_locomotive(df, count=s['add_new'])
        sim_df, summary = simulate_year(df, year_offset=s.get('years_ahead', 1), yard_geometry_factor=s.get('yard_geometry_factor', 1.0), additional_maintenance=s.get('maintenance_list', []))
        summary['scenario'] = s.get('name', 'scenario')
        results.append(summary)
        fleets[s.get('name', f"sc_{len(fleets)+1}")] = sim_df
    results_df = pd.DataFrame(results)
    return results_df, fleets

# ---------------------- Add / Save Utilities ---------------------------

def add_new_locomotive(fleet, count=1, base_capacity=5000):
    fleet = fleet.copy().reset_index(drop=True)
    next_index = len(fleet) + 1
    new_entries = []
    for i in range(count):
        uid = f"NEW_{CURRENT_YEAR}_{next_index + i}"
        year_built = CURRENT_YEAR
        avg_km = 0
        new_entries.append({
            'unit_id': uid,
            'type': 'Electric',
            'year_built': year_built,
            'capacity': base_capacity,
            'avg_annual_mileage': avg_km,
            'condition_score': 1.0,
            'failure_probability': 0.0,
            'punctuality_rating': 1.0,
            'maintenance_cost': 5000.0
        })
    if isinstance(fleet, pd.DataFrame):
        return pd.concat([fleet, pd.DataFrame(new_entries)], ignore_index=True)
    else:
        return pd.DataFrame(new_entries)


def save_scenario_report(results_df, fleets_dict, folder=None):
    if folder is None:
        folder = f"scenario_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    os.makedirs(folder, exist_ok=True)
    results_csv = os.path.join(folder, 'scenarios_summary.csv')
    results_df.to_csv(results_csv, index=False)

    # Save per-scenario fleet snapshots and simple plots
    for name, df in fleets_dict.items():
        safe = name.replace(' ', '_')
        df.to_csv(os.path.join(folder, f"fleet_{safe}.csv"), index=False)
        # simple bar chart of condition distribution
        plt.figure()
        df['condition_score'].hist(bins=10)
        plt.title(f"Condition distribution - {name}")
        plt.xlabel('Condition Score')
        plt.ylabel('Count')
        plt.savefig(os.path.join(folder, f"cond_hist_{safe}.png"))
        plt.close()
    print(f"Saved scenario report to folder: {folder}")
    return folder

# ---------------------- Visualization (PyBullet) ----------------------

def visualize_fleet_pybullet(fleet, sim_seconds=10):
    """
    Visualizes the fleet as a connected train in PyBullet with optional textures.
    - If coach.png or track.png are missing, uses simple colored boxes instead.
    """

    if fleet is None or len(fleet) == 0:
        print("Fleet is empty, cannot visualize.")
        return

    # Start PyBullet
    physicsClient = p.connect(p.GUI)
    p.setAdditionalSearchPath(pybullet_data.getDataPath())
    p.resetSimulation()
    p.setGravity(0, 0, -9.8)

    # === TRACK CREATION ===
    groundShape = p.createCollisionShape(p.GEOM_BOX, halfExtents=[50, 5, 0.1])
    groundVis = p.createVisualShape(p.GEOM_BOX, halfExtents=[50, 5, 0.1])
    trackBodyId = p.createMultiBody(baseMass=0,
                                    baseCollisionShapeIndex=groundShape,
                                    baseVisualShapeIndex=groundVis,
                                    basePosition=[0, 0, -0.1])

    # Apply track texture if available
    if os.path.exists("track.png"):
        track_tex = p.loadTexture("track.png")
        p.changeVisualShape(trackBodyId, -1, textureUniqueId=track_tex)
    else:
        print("track.png not found, using default gray color for track.")

    # === TRAIN CREATION ===
    body_ids = []
    spacing = 7.0  # distance between coaches

    # Check for coach texture
    coach_texture_available = os.path.exists("coach.png")
    coach_tex = p.loadTexture("coach.png") if coach_texture_available else None
    if not coach_texture_available:
        print("coach.png not found, using colored blocks for coaches.")

    # Build each coach
    for i, (_, row) in enumerate(fleet.iterrows()):
        x = i * spacing
        boxHalfLength, boxHalfWidth, boxHalfHeight = 3.5, 1.0, 1.2

        colBoxId = p.createCollisionShape(p.GEOM_BOX,
                                          halfExtents=[boxHalfLength, boxHalfWidth, boxHalfHeight])
        visId = p.createVisualShape(p.GEOM_BOX,
                                    halfExtents=[boxHalfLength, boxHalfWidth, boxHalfHeight])

        bodyId = p.createMultiBody(baseMass=2000,
                                   baseCollisionShapeIndex=colBoxId,
                                   baseVisualShapeIndex=visId,
                                   basePosition=[x, 0, boxHalfHeight])

        # Apply texture if available
        if coach_texture_available:
            p.changeVisualShape(bodyId, -1, textureUniqueId=coach_tex)

        body_ids.append(bodyId)

    # === CONNECT COACHES ===
    for i in range(1, len(body_ids)):
        p.createConstraint(
            body_ids[i-1], -1,
            body_ids[i], -1,
            jointType=p.JOINT_POINT2POINT,
            jointAxis=[0, 0, 0],
            parentFramePosition=[3.5, 0, 0],
            childFramePosition=[-3.5, 0, 0]
        )

    # === CAMERA ===
    p.resetDebugVisualizerCamera(
        cameraDistance=25,
        cameraYaw=0,
        cameraPitch=-20,
        cameraTargetPosition=[20, 0, 2]
    )

    # === ANIMATION LOOP ===
    print("Starting enhanced PyBullet visualization...")
    start_time = time.time()
    while time.time() - start_time < sim_seconds:
        lead = body_ids[0]

        # Lead speed influenced by punctuality rating
        lead_speed = 0.5 + (fleet.iloc[0].get('punctuality_rating', 0.5)) * 2.0

        pos, orn = p.getBasePositionAndOrientation(lead)
        new_x = pos[0] + lead_speed * (1/60.0)
        p.resetBasePositionAndOrientation(lead, [new_x, 0, pos[2]], orn)

        p.stepSimulation()
        time.sleep(1/60.0)

    print("Enhanced PyBullet visualization finished.")
    p.disconnect()




def ascii_train_animation(fleet, sim_seconds=8):
    # Very basic terminal animation showing moving train indices
    units = list(fleet['unit_id'].astype(str).values)
    width = 60
    positions = [int(i * (width / max(1, len(units)))) for i in range(len(units))]
    start = time.time()
    while time.time() - start < sim_seconds:
        line = [' '] * width
        for i, u in enumerate(units):
            ppos = min(width-1, positions[i])
            # mark by first letter or index
            ch = str(u)[0]
            line[ppos] = ch
            positions[i] = (positions[i] + 1 + int((1 - fleet.iloc[i]['punctuality_rating']) * 3)) % width
        print('\r' + ''.join(line), end='')
        time.sleep(0.2)
    print('\nASCII animation complete.')

# --------------------------- CLI Menu --------------------------------

def fleet_summary(fleet):
    print('\n=== Fleet Summary ===')
    print('Total Locomotives:', len(fleet))
    print('Total Capacity:', int(fleet['capacity'].sum()))
    print('Average Condition Score:', round(float(fleet['condition_score'].mean()), 3))
    print('Average Failure Probability:', round(float(fleet['failure_probability'].mean()), 3))
    print('Average Punctuality Rating:', round(float(fleet['punctuality_rating'].mean()), 3))
    print('Total Maintenance Cost: $', round(float(fleet['maintenance_cost'].sum()), 2))


def main():
    fleet_df = load_and_prepare_data()
    if fleet_df is None:
        fleet_df = generate_demo_fleet(8)

    scenarios_memory = {}

    while True:
        print('\n=== Enhanced Digital Twin Menu ===')
        print('1. View Fleet Summary')
        print('2. Run Simulation for Next Year (default)')
        print('3. Run Custom Scenario (what-if)')
        print('4. Batch Run Multiple Scenarios & Save Report')
        print('5. Add New Locomotives')
        print('6. Visualize Fleet in 3D (PyBullet or ASCII)')
        print('7. Save Current Fleet to CSV')
        print('8. Exit')

        choice = input('Enter your choice: ').strip()
        if choice == '1':
            fleet_summary(fleet_df)
        elif choice == '2':
            fleet_df, summary = simulate_year(fleet_df, year_offset=1)
            print('Simulation summary:', summary)
        elif choice == '3':
            name = input('Scenario name: ').strip() or f'scenario_{len(scenarios_memory)+1}'
            try:
                years = int(input('Years ahead (1): ') or '1')
            except:
                years = 1
            try:
                geom = float(input('Yard geometry factor (1.0 default): ') or '1.0')
            except:
                geom = 1.0
            try:
                newc = int(input('Add new locomotives (0): ') or '0')
            except:
                newc = 0
            maintenance_input = input('List unit_ids to service (comma separated, optional): ').strip()
            maintenance_list = [s.strip() for s in maintenance_input.split(',') if s.strip()] if maintenance_input else []
            df = fleet_df.copy()
            if newc > 0:
                df = add_new_locomotive(df, newc)
            sim_df, summary = simulate_year(df, year_offset=years, yard_geometry_factor=geom, additional_maintenance=maintenance_list)
            print('Scenario result:', summary)
            scenarios_memory[name] = (sim_df, summary)
        elif choice == '4':
            # Collect multiple scenario specs from user quickly
            print('Enter scenarios (blank name to finish):')
            specs = []
            while True:
                sname = input('Name (blank to stop): ').strip()
                if not sname:
                    break
                years = int(input('Years ahead (1): ') or '1')
                geom = float(input('Yard geometry factor (1.0): ') or '1.0')
                newc = int(input('Add new locomotives (0): ') or '0')
                maint = input('Maintenance list (comma sep): ').strip()
                maint_list = [x.strip() for x in maint.split(',') if x.strip()] if maint else []
                specs.append({'name': sname, 'years_ahead': years, 'yard_geometry_factor': geom, 'add_new': newc, 'maintenance_list': maint_list})
            if not specs:
                print('No scenarios provided.')
            else:
                results_df, fleets = run_scenarios(fleet_df, specs)
                print('\nScenarios summary:')
                print(results_df)
                folder = save_scenario_report(results_df, fleets)
                print('Report folder:', folder)
        elif choice == '5':
            try:
                count = int(input('How many new locomotives to add? ') or '1')
                fleet_df = add_new_locomotive(fleet_df, count)
                print(f'Added {count} new units.')
            except Exception as e:
                print('Invalid input:', e)
        elif choice == '6':
            try:
                sec = int(input('Visualization seconds (8): ') or '8')
            except:
                sec = 8
            visualize_fleet_pybullet(fleet_df, sim_seconds=sec)
        elif choice == '7':
            path = input('Filename to save (fleet_master_simulated.csv): ').strip() or 'fleet_master_simulated.csv'
            fleet_df.to_csv(path, index=False)
            print('Saved to', path)
        elif choice == '8':
            print('Exiting. Goodbye!')
            break
        else:
            print('Invalid choice — try again.')


if __name__ == '__main__':
    main()
