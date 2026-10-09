/* TaxShift linked, sequential teaching game. Annual flows in USD millions.
   Pure functions: no DOM dependency. CommonJS export supports node --test. */
(function (root) {
  'use strict';
  const MONEY = 1e-9;
  const DEFAULTS = Object.freeze({
    turnover: 300, purchases: 50, wages: 100, equipment: 200,
    depreciationRate: 0.10, externalInterest: 40,
    originalDebt: 400, equity: 100, baseInterestRate: 0.10,
    adminCostPerPoint: 1, capacity: 4
  });
  const number = (x, label, min, max) => {
    if (typeof x !== 'number' || !Number.isFinite(x) || x < min || x > max)
      throw new RangeError(label + ' must be finite and in [' + min + ', ' + max + ']');
    return x;
  };
  function calculateRound(firm, minister, assumptions = DEFAULTS) {
    if (!firm || !minister) throw new TypeError('Both players must commit decisions');
    const a = { ...DEFAULTS, ...assumptions };
    const citRate = number(minister.citRate, 'CIT', 0, 100) / 100;
    const royaltyRate = number(minister.royaltyRate, 'Royalty', 0, 100) / 100;
    const interestRate = number(firm.interestRate, 'Interest rate', 0, 100) / 100;
    const invoice = firm.transferPricing
      ? number(firm.equipmentInvoice, 'Equipment invoice', 200, 600) : a.equipment;
    const debt = firm.thinCapitalisation
      ? number(firm.debtLevel, 'Debt', 100, 900) : a.originalDebt;
    const exportDiscount = firm.exportMispricing
      ? number(firm.exportDiscount, 'Export discount', 0, 70) / 100 : 0;
    const declaredSales = a.turnover * (1 - exportDiscount);
    const shiftedSales = a.turnover - declaredSales;
    const declaredDepreciation = invoice * a.depreciationRate;
    const actualInterest = debt * interestRate;
    const baselineExternalInterest = a.originalDebt * interestRate;
    const extraRelatedInterest = Math.max(0, actualInterest - baselineExternalInterest);

    const useALP = Boolean(minister.armLength);
    const useThinCap = Boolean(minister.thinCap);
    const useESR = Boolean(minister.earningsStripping);
    const useWHT = Boolean(minister.withholding);
    const useExportAudit = Boolean(minister.exportAudit);
    const policyPoints = Number(useALP) + Number(useThinCap) +
      Number(useESR) + Number(useWHT) + 2 * Number(useExportAudit);
    const capacity = number(a.capacity, 'Administrative capacity', 0, 100);
    if (policyPoints > capacity)
      throw new RangeError('Administrative capacity exceeded: ' + policyPoints + '/' + capacity);

    // Accounting cash flows and taxable deductions are distinct.
    const correctedSales = declaredSales + (useExportAudit ? shiftedSales : 0);
    const allowableInvoice = useALP
      ? Math.min(invoice, a.equipment * (1 + number(minister.alpMarkup, 'ALP markup', 0, 30) / 100))
      : invoice;
    const allowableDepreciation = allowableInvoice * a.depreciationRate;
    let deductibleInterest = actualInterest;
    if (useThinCap)
      deductibleInterest = Math.min(deductibleInterest,
        a.equity * number(minister.thinCapRatio, 'Thin-cap ratio', 0, 20) * interestRate);
    const adjustedEbitda = Math.max(0, correctedSales - a.purchases - a.wages);
    if (useESR)
      deductibleInterest = Math.min(deductibleInterest,
        adjustedEbitda * number(minister.esrRate, 'ESR limit', 0, 100) / 100);
    const royaltyBase = correctedSales;
    const royalty = royaltyBase * royaltyRate;
    const declaredRoyalty = declaredSales * royaltyRate;
    const declaredPretax = declaredSales - a.purchases - a.wages -
      declaredDepreciation - actualInterest - declaredRoyalty;
    const taxableProfit = correctedSales - a.purchases - a.wages -
      allowableDepreciation - deductibleInterest - royalty;
    const cit = Math.max(0, taxableProfit) * citRate;
    const withholdingRate = useWHT
      ? number(minister.withholdingRate, 'Withholding rate', 0, 100) / 100 : 0;
    // WHT only applies to the modeled EXTRA related-party interest;
    // it does not apply to equipment values or offshore commercial margins.
    const wht = extraRelatedInterest * withholdingRate;
    const adminCost = policyPoints * a.adminCostPerPoint;
    const stateGross = cit + royalty + wht;
    const stateNet = stateGross - adminCost;

    // Real cash profitability is based on booked revenues, not tax adjustments.
    // Offshore sales margin and EXTRA related-party interest are added once.
    const localNet = declaredSales - a.purchases - a.wages -
      declaredDepreciation - actualInterest - royalty - cit;
    const offshoreAnnualIncome = shiftedSales + extraRelatedInterest - wht;
    const shareholderAnnualIncome = localNet + offshoreAnnualIncome;
    return {
      declaredSales, correctedSales, shiftedSales, declaredDepreciation,
      allowableDepreciation, actualInterest, deductibleInterest,
      declaredPretax, taxableProfit, cit, royalty, wht,
      stateGross, adminCost, stateNet, localNet, offshoreAnnualIncome,
      shareholderAnnualIncome, policyPoints, capacity,
      auditAdjustment: correctedSales - declaredSales,
      disallowedInterest: actualInterest - deductibleInterest,
      disallowedDepreciation: declaredDepreciation - allowableDepreciation,
      // The equipment invoice is a capital stock; its entire value is never
      // treated as an annual offshore income flow.
      caveat: 'Illustrative single-period accounting. No investment response, losses carried forward, or enforcement uncertainty.'
    };
  }
  root.TaxShiftLinked = { calculateRound, DEFAULTS };
  if (typeof module !== 'undefined' && module.exports)
    module.exports = { calculateRound, DEFAULTS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
