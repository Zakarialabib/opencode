const ConfigValidator = require('./config-validator');
const path = require('path');

async function testValidator() {
  console.log('Testing Config Validator...');
  
  const validator = new ConfigValidator(path.join(__dirname, 'config-schema.json'));
  
  // Validate the current opencode.json
  const result = validator.validateConfigFile(path.join(__dirname, 'opencode.json'));
  
  console.log('Validation result:', JSON.stringify(result, null, 2));
  
  if (result.valid) {
    console.log('✓ Configuration is valid');
  } else {
    console.log('✗ Configuration has errors:');
    result.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error.message}`);
      if (error.path.length > 0) {
        console.log(`     Path: ${error.path.join('.')}`);
      }
    });
  }
}

testValidator().catch(console.error);