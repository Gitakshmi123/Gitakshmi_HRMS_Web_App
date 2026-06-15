class SalaryCalculationEngine {
    static calculateSalary({ annualCTC = 0, earnings = [], deductions = [], benefits = [], payrollContext = {}, employeeCategory = 'GENERAL', minWageAmount = 0 }) {
        const ctc = this._safeNum(annualCTC);
        if (ctc <= 0) return this._emptyResult(ctc, payrollContext);

        const ctxRules = this._normalizePayrollContext(payrollContext);
        const monthlyCTC = this._round(ctc / 12);
        
        // 1. Minimum Wage logic
        const effectiveMinWage = this._safeNum(minWageAmount);
        
        // 2. Determine Basic Salary (Dynamic & Custom logic)
        let basicMonthly = 0;
        let basicAnnual = 0;

        const dbBasicComp = earnings.find(e => {
            if (!e) return false;
            const name = (e.name || '').toUpperCase();
            const code = (e.code || '').toUpperCase();
            return code === 'BASIC' || name === 'BASIC' || name === 'BASIC SALARY' || name === 'BASIC PAY';
        });

        if (dbBasicComp && dbBasicComp.calculationType) {
            const calcType = String(dbBasicComp.calculationType || 'PERCENTAGE_OF_CTC').toUpperCase();
            const value = parseFloat(dbBasicComp.value ?? dbBasicComp.percentage ?? dbBasicComp.amount ?? 0) || 0;
            if (calcType.includes('PERCENTAGE_OF_CTC') || calcType.includes('PERCENT_CTC') || (calcType.includes('PERCENT') && !calcType.includes('BASIC'))) {
                basicMonthly = this._round((monthlyCTC * value) / 100);
            } else if (calcType.includes('FIXED') || calcType.includes('FLAT')) {
                basicMonthly = this._round(value);
            } else {
                const halfCTC = this._round(monthlyCTC * 0.5);
                basicMonthly = Math.max(halfCTC, effectiveMinWage);
            }
        } else {
            const halfCTC = this._round(monthlyCTC * 0.5);
            basicMonthly = Math.max(halfCTC, effectiveMinWage);
        }
        basicAnnual = this._round(basicMonthly * 12);

        const workingEarnings = this._withAutoEarnings(earnings, ctxRules);
        const workingBenefits = this._withAutoBenefits(benefits, ctxRules, monthlyCTC);
        const workingDeductions = this._withAutoDeductions(deductions, ctxRules, monthlyCTC);

        const ctx = {
            annualCTC: ctc,
            monthlyCTC,
            basicAnnual,
            basicMonthly,
            grossMonthly: 0,
            grossAnnual: 0,
            payrollContext: ctxRules,
            componentValues: {
                CTC: ctc,
                ANNUAL_CTC: ctc,
                MONTHLY_CTC: monthlyCTC,
                BASIC: basicMonthly,
                BASIC_MONTHLY: basicMonthly,
                BASIC_ANNUAL: basicAnnual
            }
        };

        const result = {
            annualCTC: ctc,
            payrollContext: ctxRules,
            earnings: [],
            deductions: [],
            benefits: [],
            employerContributions: [], // Grouped for Excel-style view
            retirementBenefits: [],    // Gross B components
            totals: {
                grossA: 0,
                grossB: 0,
                totalCTC: ctc,
                netTakeHome: 0
            }
        };

        // 3. Process Basic Salary
        const basicComp = workingEarnings.find(e => this._isBasic(e)) || { name: 'Basic Salary' };
        const basicResult = {
            ...basicComp,
            code: 'BASIC',
            name: basicComp.name || 'Basic Salary',
            calculationType: 'MIN_WAGE_ADJUSTED',
            value: basicMonthly,
            basedOn: 'MW_OR_50PCT',
            monthly: basicMonthly,
            yearly: basicAnnual
        };
        result.earnings.push(basicResult);
        this._setComponentValue(ctx, basicResult);

        let totalFixedEarningsAnnual = basicAnnual;
        let totalEmployerContribAnnual = 0;
        let totalRetirementAnnual = 0;

        // 4. Process Other Earnings (Except Special Allowance)
        workingEarnings
            .filter(e => !this._isBasic(e) && !this._isSpecial(e))
            .forEach(e => {
                const code = this._deriveCode(e);
                // Requirement: IF Basic is set to Minimum Wage (because 50% CTC < MW), 
                // then HRA and Conveyance must be 0.
                if (basicMonthly === effectiveMinWage && (code === 'HOUSE_RENT_ALLOWANCE' || code === 'CONVEYANCE' || code === 'COMPENSATORY_ALLOWANCE')) {
                    e.value = 0;
                    e.calculationType = 'FIXED';
                }
                const calc = this._processComponent(e, ctx);
                result.earnings.push(calc);
                totalFixedEarningsAnnual += calc.yearly;
                this._setComponentValue(ctx, calc);
            });

        // 5. Process Employer Contributions (Part of Gross A)
        workingBenefits.filter(b => !this._isRetirement(b)).forEach(b => {
            const calc = this._processComponent(b, ctx);
            result.employerContributions.push(calc);
            result.benefits.push(calc);
            totalEmployerContribAnnual += calc.yearly;
            this._setComponentValue(ctx, calc);
        });

        // 6. Process Retirement Benefits (Gross B)
        workingBenefits.filter(b => this._isRetirement(b)).forEach(b => {
            const calc = this._processComponent(b, ctx);
            result.retirementBenefits.push(calc);
            result.benefits.push(calc);
            totalRetirementAnnual += calc.yearly;
            this._setComponentValue(ctx, calc);
        });

        // 7. Auto Balancing Logic (Special Allowance)
        // Final CTC = Gross A + Gross B
        // Gross A = All Earnings + Employer Contributions
        // => All Earnings = Final CTC - Gross B - Employer Contributions
        let saAnnual = this._round(ctc - (totalFixedEarningsAnnual + totalEmployerContribAnnual + totalRetirementAnnual));
        if (saAnnual < 0 && Math.abs(saAnnual) <= 0.05) saAnnual = 0; // Tiny float tolerance, otherwise allow negative values to balance CTC

        const saMonthly = this._round(saAnnual / 12);
        const saOriginal = workingEarnings.find(e => this._isSpecial(e)) || { name: 'Special Allowance' };
        const specialAllowance = {
            ...saOriginal,
            code: 'SPECIAL_ALLOWANCE',
            name: saOriginal.name || 'Special Allowance',
            calculationType: 'FIXED',
            value: saMonthly,
            basedOn: 'NA',
            monthly: saMonthly,
            yearly: saAnnual,
            isSystemGenerated: true
        };
        result.earnings.push(specialAllowance);
        this._setComponentValue(ctx, specialAllowance);

        const totalEarningsAnnual = totalFixedEarningsAnnual + saAnnual;
        ctx.grossAnnual = totalEarningsAnnual;
        ctx.grossMonthly = this._round(totalEarningsAnnual / 12);
        ctx.componentValues.GROSS = ctx.grossMonthly;
        ctx.componentValues.NET = ctx.grossMonthly;

        // 8. Process Deductions
        let totalDeductionsAnnual = 0;
        workingDeductions.forEach(d => {
            const calc = this._processComponent(d, ctx);
            result.deductions.push(calc);
            totalDeductionsAnnual += calc.yearly;
            this._setComponentValue(ctx, calc);
            ctx.componentValues.NET = this._round(ctx.componentValues.NET - calc.monthly);
        });

        // 9. Final Totals (Excel Style)
        result.totals = {
            grossA_Monthly: this._round((totalEarningsAnnual + totalEmployerContribAnnual) / 12),
            grossA_Yearly: totalEarningsAnnual + totalEmployerContribAnnual,
            grossB_Monthly: this._round(totalRetirementAnnual / 12),
            grossB_Yearly: totalRetirementAnnual,
            totalCTC: ctc,
            deductionMonthly: this._round(totalDeductionsAnnual / 12),
            takeHomeMonthly: this._round((totalEarningsAnnual - totalDeductionsAnnual) / 12),
            takeHomeYearly: totalEarningsAnnual - totalDeductionsAnnual
        };

        return result;
    }

    static _processComponent(comp, ctx) {
        const code = this._deriveCode(comp);
        const calcType = String(comp.calculationType || comp.amountType || 'FIXED').toUpperCase();
        const basedOn = String(comp.basedOn || comp.calculationBase || 'NA').toUpperCase();
        const isFormula = calcType.includes('FORMULA') || Boolean(comp.formula);
        let value = 0;
        if (calcType.includes('PERCENT') || ['BASIC', 'CTC', 'GROSS'].includes(basedOn)) {
            value = parseFloat(comp.percentage ?? comp.value ?? comp.amount ?? comp.amountValue ?? 0) || 0;
        } else {
            value = parseFloat(comp.value ?? comp.amount ?? comp.percentage ?? comp.amountValue ?? 0) || 0;
        }
        let monthly = 0;

        if (isFormula) {
            const raw = this._evaluateFormula(comp.formula || String(value || 0), ctx.componentValues);
            monthly = this._round(String(comp.formulaFrequency || 'MONTHLY').toUpperCase() === 'ANNUAL' ? raw / 12 : raw);
        } else if (comp.isManual) {
            monthly = this._round(value);
            return {
                ...comp,
                code,
                name: comp.name || code,
                calculationType: 'FIXED',
                value,
                basedOn: 'NA',
                monthly,
                isManual: true,
                yearly: this._round(monthly * 12)
            };
        } else if (calcType.includes('PERCENTAGE_OF_CTC') || (calcType.includes('PERCENT') && (calcType.includes('CTC') || basedOn === 'CTC'))) {
            monthly = this._round((ctx.monthlyCTC * value) / 100);
        } else if (calcType.includes('PERCENTAGE_OF_BASIC') || calcType.includes('PERCENT_OF_BASIC') || (calcType.includes('PERCENT') && basedOn === 'BASIC')) {
            monthly = this._round((ctx.basicMonthly * value) / 100);
        } else if (calcType.includes('PERCENT') && basedOn === 'GROSS') {
            monthly = this._round((ctx.grossMonthly * value) / 100);
        } else {
            monthly = this._round(value);
        }

        monthly = this._applyStatutoryOverride(code, monthly, comp, ctx, value, calcType);

        return {
            ...comp,
            code,
            name: comp.name || code,
            calculationType: isFormula ? 'FORMULA' : calcType,
            value,
            basedOn,
            monthly,
            yearly: this._round(monthly * 12)
        };
    }

    static _applyStatutoryOverride(code, currentMonthly, comp, ctx, configuredValue, calcType) {
        if (comp.isManual || calcType.includes('FORMULA') || comp.isSystemGenerated !== true) return currentMonthly;

        const payroll = ctx.payrollContext || {};
        const rules = payroll.companyRules || {};
        const policy = payroll.locationPolicy || {};

        if (code === 'HOUSE_RENT_ALLOWANCE' && policy.hra?.enabled !== false) {
            // If explicitly zeroed out (e.g. for min wage logic), keep it zero
            if (calcType === 'FIXED' && configuredValue === 0) return 0;
            const hraPercentage = this._safeNum(policy.hra?.percentageOfBasic || configuredValue || 0);
            if (hraPercentage > 0) return this._round((ctx.basicMonthly * hraPercentage) / 100);
        }

        if (code === 'PROFESSIONAL_TAX') {
            const ptPolicy = policy.professionalTax || {};
            if (ptPolicy.enabled === false) return 0;
            
            // If slabs are provided, calculate based on Gross
            if (Array.isArray(ptPolicy.slabs) && ptPolicy.slabs.length > 0) {
                const income = ctx.grossMonthly || ctx.monthlyCTC;
                const match = ptPolicy.slabs.find(slab => {
                    const min = this._safeNum(slab.minIncome);
                    const max = slab.maxIncome === null || slab.maxIncome === undefined ? Infinity : this._safeNum(slab.maxIncome);
                    return income >= min && income <= max;
                });
                if (match) return this._round(match.amount);
            }
            
            return this._round(ptPolicy.defaultAmount ?? ptPolicy.amount ?? currentMonthly);
        }

        if (code === 'GRATUITY') {
            return this._round(ctx.basicMonthly * 0.0481);
        }

        if (code === 'EMPLOYEE_PF' || code === 'EMPLOYER_PF' || code === 'PF') {
            const pfRules = rules.pf || {};
            if (pfRules.enabled === false) return 0;
            const rate = this._safeNum(code === 'EMPLOYER_PF' ? pfRules.employerRate : pfRules.employeeRate) || 12;
            const wageCeiling = this._safeNum(pfRules.wageCeiling || 15000);
            const base = pfRules.capContribution === false ? ctx.basicMonthly : Math.min(ctx.basicMonthly, wageCeiling);
            return this._round((base * rate) / 100);
        }

        if (code === 'EMPLOYEE_ESI' || code === 'EMPLOYER_ESI' || code === 'ESI') {
            const esiRules = rules.esic || {};
            const esiApplicable = policy.statutoryApplicability?.esiApplicable;
            if (esiRules.enabled === false || esiApplicable === false) return 0;
            const wageCeiling = this._safeNum(esiRules.wageCeiling || 21000);
            const wageBase = ctx.grossMonthly || ctx.monthlyCTC;
            if (wageBase > wageCeiling) return 0;
            const rate = this._safeNum(code === 'EMPLOYER_ESI' ? esiRules.employerRate : esiRules.employeeRate) || (code === 'EMPLOYER_ESI' ? 3.25 : 0.75);
            return this._round((wageBase * rate) / 100);
        }

        if (code === 'LWF_EMPLOYEE') {
            return this._round(policy.statutoryApplicability?.lwfEmployeeAmount ?? currentMonthly);
        }

        if (code === 'LWF_EMPLOYER') {
            return this._round(policy.statutoryApplicability?.lwfEmployerAmount ?? currentMonthly);
        }

        return currentMonthly;
    }

    static _withAutoEarnings(earnings, ctx) {
        const list = [...(earnings || [])];
        const policy = ctx.locationPolicy || {};

        if (ctx.applyStatutory !== false && policy.hra?.enabled !== false && !this._hasComponent(list, ['HOUSE_RENT_ALLOWANCE'])) {
            const pct = this._safeNum(policy.hra?.percentageOfBasic);
            if (pct > 0) {
                list.push({
                    code: 'HOUSE_RENT_ALLOWANCE',
                    name: 'House Rent Allowance',
                    calculationType: 'PERCENTAGE_OF_BASIC',
                    basedOn: 'BASIC',
                    value: pct,
                    percentage: pct,
                    isSystemGenerated: true
                });
            }
        }

        const localAllowance = policy.localAllowance || {};
        if (ctx.applyStatutory !== false && localAllowance.includedInCtc === true && this._safeNum(localAllowance.amount) > 0 && !this._hasComponent(list, ['LOCAL_ALLOWANCE'])) {
            list.push({
                code: 'LOCAL_ALLOWANCE',
                name: localAllowance.label || 'Local Allowance',
                calculationType: 'FIXED',
                value: this._safeNum(localAllowance.amount),
                basedOn: 'NA',
                isSystemGenerated: true
            });
        }

        return list;
    }

    static _withAutoBenefits(benefits, ctx, monthlyCTC) {
        const list = [...(benefits || [])];
        const rules = ctx.companyRules || {};
        const policy = ctx.locationPolicy || {};

        if (ctx.applyStatutory !== false && rules.pf?.enabled !== false && rules.pf?.includeInCTC !== false && !this._hasComponent(list, ['EMPLOYER_PF'])) {
            list.push({ code: 'EMPLOYER_PF', name: 'Employer PF', calculationType: 'STATUTORY', basedOn: 'BASIC', isSystemGenerated: true });
        }

        const esiEligible = rules.esic?.enabled !== false && policy.statutoryApplicability?.esiApplicable !== false && monthlyCTC <= this._safeNum(rules.esic?.wageCeiling || 21000);
        if (ctx.applyStatutory !== false && esiEligible && rules.esic?.includeInCTC !== false && !this._hasComponent(list, ['EMPLOYER_ESI'])) {
            list.push({ code: 'EMPLOYER_ESI', name: 'Employer ESI', calculationType: 'STATUTORY', basedOn: 'GROSS', isSystemGenerated: true });
        }

        if (ctx.applyStatutory !== false && policy.statutoryApplicability?.lwfEnabled === true && this._safeNum(policy.statutoryApplicability?.lwfEmployerAmount) > 0 && !this._hasComponent(list, ['LWF_EMPLOYER'])) {
            list.push({ code: 'LWF_EMPLOYER', name: 'Employer LWF', calculationType: 'STATUTORY', basedOn: 'NA', isSystemGenerated: true });
        }

        return list;
    }

    static _withAutoDeductions(deductions, ctx, monthlyCTC) {
        const list = [...(deductions || [])];
        const rules = ctx.companyRules || {};
        const policy = ctx.locationPolicy || {};

        if (ctx.applyStatutory !== false && rules.pf?.enabled !== false && !this._hasComponent(list, ['EMPLOYEE_PF', 'PF'])) {
            list.push({ code: 'EMPLOYEE_PF', name: 'Employee PF', calculationType: 'STATUTORY', basedOn: 'BASIC', isSystemGenerated: true });
        }

        const esiEligible = rules.esic?.enabled !== false && policy.statutoryApplicability?.esiApplicable !== false && monthlyCTC <= this._safeNum(rules.esic?.wageCeiling || 21000);
        if (ctx.applyStatutory !== false && esiEligible && !this._hasComponent(list, ['EMPLOYEE_ESI', 'ESI'])) {
            list.push({ code: 'EMPLOYEE_ESI', name: 'Employee ESI', calculationType: 'STATUTORY', basedOn: 'GROSS', isSystemGenerated: true });
        }

        const ptPolicy = policy.professionalTax || {};
        const ptEnabled = ptPolicy.enabled !== false && (this._safeNum(ptPolicy.amount) > 0 || (Array.isArray(ptPolicy.slabs) && ptPolicy.slabs.length > 0));
        
        if (ctx.applyStatutory !== false && ptEnabled && !this._hasComponent(list, ['PROFESSIONAL_TAX'])) {
            list.push({ code: 'PROFESSIONAL_TAX', name: 'Professional Tax', calculationType: 'STATUTORY', basedOn: 'NA', isSystemGenerated: true });
        }

        if (ctx.applyStatutory !== false && policy.statutoryApplicability?.lwfEnabled === true && this._safeNum(policy.statutoryApplicability?.lwfEmployeeAmount) > 0 && !this._hasComponent(list, ['LWF_EMPLOYEE'])) {
            list.push({ code: 'LWF_EMPLOYEE', name: 'Employee LWF', calculationType: 'STATUTORY', basedOn: 'NA', isSystemGenerated: true });
        }

        return list;
    }

    static _normalizePayrollContext(payrollContext = {}) {
        const locationPolicy = payrollContext.locationPolicy || payrollContext.resolvedPolicy || {};
        const companyRules = payrollContext.companyRules || {};
        return {
            ...payrollContext,
            applyStatutory: payrollContext.applyStatutory !== false,
            companyRules,
            locationPolicy,
            locationPolicySnapshot: payrollContext.locationPolicySnapshot || payrollContext.snapshot || null,
            locationContext: payrollContext.locationContext || {}
        };
    }

    static _setComponentValue(ctx, comp) {
        const code = this._deriveCode(comp);
        const nameKey = this._normalizeVariableName(comp.name || code);
        ctx.componentValues[code] = comp.monthly || 0;
        ctx.componentValues[`${code}_MONTHLY`] = comp.monthly || 0;
        ctx.componentValues[`${code}_ANNUAL`] = comp.yearly || 0;
        if (nameKey) {
            ctx.componentValues[nameKey] = comp.monthly || 0;
            ctx.componentValues[`${nameKey}_MONTHLY`] = comp.monthly || 0;
            ctx.componentValues[`${nameKey}_ANNUAL`] = comp.yearly || 0;
        }
    }

    static _evaluateFormula(expression, variables = {}) {
        const tokens = this._tokenizeFormula(expression);
        const rpn = this._toRpn(tokens);
        const stack = [];

        rpn.forEach(token => {
            if (token.type === 'number') {
                stack.push(token.value);
                return;
            }
            if (token.type === 'variable') {
                if (!Object.prototype.hasOwnProperty.call(variables, token.value)) {
                    throw new Error(`Unknown formula variable: ${token.value}`);
                }
                stack.push(this._safeNum(variables[token.value]));
                return;
            }
            if (token.value === 'u-') {
                if (stack.length < 1) throw new Error('Invalid formula');
                stack.push(-stack.pop());
                return;
            }
            if (stack.length < 2) throw new Error('Invalid formula');
            const right = stack.pop();
            const left = stack.pop();
            if (token.value === '+') stack.push(left + right);
            if (token.value === '-') stack.push(left - right);
            if (token.value === '*') stack.push(left * right);
            if (token.value === '/') {
                if (right === 0) throw new Error('Formula divides by zero');
                stack.push(left / right);
            }
        });

        if (stack.length !== 1 || !Number.isFinite(stack[0])) {
            throw new Error('Invalid formula result');
        }
        return stack[0];
    }

    static _tokenizeFormula(expression) {
        const source = String(expression || '').toUpperCase().replace(/,/g, '').replace(/RS\.?|INR|\u20B9/g, '');
        const tokens = [];
        let i = 0;
        while (i < source.length) {
            const char = source[i];
            if (/\s/.test(char)) {
                i += 1;
                continue;
            }
            if (/[0-9.]/.test(char)) {
                const match = source.slice(i).match(/^\d+(?:\.\d+)?/);
                if (!match) throw new Error('Invalid number in formula');
                let value = Number(match[0]);
                i += match[0].length;
                if (source[i] === '%') {
                    value = value / 100;
                    i += 1;
                }
                tokens.push({ type: 'number', value });
                continue;
            }
            if (/[A-Z_]/.test(char)) {
                const match = source.slice(i).match(/^[A-Z_][A-Z0-9_]*/);
                tokens.push({ type: 'variable', value: this._normalizeVariableName(match[0]) });
                i += match[0].length;
                continue;
            }
            if ('+-*/()'.includes(char)) {
                tokens.push({ type: char === '(' || char === ')' ? 'paren' : 'operator', value: char });
                i += 1;
                continue;
            }
            throw new Error(`Unsupported formula character: ${char}`);
        }
        return tokens;
    }

    static _toRpn(tokens) {
        const output = [];
        const ops = [];
        const precedence = { 'u-': 3, '*': 2, '/': 2, '+': 1, '-': 1 };
        let previous = null;

        tokens.forEach(token => {
            if (token.type === 'number' || token.type === 'variable') {
                output.push(token);
                previous = token;
                return;
            }

            if (token.value === '(') {
                ops.push(token);
                previous = token;
                return;
            }

            if (token.value === ')') {
                while (ops.length && ops[ops.length - 1].value !== '(') output.push(ops.pop());
                if (!ops.length) throw new Error('Mismatched formula parentheses');
                ops.pop();
                previous = token;
                return;
            }

            const op = token.value === '-' && (!previous || previous.type === 'operator' || previous.value === '(')
                ? { type: 'operator', value: 'u-' }
                : token;

            while (
                ops.length &&
                ops[ops.length - 1].type === 'operator' &&
                precedence[ops[ops.length - 1].value] >= precedence[op.value]
            ) {
                output.push(ops.pop());
            }
            ops.push(op);
            previous = op;
        });

        while (ops.length) {
            const op = ops.pop();
            if (op.value === '(' || op.value === ')') throw new Error('Mismatched formula parentheses');
            output.push(op);
        }

        return output;
    }

    static _hasComponent(list, codes = []) {
        const wanted = new Set(codes.map(code => String(code).toUpperCase()));
        return (list || []).some(item => wanted.has(this._deriveCode(item)));
    }

    static _isBasic(c) {
        if (!c) return false;
        const name = (c.name || '').toUpperCase();
        const code = (c.code || '').toUpperCase();
        return code === 'BASIC' || name === 'BASIC' || name === 'BASIC SALARY' || name === 'BASIC PAY';
    }

    static _isSpecial(c) {
        if (!c) return false;
        const name = (c.name || '').toUpperCase();
        const code = (c.code || '').toUpperCase();
        return code === 'SPECIAL_ALLOWANCE' || name === 'SPECIAL ALLOWANCE' || name.includes('BALANCER');
    }

    static _isRetirement(c) {
        if (!c) return false;
        const code = this._deriveCode(c);
        return code === 'GRATUITY' || code === 'LEAVE_ENCASHMENT';
    }

    static _deriveCode(c) {
        if (!c) return 'UNKNOWN';
        if (this._isBasic(c)) return 'BASIC';
        if (this._isSpecial(c)) return 'SPECIAL_ALLOWANCE';

        const raw = (c.code || c.name || '').toUpperCase().trim();
        if (raw.includes('HOUSE') && raw.includes('RENT')) return 'HOUSE_RENT_ALLOWANCE';
        if (raw === 'HRA') return 'HOUSE_RENT_ALLOWANCE';
        if (raw.includes('PROFESSIONAL TAX') || raw === 'PT') return 'PROFESSIONAL_TAX';
        if (raw.includes('PROVIDENT') || raw.includes('PF')) {
            if (raw.includes('EMPLOYER')) return 'EMPLOYER_PF';
            if (raw.includes('EMPLOYEE')) return 'EMPLOYEE_PF';
            return 'EMPLOYEE_PF';
        }
        if (raw.includes('ESI') || raw.includes('ESIC')) {
            if (raw.includes('EMPLOYER')) return 'EMPLOYER_ESI';
            if (raw.includes('EMPLOYEE')) return 'EMPLOYEE_ESI';
            return 'EMPLOYEE_ESI';
        }
        if (raw.includes('GRATUITY')) return 'GRATUITY';
        if (raw.includes('LEAVE') && raw.includes('ENCASHMENT')) return 'LEAVE_ENCASHMENT';
        if (raw.includes('LABOUR WELFARE') || raw.includes('LABOR WELFARE') || raw === 'LWF') {
            if (raw.includes('EMPLOYER')) return 'LWF_EMPLOYER';
            return 'LWF_EMPLOYEE';
        }
        if (raw.includes('LOCAL ALLOWANCE')) return 'LOCAL_ALLOWANCE';

        return this._normalizeVariableName(raw);
    }

    static _normalizeVariableName(value) {
        return String(value || '').toUpperCase().trim().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
    }

    static _safeNum(v) {
        const n = parseFloat(v);
        return Number.isFinite(n) ? this._round(n) : 0;
    }

    static _round(v) {
        const n = Number(v);
        if (!Number.isFinite(n)) return 0;
        return Math.round((n + Number.EPSILON) * 100) / 100;
    }

    static _emptyResult(ctc, payrollContext = {}) {
        return {
            annualCTC: ctc,
            payrollContext,
            earnings: [],
            deductions: [],
            benefits: [],
            employerContributions: [],
            retirementBenefits: [],
            totals: {
                grossA_Monthly: 0,
                grossA_Yearly: 0,
                grossB_Monthly: 0,
                grossB_Yearly: 0,
                totalCTC: ctc,
                deductionMonthly: 0,
                takeHomeMonthly: 0,
                takeHomeYearly: 0
            }
        };
    }
}

module.exports = SalaryCalculationEngine;
