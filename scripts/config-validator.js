const Ajv = require("ajv");
const fs = require("fs");
const path = require("path");

class ConfigValidator {
  constructor(schemaPath) {
    this.ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false });
    this.schema = null;
    this.compiledValidate = null;
    if (schemaPath) {
      this.loadSchema(schemaPath);
    }
  }

  loadSchema(schemaPath) {
    try {
      const schemaContent = fs.readFileSync(schemaPath, "utf8");
      this.schema = JSON.parse(schemaContent);
      return true;
    } catch (error) {
      console.error(`Failed to load schema from ${schemaPath}:`, error);
      return false;
    }
  }

  validateConfig(config) {
    if (!this.schema) {
      throw new Error("No schema loaded for validation");
    }

    if (!this.compiledValidate) {
      this.compiledValidate = this.ajv.compile(this.schema);
    }
    const valid = this.compiledValidate(config);

    if (!valid) {
      return {
        valid: false,
        errors: this.compiledValidate.errors.map((error) => ({
          message: error.message,
          path: error.instancePath ? error.instancePath.slice(1) : [],
          schemaPath: error.schemaPath,
          keyword: error.keyword,
          params: error.params,
        })),
      };
    }

    return { valid: true, errors: [] };
  }

  validateConfigFile(filePath) {
    try {
      const configContent = fs.readFileSync(filePath, "utf8");
      const config = JSON.parse(configContent);
      return this.validateConfig(config);
    } catch (error) {
      return {
        valid: false,
        errors: [
          {
            message: `Failed to parse config file: ${error.message}`,
            path: [],
            schemaPath: "",
            keyword: "type",
            params: { type: "object" },
          },
        ],
      };
    }
  }
}

if (require.main === module) {
  const [configPath = "opencode.json", schemaPath = "config-schema.json"] = process.argv.slice(2);
  const validator = new ConfigValidator(schemaPath);
  const result = validator.validateConfigFile(configPath);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.valid ? 0 : 1);
}

module.exports = ConfigValidator;
