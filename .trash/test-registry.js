// Test script for Skill Registry
const SkillRegistry = require('./registry');
const path = require('path');

async function testRegistry() {
  console.log('Testing Skill Registry...');
  
  // When running from skills directory, skills are in current directory
  const registry = new SkillRegistry('.');
  
  // Load the skill index
  const loaded = await registry.loadIndex();
  console.log('Index loaded:', loaded);
  
  // List all skills
  const skills = registry.listSkills();
  console.log('Available skills:', skills);
  
  // Get a specific skill
  const dbSkill = registry.getSkill('database-design');
  if (dbSkill) {
    console.log('Database skill found:', dbSkill.name);
    console.log('Database skill metadata:', dbSkill.metadata);
  } else {
    console.log('Database skill not found');
  }
  
  // Search skills
  const researchSkills = registry.searchSkills('research');
  console.log('Research skills:', researchSkills);
  
  // Get skills by agent
  const buildSkills = registry.getSkillsByAgent('build');
  console.log('Build agent skills:', buildSkills);
  
  // Get skills by category
  const laravelSkills = registry.getSkillsByCategory('laravel');
  console.log('Laravel skills:', laravelSkills);
}

testRegistry().catch(console.error);