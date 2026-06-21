const { Parser } = require('expr-eval');

class LeaveFormulaParser {
    constructor() {
        this.parser = new Parser();

        // Standard custom functions requested by HR Formula Engine
        this.parser.functions.IF = function(condition, trueValue, falseValue) {
            return condition ? trueValue : falseValue;
        };

        this.parser.functions.AND = function(...args) {
            return args.every(val => !!val);
        };

        this.parser.functions.OR = function(...args) {
            return args.some(val => !!val);
        };

        this.parser.functions.MIN = Math.min;
        this.parser.functions.MAX = Math.max;
        this.parser.functions.ROUND = function(value, decimals = 0) {
            const factor = Math.pow(10, decimals);
            return Math.round(value * factor) / factor;
        };

        this.parser.functions.CEIL = Math.ceil;
        this.parser.functions.FLOOR = Math.floor;
    }

    /**
     * Pre-process formula string to ensure compatibility with expr-eval
     * (e.g. converting single = to == for comparison if necessary, but expr-eval handles some of this)
     */
    preprocess(formulaStr) {
        let processed = formulaStr;
        // Convert single = to == if it's used as a comparison (simplistic approach, expr-eval allows == natively)
        // Note: expr-eval strictly requires == for equality, HR might type =
        // Regex to replace = with == but avoid replacing >=, <=, !=, ==
        processed = processed.replace(/(?<![<>=!])=(?![=])/g, '==');
        
        // Also expr-eval uses "and" and "or" (lowercase) for boolean logic, whereas HR might use "AND", "OR"
        processed = processed.replace(/\bAND\b/g, 'and');
        processed = processed.replace(/\bOR\b/g, 'or');
        
        return processed;
    }

    /**
     * Evaluates a formula safely with a given context of variables
     * @param {string} formulaStr - The HR formula string e.g. "IF(GENDER == 'Female', 182, 0)"
     * @param {Object} context - The variables object e.g. { GENDER: 'Female', SERVICE_MONTHS: 8 }
     * @returns {number|string|boolean} - The evaluated output
     */
    evaluate(formulaStr, context = {}) {
        try {
            if (!formulaStr) return 0;
            const cleanedFormula = this.preprocess(formulaStr);
            const expr = this.parser.parse(cleanedFormula);
            return expr.evaluate(context);
        } catch (error) {
            throw new Error(`Formula Evaluation Error: ${error.message}. (Formula: ${formulaStr})`);
        }
    }

    /**
     * Validates a formula without evaluating its actual logic to check syntax
     * @param {string} formulaStr 
     * @returns {boolean}
     */
    validate(formulaStr) {
        try {
            if (!formulaStr) return true; // empty is valid as 0
            const cleanedFormula = this.preprocess(formulaStr);
            this.parser.parse(cleanedFormula);
            return true;
        } catch (error) {
            return false;
        }
    }
}

module.exports = new LeaveFormulaParser();
