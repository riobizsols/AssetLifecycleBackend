/**
 * Depreciation Service
 * Handles all depreciation calculation logic
 */

class DepreciationService {
    /**
     * Calculate Straight Line Depreciation
     * Formula: (Cost of Asset - Salvage Value) / Useful Life of Asset
     * @param {number} originalCost - Original purchase cost
     * @param {number} salvageValue - Salvage/residual value
     * @param {number} usefulLifeYears - Useful life in years
     * @param {number} monthsElapsed - Months elapsed since purchase (optional)
     * @returns {Object} Depreciation calculation results
     */
    static calculateStraightLineDepreciation(originalCost, salvageValue, usefulLifeYears, monthsElapsed = 0) {
        try {
            // Validate inputs
            if (originalCost <= 0) {
                throw new Error('Original cost must be greater than 0');
            }
            if (salvageValue < 0) {
                throw new Error('Salvage value cannot be negative');
            }
            if (usefulLifeYears <= 0) {
                throw new Error('Useful life must be greater than 0');
            }
            if (monthsElapsed < 0) {
                throw new Error('Months elapsed cannot be negative');
            }

            // Calculate annual depreciation
            const annualDepreciation = (originalCost - salvageValue) / usefulLifeYears;

            // Calculate depreciation rate as percentage
            const depreciationRate = (annualDepreciation / originalCost) * 100;

            // Calculate monthly depreciation
            const monthlyDepreciation = annualDepreciation / 12;

            // Calculate depreciation for the specified period
            let periodDepreciation = 0;
            if (monthsElapsed > 0) {
                periodDepreciation = monthlyDepreciation * monthsElapsed;
            } else {
                periodDepreciation = annualDepreciation;
            }

            // Calculate current book value
            const currentBookValue = originalCost - periodDepreciation;

            // Ensure book value doesn't go below salvage value
            const finalBookValue = Math.max(currentBookValue, salvageValue);

            // Adjust period depreciation if book value would go below salvage value
            const adjustedPeriodDepreciation = originalCost - finalBookValue;

            return {
                annualDepreciation: parseFloat(annualDepreciation.toFixed(2)),
                monthlyDepreciation: parseFloat(monthlyDepreciation.toFixed(2)),
                periodDepreciation: parseFloat(adjustedPeriodDepreciation.toFixed(2)),
                depreciationRate: parseFloat(depreciationRate.toFixed(2)),
                currentBookValue: parseFloat(finalBookValue.toFixed(2)),
                accumulatedDepreciation: parseFloat((originalCost - finalBookValue).toFixed(2)),
                remainingUsefulLife: Math.max(0, usefulLifeYears - (monthsElapsed / 12))
            };
        } catch (error) {
            throw new Error(`Straight Line Depreciation calculation failed: ${error.message}`);
        }
    }

    /**
     * Calculate depreciation for a specific date range
     * @param {Date} purchaseDate - Date when asset was purchased
     * @param {Date} calculationDate - Date for depreciation calculation
     * @param {number} originalCost - Original purchase cost
     * @param {number} salvageValue - Salvage value
     * @param {number} usefulLifeYears - Useful life in years
     * @returns {Object} Depreciation calculation results
     */
    static calculateDepreciationForDateRange(purchaseDate, calculationDate, originalCost, salvageValue, usefulLifeYears) {
        try {
            const monthsElapsed = this.calculateMonthsBetween(purchaseDate, calculationDate);
            return this.calculateStraightLineDepreciation(originalCost, salvageValue, usefulLifeYears, monthsElapsed);
        } catch (error) {
            throw new Error(`Date range depreciation calculation failed: ${error.message}`);
        }
    }

    /**
     * Calculate months between two dates
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {number} Number of months between dates
     */
    static calculateMonthsBetween(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        const yearDiff = end.getFullYear() - start.getFullYear();
        const monthDiff = end.getMonth() - start.getMonth();
        
        return (yearDiff * 12) + monthDiff;
    }

    /**
     * Calculate Reducing Balance Depreciation
     * @param {number} currentBookValue - Current book value
     * @param {number} originalCost - Original cost of the asset
     * @param {number} salvageValue - Salvage/residual value
     * @param {number} usefulLifeYears - Useful life in years
     * @param {number} depreciationRate - Optional explicit depreciation rate as decimal (e.g., 0.25 for 25%)
     * @returns {Object} Depreciation calculation results
     */
    static calculateReducingBalanceDepreciation(currentBookValue, originalCost, salvageValue = 0, usefulLifeYears, depreciationRate = null) {
        try {
            if (currentBookValue <= 0) {
                throw new Error('Current book value must be greater than 0');
            }
            if (originalCost <= 0) {
                throw new Error('Original cost must be greater than 0');
            }
            if (salvageValue < 0) {
                throw new Error('Salvage value cannot be negative');
            }
            if (salvageValue >= originalCost) {
                throw new Error('Salvage value must be less than original cost');
            }
            if (usefulLifeYears <= 0) {
                throw new Error('Useful life must be greater than 0');
            }

            // Calculate depreciation rate if not provided
            let calculatedRate;
            if (depreciationRate !== null) {
                if (depreciationRate <= 0 || depreciationRate >= 1) {
                    throw new Error('Depreciation rate must be between 0 and 1');
                }
                calculatedRate = depreciationRate;
            } else {
                // Calculate rate using the formula: r = 1 - (salvage_value / original_cost)^(1/useful_life)
                // This ensures the asset reaches salvage value at the end of its useful life
                if (salvageValue === 0) {
                    // If salvage value is 0, use a standard reducing balance rate
                    calculatedRate = 2 / usefulLifeYears; // Double declining balance rate
                } else {
                    calculatedRate = 1 - Math.pow(salvageValue / originalCost, 1 / usefulLifeYears);
                }
            }

            // Calculate depreciation amount
            const rawDepreciationAmount = currentBookValue * calculatedRate;
            
            // Ensure book value doesn't go below salvage value
            const tentativeNewBookValue = currentBookValue - rawDepreciationAmount;
            const newBookValue = Math.max(tentativeNewBookValue, salvageValue);
            const actualDepreciationAmount = currentBookValue - newBookValue;

            return {
                depreciationAmount: parseFloat(actualDepreciationAmount.toFixed(2)),
                newBookValue: parseFloat(newBookValue.toFixed(2)),
                depreciationRate: parseFloat((calculatedRate * 100).toFixed(4)),
                calculatedRate: parseFloat(calculatedRate.toFixed(6))
            };
        } catch (error) {
            throw new Error(`Reducing Balance Depreciation calculation failed: ${error.message}`);
        }
    }

    /**
     * Calculate Double Declining Depreciation
     * @param {number} currentBookValue - Current book value
     * @param {number} usefulLifeYears - Useful life in years
     * @param {number} salvageValue - Salvage value
     * @returns {Object} Depreciation calculation results
     */
    static calculateDoubleDecliningDepreciation(currentBookValue, usefulLifeYears, salvageValue) {
        try {
            if (currentBookValue <= 0) {
                throw new Error('Current book value must be greater than 0');
            }
            if (usefulLifeYears <= 0) {
                throw new Error('Useful life must be greater than 0');
            }
            if (salvageValue < 0) {
                throw new Error('Salvage value cannot be negative');
            }

            // Double declining rate = 2 × (100% / useful life)
            const doubleDecliningRate = (2 / usefulLifeYears);
            
            // Calculate depreciation amount
            const depreciationAmount = currentBookValue * doubleDecliningRate;
            
            // Ensure book value doesn't go below salvage value
            const newBookValue = Math.max(currentBookValue - depreciationAmount, salvageValue);
            
            // Adjust depreciation amount if needed
            const adjustedDepreciationAmount = currentBookValue - newBookValue;

            return {
                depreciationAmount: parseFloat(adjustedDepreciationAmount.toFixed(2)),
                newBookValue: parseFloat(newBookValue.toFixed(2)),
                depreciationRate: parseFloat((doubleDecliningRate * 100).toFixed(2))
            };
        } catch (error) {
            throw new Error(`Double Declining Depreciation calculation failed: ${error.message}`);
        }
    }

    /**
     * Generate depreciation schedule for an asset
     * @param {number} originalCost - Original purchase cost
     * @param {number} salvageValue - Salvage value
     * @param {number} usefulLifeYears - Useful life in years
     * @param {Date} purchaseDate - Purchase date
     * @returns {Array} Array of yearly depreciation records
     */
    static generateDepreciationSchedule(originalCost, salvageValue, usefulLifeYears, purchaseDate) {
        try {
            const schedule = [];
            let currentBookValue = originalCost;
            const annualDepreciation = (originalCost - salvageValue) / usefulLifeYears;

            for (let year = 1; year <= usefulLifeYears; year++) {
                const yearStartValue = currentBookValue;
                const depreciationAmount = Math.min(annualDepreciation, currentBookValue - salvageValue);
                currentBookValue = Math.max(currentBookValue - depreciationAmount, salvageValue);

                schedule.push({
                    year: year,
                    yearStartValue: parseFloat(yearStartValue.toFixed(2)),
                    depreciationAmount: parseFloat(depreciationAmount.toFixed(2)),
                    yearEndValue: parseFloat(currentBookValue.toFixed(2)),
                    accumulatedDepreciation: parseFloat((originalCost - currentBookValue).toFixed(2))
                });

                if (currentBookValue <= salvageValue) {
                    break;
                }
            }

            return schedule;
        } catch (error) {
            throw new Error(`Depreciation schedule generation failed: ${error.message}`);
        }
    }

    /**
     * Validate depreciation parameters
     * @param {Object} params - Depreciation parameters
     * @returns {Object} Validation result
     */
    static validateDepreciationParams(params) {
        const errors = [];
        const { originalCost, salvageValue, usefulLifeYears, depreciationMethod } = params;

        if (!originalCost || originalCost <= 0) {
            errors.push('Original cost must be greater than 0');
        }

        if (salvageValue < 0) {
            errors.push('Salvage value cannot be negative');
        }

        if (salvageValue >= originalCost) {
            errors.push('Salvage value must be less than original cost');
        }

        if (!usefulLifeYears || usefulLifeYears <= 0) {
            errors.push('Useful life must be greater than 0');
        }

        if (!['ND', 'SL', 'RB', 'DD'].includes(depreciationMethod)) {
            errors.push('Invalid depreciation method');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
}

module.exports = DepreciationService;
