
export interface LineCalculationResult {
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  taxAmount: number;
  lineTotal: number;
}

export interface InvoiceCalculationSummary {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
}

export class LineTotalsCalculator {
  /**
   * Calculates amounts for a single invoice line.
   */
  static calculateLine(
    quantity: number,
    unitPrice: number,
    discountPct: number = 0,
    taxRatePct: number = 0
  ): LineCalculationResult {
    const qty = Math.max(0, Number(quantity) || 0);
    const price = Math.max(0, Number(unitPrice) || 0);
    const discPct = Math.max(0, Math.min(100, Number(discountPct) || 0));
    const taxPct = Math.max(0, Number(taxRatePct) || 0);

    const grossAmount = Math.round(qty * price * 100) / 100;
    const discountAmount = Math.round(grossAmount * (discPct / 100) * 100) / 100;
    const netAmount = Math.round((grossAmount - discountAmount) * 100) / 100;
    const taxAmount = Math.round(netAmount * (taxPct / 100) * 100) / 100;
    const lineTotal = Math.round((netAmount + taxAmount) * 100) / 100;

    return {
      grossAmount,
      discountAmount,
      netAmount,
      taxAmount,
      lineTotal
    };
  }

  /**
   * Computes totals across all lines.
   */
  static calculateInvoiceTotals(
    lines: Array<{
      quantity: number;
      unitPrice: number;
      discountPct?: number;
      taxRatePct?: number;
    }>
  ): InvoiceCalculationSummary {
    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;
    let total = 0;

    for (const line of lines) {
      const res = this.calculateLine(
        line.quantity,
        line.unitPrice,
        line.discountPct,
        line.taxRatePct
      );
      subtotal += res.netAmount;
      discountTotal += res.discountAmount;
      taxTotal += res.taxAmount;
      total += res.lineTotal;
    }

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      discountTotal: Math.round(discountTotal * 100) / 100,
      taxTotal: Math.round(taxTotal * 100) / 100,
      total: Math.round(total * 100) / 100
    };
  }
}
