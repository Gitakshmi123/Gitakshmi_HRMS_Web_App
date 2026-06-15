export function formatCalculationLabel(component) {
  if (!component || !component.calculationType) return '-';

  const ct = component.calculationType;

  // Normalize common variants to backend canonical values
  if (ct === 'PERCENTAGE_OF_CTC' || ct === 'PERCENT_CTC' || ct === 'PERCENT_OF_CTC') {
    const pct = component.percentage ?? component.value ?? 0;
    // Ensure a number and avoid 'undefined%'
    const num = Number(pct) || 0;
    return `${num}% of CTC`;
  }

  if (ct === 'FLAT_AMOUNT' || ct === 'FLAT') {
    const amt = component.amount ?? component.value ?? 0;
    return amt > 0 ? `Flat Amount: ₹${Number(amt).toLocaleString('en-IN')}` : 'Flat Amount';
  }

  if (ct === 'PERCENTAGE_OF_BASIC' || ct === 'PERCENT_OF_BASIC') {
    const pct = component.percentage ?? component.value ?? 0;
    const num = Number(pct) || 0;
    return `${num}% of Basic`;
  }

  return '-';
}
