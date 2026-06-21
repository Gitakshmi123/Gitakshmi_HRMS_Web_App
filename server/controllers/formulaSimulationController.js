const LeaveFormulaParser = require('../utils/formulaParser');

exports.simulateFormula = async (req, res) => {
    try {
        const { formula, context } = req.body;

        if (!formula) {
            return res.status(400).json({ error: 'Formula expression is required.' });
        }

        const evaluationContext = context || {};
        
        // Use the parser to validate and evaluate
        const result = LeaveFormulaParser.evaluate(formula, evaluationContext);
        
        res.json({
            success: true,
            formula,
            context: evaluationContext,
            result: result
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
};

exports.explainFormula = async (req, res) => {
    // Basic AI/regex-based explanation generation (can be expanded)
    try {
        const { formula } = req.body;
        if (!formula) {
            return res.status(400).json({ error: 'Formula expression is required.' });
        }

        let explanation = "This formula calculates leave eligibility based on the given parameters.";
        
        if (formula.includes('DOJ Proration') || formula.includes('REMAINING_MONTHS')) {
            explanation = "Calculates leave incrementally based on the employee's exact Date of Joining (Pro-rated).";
        } else if (formula.includes('GENDER')) {
            explanation = "This formula is conditionally restricted based on the employee's Gender.";
        } else if (formula.includes('IF(') && formula.includes('AND(')) {
            explanation = "Checks multiple conditions simultaneously (e.g. Tenure and Attendance thresholds). If all conditions are met, leaves are credited.";
        }

        // Just returning the generic mapping for now, but parser could walk AST to generate english
        res.json({ success: true, explanation });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
