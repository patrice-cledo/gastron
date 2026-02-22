export const parseFraction = (str: string | number): number => {
    if (typeof str === 'number') return str;
    if (!str) return 0;

    if (str.includes(' ')) {
        // Handle "1 1/2" format
        const parts = str.split(' ');
        const whole = parseFloat(parts[0]) || 0;
        const fraction = parts[1] || '0';
        if (fraction.includes('/')) {
            const [num, den] = fraction.split('/').map(Number);
            return whole + (num / den);
        }
        return whole;
    } else if (str.includes('/')) {
        // Handle "1/2" format
        const [num, den] = str.split('/').map(Number);
        return num / den;
    } else {
        return parseFloat(str) || 0;
    }
};

export const formatFraction = (value: number | string): string => {
    const numValue = typeof value === 'string' ? parseFraction(value) : value;
    if (!numValue || isNaN(numValue) || numValue === 0) return '0';

    const whole = Math.floor(numValue);
    const fractional = numValue - whole;

    if (fractional === 0) {
        return whole.toString();
    }

    // Common fractions
    const commonFractions: Record<number, string> = {
        0.125: '1/8',
        0.25: '1/4',
        0.333: '1/3',
        0.5: '1/2',
        0.667: '2/3',
        0.75: '3/4',
    };

    // Check if fractional part matches a common fraction
    for (const [dec, frac] of Object.entries(commonFractions)) {
        if (Math.abs(fractional - parseFloat(dec)) < 0.01) {
            if (whole === 0) {
                return frac;
            }
            return `${whole} ${frac}`;
        }
    }

    // Round to 2 decimal places if not a common fraction
    const rounded = Math.round(numValue * 100) / 100;
    return rounded.toString();
};
