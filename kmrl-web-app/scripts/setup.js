const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function createDirectoryIfNotExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log(`✅ Created directory: ${dir}`, 'green');
  } else {
    log(`📁 Directory already exists: ${dir}`, 'yellow');
  }
}

function copyFileIfNotExists(source, destination) {
  if (!fs.existsSync(destination)) {
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, destination);
      log(`✅ Created: ${destination}`, 'green');
    } else {
      log(`❌ Source file not found: ${source}`, 'red');
    }
  } else {
    log(`📄 File already exists: ${destination}`, 'yellow');
  }
}

function checkPythonDependencies() {
  log('\n🐍 Checking Python dependencies...', 'cyan');
  
  const requiredPackages = [
    'pandas',
    'numpy', 
    'pymoo',
    'matplotlib',
    'firebase-admin',
    'python-dotenv'
  ];

  const missingPackages = [];

  for (const pkg of requiredPackages) {
    try {
      execSync(`python -c "import ${pkg.replace('-', '_')}"`, { stdio: 'ignore' });
      log(`✅ ${pkg} is installed`, 'green');
    } catch (error) {
      missingPackages.push(pkg);
      log(`❌ ${pkg} is missing`, 'red');
    }
  }

  if (missingPackages.length > 0) {
    log('\n🔧 Installing missing Python packages...', 'yellow');
    try {
      execSync(`pip install ${missingPackages.join(' ')}`, { stdio: 'inherit' });
      log('✅ Python dependencies installed successfully!', 'green');
    } catch (error) {
      log('❌ Failed to install Python dependencies. Please install manually:', 'red');
      log(`pip install ${missingPackages.join(' ')}`, 'cyan');
    }
  } else {
    log('✅ All Python dependencies are installed!', 'green');
  }
}

function setupEnvironmentFile() {
  log('\n⚙️ Setting up environment configuration...', 'cyan');
  
  if (!fs.existsSync('.env')) {
    copyFileIfNotExists('.env.example', '.env');
    log('\n📝 Please edit the .env file with your configuration:', 'yellow');
    log('   - Firebase project ID and service account path', 'yellow');
    log('   - Gemini AI API key', 'yellow');
    log('   - JWT secrets (change the default values!)', 'yellow');
    log('   - Other configuration as needed', 'yellow');
  }
}

function createRequiredDirectories() {
  log('\n📁 Creating required directories...', 'cyan');
  
  const directories = [
    'logs',
    'temp',
    'uploads',
    'backups',
    'src/config'
  ];

  directories.forEach(createDirectoryIfNotExists);
}

function createGitignore() {
  const gitignoreContent = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Firebase
src/config/firebase-service-account.json
firebase-debug.log
.firebase/

# Logs
logs/
*.log

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# Dependency directories
node_modules/
jspm_packages/

# Optional npm cache directory
.npm

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variables file
.env

# next.js build output
.next

# Nuxt.js build output
.nuxt

# Gatsby files
.cache/
public

# Storybook build outputs
.out
.storybook-out

# Temporary folders
tmp/
temp/

# Editor directories and files
.vscode/
.idea/
*.swp
*.swo
*~

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
ENV/
env.bak/
venv.bak/

# Uploads
uploads/*
!uploads/.gitkeep

# Backups
backups/*
!backups/.gitkeep

# Testing
coverage/
.nyc_output/

# Build outputs
dist/
build/

# Documentation
docs/generated/

# Optimization results
optimization_results/
*.png
*.jpg
*.jpeg
*.pdf
`;

  if (!fs.existsSync('.gitignore')) {
    fs.writeFileSync('.gitignore', gitignoreContent);
    log('✅ Created .gitignore file', 'green');
  } else {
    log('📄 .gitignore already exists', 'yellow');
  }
}

function createPlaceholderFiles() {
  log('\n📄 Creating placeholder files...', 'cyan');
  
  const placeholders = [
    { path: 'uploads/.gitkeep', content: '' },
    { path: 'backups/.gitkeep', content: '' },
    { path: 'temp/.gitkeep', content: '' },
    { path: 'logs/.gitkeep', content: '' }
  ];

  placeholders.forEach(({ path: filePath, content }) => {
    if (!fs.existsSync(filePath)) {
      createDirectoryIfNotExists(path.dirname(filePath));
      fs.writeFileSync(filePath, content);
      log(`✅ Created: ${filePath}`, 'green');
    }
  });
}

function displayNextSteps() {
  log('\n🎉 Setup completed successfully!', 'green');
  log('\n📋 Next Steps:', 'cyan');
  log('1. Edit the .env file with your configuration', 'white');
  log('2. Add your Firebase service account key to src/config/', 'white');
  log('3. Make sure optimization_engine_v3.py is in the project root', 'white');
  log('4. Start the development server:', 'white');
  log('   npm run dev', 'cyan');
  log('\n🔗 Useful Commands:', 'cyan');
  log('   npm start          - Start production server', 'white');
  log('   npm run dev        - Start development server', 'white');
  log('   npm test           - Run tests', 'white');
  log('   npm run lint       - Lint code', 'white');
  log('   npm run docs       - Generate documentation', 'white');
  log('\n📖 Check README.md for detailed documentation!', 'blue');
}

function checkOptimizationEngine() {
  log('\n🔍 Checking for optimization engine...', 'cyan');
  
  const enginePath = path.join(process.cwd(), 'optimization_engine_v3.py');
  if (fs.existsSync(enginePath)) {
    log('✅ optimization_engine_v3.py found', 'green');
  } else {
    log('❌ optimization_engine_v3.py not found in project root', 'red');
    log('   Please copy your optimization engine to the project root', 'yellow');
  }
}

function main() {
  log('🚀 KMRL Fleet Management System - Setup Script', 'bright');
  log('================================================', 'cyan');
  
  try {
    createRequiredDirectories();
    setupEnvironmentFile();
    createGitignore();
    createPlaceholderFiles();
    checkOptimizationEngine();
    checkPythonDependencies();
    displayNextSteps();
  } catch (error) {
    log(`\n❌ Setup failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run setup if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = {
  createDirectoryIfNotExists,
  copyFileIfNotExists,
  checkPythonDependencies,
  setupEnvironmentFile
};
