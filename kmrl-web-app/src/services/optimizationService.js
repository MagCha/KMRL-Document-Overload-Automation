/**
 * Optimization Service
 * 
 * This service handles integration with the Python optimization engine (optimization_engine_v3.py)
 * and provides optimization-related business logic for the KMRL fleet management system.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

const logger = require('../utils/logger');
const { dbOperations } = require('../config/firebase');
const { getConfig } = require('../utils/validation');

class OptimizationService {
  constructor() {
    this.config = getConfig();
    this.runningOptimizations = new Map();
    this.optimizationTemplates = this.loadOptimizationTemplates();
  }

  /**
   * Run optimization using the Python engine
   */
  async runOptimization(params) {
    const { date, constraints, preferences, mode, requestId } = params;
    const optimizationId = requestId || uuidv4();
    
    logger.optimization('Starting optimization process', {
      optimizationId,
      date,
      mode
    });

    try {
      // Prepare optimization data
      const optimizationData = await this.prepareOptimizationData(date, constraints, preferences);
      
      // Create temporary input file
      const inputFile = await this.createTempInputFile(optimizationData, optimizationId);
      
      // Configure optimization parameters based on mode
      const optimizationParams = this.getOptimizationParams(mode);
      
      // Run Python optimization script
      const result = await this.executePythonOptimization(inputFile, optimizationParams, optimizationId);
      
      // Clean up temporary file
      await this.cleanupTempFile(inputFile);
      
      // Process and validate results
      const processedResult = await this.processOptimizationResult(result, optimizationId);
      
      logger.optimization('Optimization completed successfully', {
        optimizationId,
        solutionCount: processedResult.solutions?.length || 0,
        objectives: processedResult.objectives
      });
      
      return processedResult;
      
    } catch (error) {
      logger.error('Optimization failed', {
        optimizationId,
        error: error.message,
        stack: error.stack
      });
      
      // Clean up running optimization tracking
      this.runningOptimizations.delete(optimizationId);
      
      throw error;
    }
  }

  /**
   * Prepare optimization data from Firebase
   */
  async prepareOptimizationData(date, constraints, preferences) {
    logger.info('Preparing optimization data', { date });
    
    try {
      // Fetch all required data from Firebase
      const [trainsets, healthMaintenance, brandingPriorities, stablingBays, cleaningSlots] = await Promise.all([
        dbOperations.getAll('trainsets'),
        dbOperations.getAll('health_and_maintenance'),
        dbOperations.getAll('branding_priorities'),
        dbOperations.getAll('stabling_bays'),
        dbOperations.getAll('cleaning_slots')
      ]);

      // Filter data for the specific date if needed
      const targetDate = new Date(date);
      const filteredData = this.filterDataByDate(
        { trainsets, healthMaintenance, brandingPriorities, stablingBays, cleaningSlots },
        targetDate
      );

      // Apply constraints and preferences
      const optimizationData = {
        date: date,
        trainsets: filteredData.trainsets,
        health_and_maintenance: filteredData.healthMaintenance,
        branding_priorities: filteredData.brandingPriorities,
        stabling_bays: filteredData.stablingBays,
        cleaning_slots: filteredData.cleaningSlots,
        constraints: constraints,
        preferences: preferences,
        metadata: {
          total_trainsets: filteredData.trainsets.length,
          available_stabling_bays: filteredData.stablingBays.filter(bay => bay.status === 'available').length,
          maintenance_required: filteredData.healthMaintenance.filter(item => item.status === 'due').length
        }
      };

      logger.info('Optimization data prepared', {
        trainsetCount: optimizationData.trainsets.length,
        maintenanceItems: optimizationData.health_and_maintenance.length,
        stablingBays: optimizationData.stabling_bays.length
      });

      return optimizationData;
      
    } catch (error) {
      logger.error('Failed to prepare optimization data', error);
      throw new Error(`Data preparation failed: ${error.message}`);
    }
  }

  /**
   * Filter data by date
   */
  filterDataByDate(data, targetDate) {
    // This is a simplified version - you might need more complex date filtering
    // based on your specific business requirements
    
    return {
      trainsets: data.trainsets.filter(trainset => {
        // Filter trainsets available on the target date
        return trainset.status !== 'out_of_service';
      }),
      healthMaintenance: data.healthMaintenance.filter(item => {
        // Filter maintenance items relevant to the target date
        const itemDate = new Date(item.date);
        return itemDate <= targetDate;
      }),
      brandingPriorities: data.brandingPriorities,
      stablingBays: data.stablingBays.filter(bay => {
        // Filter available stabling bays
        return bay.status === 'available';
      }),
      cleaningSlots: data.cleaningSlots.filter(slot => {
        // Filter cleaning slots for the target date
        const slotDate = new Date(slot.date);
        return slotDate.toDateString() === targetDate.toDateString();
      })
    };
  }

  /**
   * Create temporary input file for Python script
   */
  async createTempInputFile(data, optimizationId) {
    const tempDir = path.join(__dirname, '../../temp');
    const inputFile = path.join(tempDir, `optimization_input_${optimizationId}.json`);
    
    try {
      // Ensure temp directory exists
      await fs.mkdir(tempDir, { recursive: true });
      
      // Write optimization data to file
      await fs.writeFile(inputFile, JSON.stringify(data, null, 2));
      
      logger.info('Created temporary input file', { inputFile, optimizationId });
      return inputFile;
      
    } catch (error) {
      logger.error('Failed to create temporary input file', { error: error.message, optimizationId });
      throw new Error(`Failed to create input file: ${error.message}`);
    }
  }

  /**
   * Get optimization parameters based on mode
   */
  getOptimizationParams(mode) {
    const params = {
      quick: {
        population_size: 50,
        generations: 100,
        crossover_prob: 0.8,
        mutation_prob: 0.1
      },
      balanced: {
        population_size: 100,
        generations: 200,
        crossover_prob: 0.8,
        mutation_prob: 0.1
      },
      comprehensive: {
        population_size: 200,
        generations: 500,
        crossover_prob: 0.8,
        mutation_prob: 0.1
      }
    };
    
    return params[mode] || params.balanced;
  }

  /**
   * Execute Python optimization script
   */
  async executePythonOptimization(inputFile, params, optimizationId) {
    return new Promise((resolve, reject) => {
      const scriptPath = path.resolve(this.config.optimization.scriptPath);
      const pythonPath = this.config.optimization.pythonPath;
      
      logger.info('Starting Python optimization', {
        scriptPath,
        inputFile,
        optimizationId,
        params
      });
      
      // Build command arguments
      const args = [
        scriptPath,
        '--input', inputFile,
        '--population_size', params.population_size.toString(),
        '--generations', params.generations.toString(),
        '--crossover_prob', params.crossover_prob.toString(),
        '--mutation_prob', params.mutation_prob.toString(),
        '--output_format', 'json'
      ];
      
      // Track running optimization
      const optimizationProcess = {
        process: null,
        startTime: Date.now(),
        status: 'running'
      };
      
      this.runningOptimizations.set(optimizationId, optimizationProcess);
      
      // Spawn Python process
      const pythonProcess = spawn(pythonPath, args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      optimizationProcess.process = pythonProcess;
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        
        // Try to parse progress updates
        try {
          const lines = data.toString().split('\n');
          lines.forEach(line => {
            if (line.includes('Generation') || line.includes('Progress')) {
              logger.optimization('Optimization progress', {
                optimizationId,
                message: line.trim()
              });
            }
          });
        } catch (e) {
          // Ignore parsing errors for progress updates
        }
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        logger.warn('Python optimization warning', {
          optimizationId,
          message: data.toString()
        });
      });
      
      pythonProcess.on('close', (code) => {
        const endTime = Date.now();
        const duration = endTime - optimizationProcess.startTime;
        
        this.runningOptimizations.delete(optimizationId);
        
        logger.optimization('Python optimization finished', {
          optimizationId,
          exitCode: code,
          duration: `${duration}ms`
        });
        
        if (code === 0) {
          try {
            // Parse JSON output from Python script
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (error) {
            logger.error('Failed to parse optimization result', {
              optimizationId,
              stdout: stdout.substring(0, 500),
              error: error.message
            });
            reject(new Error(`Failed to parse optimization result: ${error.message}`));
          }
        } else {
          logger.error('Python optimization failed', {
            optimizationId,
            exitCode: code,
            stderr: stderr.substring(0, 500)
          });
          reject(new Error(`Optimization failed with exit code ${code}: ${stderr}`));
        }
      });
      
      pythonProcess.on('error', (error) => {
        this.runningOptimizations.delete(optimizationId);
        logger.error('Python process error', {
          optimizationId,
          error: error.message
        });
        reject(new Error(`Python process error: ${error.message}`));
      });
    });
  }

  /**
   * Process and validate optimization result
   */
  async processOptimizationResult(result, optimizationId) {
    try {
      // Validate result structure
      if (!result || typeof result !== 'object') {
        throw new Error('Invalid optimization result structure');
      }
      
      // Extract and validate key components
      const processedResult = {
        optimizationId,
        timestamp: new Date().toISOString(),
        objectives: result.objectives || {},
        solutions: result.solutions || [],
        metadata: {
          algorithm: 'NSGA-II',
          convergence: result.convergence || {},
          statistics: result.statistics || {},
          parameters: result.parameters || {}
        },
        recommendations: this.generateRecommendations(result),
        summary: this.generateSummary(result)
      };
      
      // Validate solutions
      if (processedResult.solutions.length === 0) {
        logger.warn('No solutions found in optimization result', { optimizationId });
      }
      
      // Add performance metrics
      processedResult.performance = {
        pareto_front_size: processedResult.solutions.length,
        objective_ranges: this.calculateObjectiveRanges(processedResult.solutions),
        solution_diversity: this.calculateSolutionDiversity(processedResult.solutions)
      };
      
      return processedResult;
      
    } catch (error) {
      logger.error('Failed to process optimization result', {
        optimizationId,
        error: error.message
      });
      throw new Error(`Result processing failed: ${error.message}`);
    }
  }

  /**
   * Generate recommendations based on optimization results
   */
  generateRecommendations(result) {
    const recommendations = [];
    
    if (result.solutions && result.solutions.length > 0) {
      const bestSolution = result.solutions[0]; // Assuming first solution is best compromise
      
      recommendations.push({
        type: 'schedule',
        priority: 'high',
        title: 'Recommended Schedule',
        description: 'Optimal trainset allocation based on multi-objective optimization',
        data: bestSolution
      });
      
      // Add specific recommendations based on objectives
      if (result.objectives) {
        if (result.objectives.mileage_efficiency) {
          recommendations.push({
            type: 'efficiency',
            priority: 'medium',
            title: 'Mileage Optimization',
            description: `Achieved ${(result.objectives.mileage_efficiency * 100).toFixed(1)}% mileage efficiency`
          });
        }
        
        if (result.objectives.punctuality_score) {
          recommendations.push({
            type: 'punctuality',
            priority: 'high',
            title: 'Punctuality Focus',
            description: `Optimized for ${(result.objectives.punctuality_score * 100).toFixed(1)}% punctuality score`
          });
        }
      }
    }
    
    return recommendations;
  }

  /**
   * Generate summary of optimization results
   */
  generateSummary(result) {
    const summary = {
      total_solutions: result.solutions?.length || 0,
      optimization_success: result.solutions?.length > 0,
      key_metrics: {},
      trade_offs: []
    };
    
    if (result.objectives) {
      summary.key_metrics = {
        mileage_efficiency: result.objectives.mileage_efficiency || 0,
        punctuality_score: result.objectives.punctuality_score || 0,
        branding_coverage: result.objectives.branding_coverage || 0
      };
    }
    
    return summary;
  }

  /**
   * Calculate objective ranges for solutions
   */
  calculateObjectiveRanges(solutions) {
    if (!solutions || solutions.length === 0) return {};
    
    const objectives = Object.keys(solutions[0].objectives || {});
    const ranges = {};
    
    objectives.forEach(objective => {
      const values = solutions.map(sol => sol.objectives[objective]).filter(val => val !== undefined);
      if (values.length > 0) {
        ranges[objective] = {
          min: Math.min(...values),
          max: Math.max(...values),
          mean: values.reduce((sum, val) => sum + val, 0) / values.length
        };
      }
    });
    
    return ranges;
  }

  /**
   * Calculate solution diversity metric
   */
  calculateSolutionDiversity(solutions) {
    if (!solutions || solutions.length < 2) return 0;
    
    // Simple diversity calculation based on objective space distance
    let totalDistance = 0;
    let comparisons = 0;
    
    for (let i = 0; i < solutions.length; i++) {
      for (let j = i + 1; j < solutions.length; j++) {
        const distance = this.calculateEuclideanDistance(
          solutions[i].objectives,
          solutions[j].objectives
        );
        totalDistance += distance;
        comparisons++;
      }
    }
    
    return comparisons > 0 ? totalDistance / comparisons : 0;
  }

  /**
   * Calculate Euclidean distance between two objective vectors
   */
  calculateEuclideanDistance(obj1, obj2) {
    const keys = Object.keys(obj1);
    const squaredDiffs = keys.map(key => {
      const diff = (obj1[key] || 0) - (obj2[key] || 0);
      return diff * diff;
    });
    return Math.sqrt(squaredDiffs.reduce((sum, val) => sum + val, 0));
  }

  /**
   * Clean up temporary file
   */
  async cleanupTempFile(filePath) {
    try {
      await fs.unlink(filePath);
      logger.info('Cleaned up temporary file', { filePath });
    } catch (error) {
      logger.warn('Failed to clean up temporary file', { filePath, error: error.message });
    }
  }

  /**
   * Validate optimization parameters
   */
  async validateParameters(params) {
    const { date, constraints, preferences } = params;
    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    };
    
    // Validate date
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      validation.isValid = false;
      validation.errors.push('Invalid date format');
    }
    
    if (targetDate < new Date()) {
      validation.warnings.push('Optimization date is in the past');
    }
    
    // Validate constraints
    if (constraints && typeof constraints === 'object') {
      // Add specific constraint validations here
      if (constraints.max_trainsets && constraints.max_trainsets < 1) {
        validation.isValid = false;
        validation.errors.push('max_trainsets must be at least 1');
      }
    }
    
    // Check data availability
    try {
      const dataAvailability = await this.checkDataAvailability(date);
      if (!dataAvailability.sufficient) {
        validation.warnings.push('Insufficient data for optimal results');
      }
    } catch (error) {
      validation.warnings.push('Could not verify data availability');
    }
    
    return validation;
  }

  /**
   * Check data availability for optimization
   */
  async checkDataAvailability(date) {
    try {
      const [trainsets, healthMaintenance, brandingPriorities] = await Promise.all([
        dbOperations.getAll('trainsets'),
        dbOperations.getAll('health_and_maintenance'),
        dbOperations.getAll('branding_priorities')
      ]);
      
      return {
        sufficient: trainsets.length > 0 && healthMaintenance.length > 0,
        trainsets: trainsets.length,
        maintenance_records: healthMaintenance.length,
        branding_records: brandingPriorities.length
      };
    } catch (error) {
      logger.error('Failed to check data availability', error);
      return { sufficient: false, error: error.message };
    }
  }

  /**
   * Get optimization status for a running optimization
   */
  async getOptimizationStatus(optimizationId) {
    const runningOptimization = this.runningOptimizations.get(optimizationId);
    
    if (!runningOptimization) {
      return {
        status: 'unknown',
        progress: 0,
        currentPhase: 'unknown'
      };
    }
    
    const elapsed = Date.now() - runningOptimization.startTime;
    
    return {
      status: runningOptimization.status,
      progress: Math.min(elapsed / 60000, 90), // Rough progress estimate
      currentPhase: 'optimization',
      elapsedTime: elapsed,
      estimatedTimeRemaining: Math.max(60000 - elapsed, 0)
    };
  }

  /**
   * Load optimization templates
   */
  loadOptimizationTemplates() {
    return [
      {
        id: 'quick_daily',
        name: 'Quick Daily Optimization',
        description: 'Fast optimization for daily scheduling',
        mode: 'quick',
        constraints: {
          max_computation_time: 60,
          focus_objectives: ['punctuality', 'efficiency']
        }
      },
      {
        id: 'comprehensive_weekly',
        name: 'Comprehensive Weekly Planning',
        description: 'Detailed optimization for weekly planning',
        mode: 'comprehensive',
        constraints: {
          max_computation_time: 300,
          focus_objectives: ['mileage', 'punctuality', 'branding']
        }
      },
      {
        id: 'maintenance_focused',
        name: 'Maintenance-Focused Scheduling',
        description: 'Optimization prioritizing maintenance requirements',
        mode: 'balanced',
        constraints: {
          prioritize_maintenance: true,
          maintenance_window_flexibility: 0.5
        }
      }
    ];
  }

  /**
   * Get optimization templates
   */
  async getOptimizationTemplates() {
    return this.optimizationTemplates;
  }
}

module.exports = new OptimizationService();
