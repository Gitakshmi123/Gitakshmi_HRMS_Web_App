class SalaryCalculationEngine {
    static calculateSalary({ annualCTC = 0, earnings = [], deductions = [], benefits = [], payrollContext = {}, employeeCategory = 'GENERAL', minWageAmount = 0, useExcelStructure = true }) {
        const ctc = this._safeNum(annualCTC);
        if (ctc <= 0) return this._emptyResult(ctc, payrollContext);

        const ctxRules = this._normalizePayrollContext(payrollContext);
        const monthlyCTC = this._round(ctc / 12);
        const effectiveMinWage = this._safeNum(minWageAmount);

        const shouldRunExcelSolver = (useExcelStructure && (earnings.length === 0 || payrollContext.useExcelStructure === true));
        if (shouldRunExcelSolver) {
            return this._calculateExcelStructure(ctc, effectiveMinWage, ctxRules, employeeCategory);
        }

        // 1. Minimum Wage logic
        
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
            
            // List of states that levy Professional Tax
            const ptStates = ['andhra pradesh', 'assam', 'bihar', 'gujarat', 'jharkhand', 'karnataka', 'kerala', 'madhya pradesh', 'maharashtra', 'manipur', 'meghalaya', 'mizoram', 'nagaland', 'odisha', 'puducherry', 'sikkim', 'tamil nadu', 'telangana', 'tripura', 'west bengal'];
            const currentState = String(ctx.payrollContext?.locationContext?.workState || '').toLowerCase();
            const isPtState = !currentState || ptStates.includes(currentState);

            if (ptPolicy.enabled === false || !isPtState) return 0;
            
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

    static _calculateForCtcA(ctcA, minWage, rates) {
        const round0 = (v) => Math.round(v);
        
        // Step 3: Basic = MAX(Minimum Wage, AnnualCTC * 50%)
        // Note: ctcA mathematically acts as AnnualCTC in the formula context
        const basic = round0(Math.max(minWage, ctcA * rates.basicPct));
        
        // Step 4: Bonus = IF(Basic > 21000, 0, Basic * 8.33%)
        const bonus = basic > rates.bonusCeiling ? 0 : round0(basic * rates.bonusPct);
        
        // Step 5: PF Employer = IF(Basic >= 15000, 1800, Basic * 12%)
        const pfBase = rates.pfCapContribution === false ? basic : Math.min(basic, rates.pfWageCeiling);
        const pfEmployer = pfBase >= 1 ? round0(pfBase * rates.pfEmployerPct) : 0;
        
        // Step 6: ESIC Employer = IF(Basic >= 21001, 0, Basic * 3.25%)
        const esicEmployer = basic > rates.esicWageCeiling ? 0 : round0(basic * rates.esicEmployerPct);
        
        // Step 7: HRA = MIN(ROUND(Basic*50%,0), MAX(0, ctcA - (Basic + Bonus + pfEmployer + esicEmployer)))
        const maxHraLimit = Math.max(0, round0(ctcA - (basic + bonus + pfEmployer + esicEmployer)));
        const hra = Math.min(round0(basic * rates.hraPct), maxHraLimit);
        
        // Step 8: Conveyance = MIN(ROUND(Basic*15%,0), MAX(0, ctcA - (Basic + Bonus + HRA + pfEmployer + esicEmployer)))
        const maxConvLimit = Math.max(0, round0(ctcA - (basic + bonus + hra + pfEmployer + esicEmployer)));
        const conveyance = Math.min(round0(basic * rates.conveyancePct), maxConvLimit);
        
        // Step 9: Compensatory = MAX(0, ctcA - (Basic + Bonus + HRA + Conveyance + pfEmployer + esicEmployer))
        const compensatory = Math.max(0, round0(ctcA - (basic + bonus + hra + conveyance + pfEmployer + esicEmployer)));
        
        // Step 10: Gross Salary
        const gross = basic + hra + conveyance + compensatory + bonus;
        
        // Step 11: CTC(A) = Gross + Employer PF + Employer ESIC
        const actualCtcA = gross + pfEmployer + esicEmployer;
        
        // Step 16: Gratuity = Basic * 4.81%
        const gratuity = round0(basic * rates.gratuityPct);
        
        // Step 17: PA Policy (If ctcA >= 20833.33 Coverage = 500000 Else Coverage = ctcA * 24)
        const val1 = actualCtcA >= rates.paPolicyCeiling ? rates.paPolicyFixedCap : actualCtcA * 24;
        const term1 = round0(val1 * rates.paPolicyRate1);
        const val2 = (actualCtcA * 36) + (actualCtcA >= rates.paPolicyCeiling ? (actualCtcA * 24 - rates.paPolicyFixedCap) : 0);
        const term2 = round0(val2 * rates.paPolicyRate2);
        const yearlyPremium = term1 + term2;
        const premium = round0(yearlyPremium / 12);
        
        // Step 20: Total CTC = CTC(A) + RetirementBenefits(B) + InsuranceBenefits(C)
        const totalCTC = actualCtcA + gratuity + premium;
        
        return {
            ctcA: actualCtcA,
            basic,
            hra,
            conveyance,
            compensatory,
            bonus,
            pfEmployer,
            esicEmployer,
            gratuity,
            premium,
            totalCTC,
            gross
        };
    }

    static _calculateExcelStructure(ctc, minWage, ctxRules, employeeCategory) {
        const targetMonthlyCTC = this._round(ctc / 12);
        
        const rules = ctxRules.companyRules || {};
        const policy = ctxRules.locationPolicy || {};
        
        const safeRate = (val, fallback) => {
            const num = parseFloat(val);
            return Number.isFinite(num) && num > 0 ? num / 100 : fallback;
        };

        const rates = {
            basicPct: safeRate(policy.basicPercentage, 0.50),
            bonusPct: safeRate(policy.bonusPercentage, 0.0833),
            bonusCeiling: parseFloat(policy.bonusCeiling) || 21000,
            pfEmployerPct: safeRate(rules.pf?.employerContributionPercentage, 0.12),
            pfEmployeePct: safeRate(rules.pf?.employeeContributionPercentage, 0.12),
            pfWageCeiling: parseFloat(rules.pf?.wageCeiling) || 15000,
            pfCapContribution: rules.pf?.capContribution !== false,
            esicEmployerPct: safeRate(rules.esic?.employerContributionPercentage, 0.0325),
            esicEmployeePct: safeRate(rules.esic?.employeeContributionPercentage, 0.0075),
            esicWageCeiling: parseFloat(rules.esic?.wageCeiling) || 21000,
            hraPct: safeRate(policy.hra?.percentageOfBasic, 0.50),
            conveyancePct: safeRate(policy.conveyancePercentage, 0.15),
            gratuityPct: safeRate(rules.gratuity?.percentage, 0.0481),
            paPolicyCeiling: 20833.33,
            paPolicyFixedCap: 500000,
            paPolicyRate1: 1.5 / 1000,
            paPolicyRate2: 0.45 / 1000
        };
        
        // Solve for target ctcA
        let low = 0;
        let high = targetMonthlyCTC;
        let bestCTC_A = targetMonthlyCTC;
        let bestDiff = Infinity;
        
        for (let i = 0; i < 30; i++) {
            let mid = (low + high) / 2;
            let calc = this._calculateForCtcA(mid, minWage, rates);
            let diff = calc.totalCTC - targetMonthlyCTC;
            
            if (Math.abs(diff) < Math.abs(bestDiff)) {
                bestDiff = diff;
                bestCTC_A = mid;
            }
            
            if (calc.totalCTC > targetMonthlyCTC) {
                high = mid;
            } else {
                low = mid;
            }
        }
        
        const breakup = this._calculateForCtcA(bestCTC_A, minWage, rates);
        
        // Professional Tax (Step 14)
        let pt = 0;
        const ptPolicy = ctxRules.locationPolicy?.professionalTax || {};
        
        // List of states that levy Professional Tax
        const ptStates = ['andhra pradesh', 'assam', 'bihar', 'gujarat', 'jharkhand', 'karnataka', 'kerala', 'madhya pradesh', 'maharashtra', 'manipur', 'meghalaya', 'mizoram', 'nagaland', 'odisha', 'puducherry', 'sikkim', 'tamil nadu', 'telangana', 'tripura', 'west bengal'];
        const currentState = String(ctxRules.locationContext?.workState || '').toLowerCase();
        const isPtState = !currentState || ptStates.includes(currentState);

        if (ptPolicy.enabled !== false && isPtState) {
            if (Array.isArray(ptPolicy.slabs) && ptPolicy.slabs.length > 0) {
                const match = ptPolicy.slabs.find(slab => {
                    const min = this._safeNum(slab.minIncome);
                    const max = slab.maxIncome === null || slab.maxIncome === undefined ? Infinity : this._safeNum(slab.maxIncome);
                    return breakup.gross >= min && breakup.gross <= max;
                });
                if (match) pt = this._round(match.amount);
            } else {
                // Fallback to Excel slab formula
                if (breakup.gross <= 9000) pt = 0;
                else if (breakup.gross <= 12000) pt = 150;
                else pt = 200;
            }
        }
        
        // Employee PF and Employee ESI (Steps 12 & 13)
        const pfEmployeeBase = rates.pfCapContribution === false ? breakup.basic : Math.min(breakup.basic, rates.pfWageCeiling);
        const pfEmployee = pfEmployeeBase >= 1 ? Math.round(pfEmployeeBase * rates.pfEmployeePct) : 0;
        const esicEmployee = breakup.basic > rates.esicWageCeiling ? 0 : Math.round(breakup.basic * rates.esicEmployeePct);
        
        // Construct the results array
        const earningsResult = [
            {
                code: 'BASIC',
                name: 'Basic Salary',
                calculationType: 'FIXED',
                value: breakup.basic,
                basedOn: 'MW_OR_50PCT',
                monthly: breakup.basic,
                yearly: this._round(breakup.basic * 12)
            },
            {
                code: 'HOUSE_RENT_ALLOWANCE',
                name: 'House Rent Allowance',
                calculationType: 'FIXED',
                value: breakup.hra,
                basedOn: 'BASIC',
                monthly: breakup.hra,
                yearly: this._round(breakup.hra * 12)
            },
            {
                code: 'CONVEYANCE',
                name: 'Conveyance Allowance',
                calculationType: 'FIXED',
                value: breakup.conveyance,
                basedOn: 'BASIC',
                monthly: breakup.conveyance,
                yearly: this._round(breakup.conveyance * 12)
            },
            {
                code: 'COMPENSATORY_ALLOWANCE',
                name: 'Compensatory Allowance',
                calculationType: 'FIXED',
                value: breakup.compensatory,
                basedOn: 'NA',
                monthly: breakup.compensatory,
                yearly: this._round(breakup.compensatory * 12)
            }
        ];
        
        if (breakup.bonus > 0) {
            earningsResult.push({
                code: 'BONUS',
                name: 'Bonus',
                calculationType: 'FIXED',
                value: breakup.bonus,
                basedOn: 'NA',
                monthly: breakup.bonus,
                yearly: this._round(breakup.bonus * 12)
            });
        }
        
        const employerContributions = [];
        if (breakup.pfEmployer > 0) {
            employerContributions.push({
                code: 'EMPLOYER_PF',
                name: 'Employer PF',
                calculationType: 'STATUTORY',
                value: breakup.pfEmployer,
                basedOn: 'BASIC',
                monthly: breakup.pfEmployer,
                yearly: this._round(breakup.pfEmployer * 12)
            });
        }
        if (breakup.esicEmployer > 0) {
            employerContributions.push({
                code: 'EMPLOYER_ESI',
                name: 'Employer ESI',
                calculationType: 'STATUTORY',
                value: breakup.esicEmployer,
                basedOn: 'GROSS',
                monthly: breakup.esicEmployer,
                yearly: this._round(breakup.esicEmployer * 12)
            });
        }
        
        const retirementBenefits = [
            {
                code: 'GRATUITY',
                name: 'Gratuity',
                calculationType: 'STATUTORY',
                value: breakup.gratuity,
                basedOn: 'BASIC',
                monthly: breakup.gratuity,
                yearly: this._round(breakup.gratuity * 12)
            }
        ];
        
        const otherBenefits = [
            {
                code: 'PA_POLICY_PREMIUM',
                name: 'P.A. Policy Premium',
                calculationType: 'FIXED',
                value: breakup.premium,
                basedOn: 'NA',
                monthly: breakup.premium,
                yearly: this._round(breakup.premium * 12)
            }
        ];
        
        const deductionsResult = [];
        if (pfEmployee > 0) {
            deductionsResult.push({
                code: 'EMPLOYEE_PF',
                name: 'Employee PF',
                calculationType: 'STATUTORY',
                value: pfEmployee,
                basedOn: 'BASIC',
                monthly: pfEmployee,
                yearly: this._round(pfEmployee * 12)
            });
        }
        if (esicEmployee > 0) {
            deductionsResult.push({
                code: 'EMPLOYEE_ESI',
                name: 'Employee ESI',
                calculationType: 'STATUTORY',
                value: esicEmployee,
                basedOn: 'GROSS',
                monthly: esicEmployee,
                yearly: this._round(esicEmployee * 12)
            });
        }
        if (pt > 0) {
            deductionsResult.push({
                code: 'PROFESSIONAL_TAX',
                name: 'Professional Tax',
                calculationType: 'STATUTORY',
                value: pt,
                basedOn: 'NA',
                monthly: pt,
                yearly: this._round(pt * 12)
            });
        }
        
        const totalDeductionsAnnual = this._round(deductionsResult.reduce((s, d) => s + d.yearly, 0));
        const totalEarningsAnnual = this._round(earningsResult.reduce((s, e) => s + e.yearly, 0));
        
        const result = {
            annualCTC: ctc,
            payrollContext: ctxRules,
            earnings: earningsResult,
            deductions: deductionsResult,
            benefits: [...employerContributions, ...retirementBenefits, ...otherBenefits],
            employerContributions,
            retirementBenefits,
            otherBenefits,
            minWageAmount: minWage,
            totals: {
                grossA_Monthly: breakup.ctcA,
                grossA_Yearly: this._round(breakup.ctcA * 12),
                grossB_Monthly: breakup.gratuity,
                grossB_Yearly: this._round(breakup.gratuity * 12),
                grossC_Monthly: breakup.premium,
                grossC_Yearly: this._round(breakup.premium * 12),
                totalCTC: ctc,
                deductionMonthly: this._round(totalDeductionsAnnual / 12),
                takeHomeMonthly: this._round((totalEarningsAnnual - totalDeductionsAnnual) / 12),
                takeHomeYearly: this._round(totalEarningsAnnual - totalDeductionsAnnual)
            }
        };
        
        return result;
    }
}

module.exports = SalaryCalculationEngine;
