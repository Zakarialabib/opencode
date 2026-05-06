const Ajv = require("ajv");
const fs = require("fs");
const path = require("path");

class ConfigValidator {
  constructor(schemaPath) {
    this.ajv = new Ajv({ allErrors: true, verbose: true });
    this.schema = null;
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

    const validate = this.ajv.compile(this.schema);
    const valid = validate(config);

    if (!valid) {
      return {
        valid: false,
        errors: validate.errors.map((error) => ({
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

module.exports = ConfigValidator;
