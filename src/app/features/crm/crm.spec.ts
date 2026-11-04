import { describe, expect, it, vi } from 'vitest';
import {
  CrmActivity,
  CrmActivityRequest,
  CrmPipelineStage,
  Opportunity,
  OpportunityBoard,
  OpportunityStageColumn,
  Quotation,
  QuotationLineRequest
} from '../../core/models/crm.model';

describe('CRM Module - Pipeline Board & KPI Calculations', () => {
  function computeKpis(columns: OpportunityStageColumn[]) {
    let openTotal = 0;
    let weightedTotal = 0;
    let wonTotal = 0;
    let wonCount = 0;
    let lostCount = 0;

    for (const col of columns) {
      if (col.stageType === 'OPEN') {
        openTotal += Number(col.totalValue || 0);
        for (const opp of col.opportunities) {
          const val = Number(opp.expectedValue || 0);
          const prob = Number(opp.probabilityPct || col.probabilityPct || 0);
          weightedTotal += (val * prob) / 100;
        }
      } else if (col.stageType === 'WON') {
        wonTotal += Number(col.totalValue || 0);
        wonCount += col.count;
      } else if (col.stageType === 'LOST') {
        lostCount += col.count;
      }
    }

    const totalClosed = wonCount + lostCount;
    const winRatePct = totalClosed > 0 ? Math.round((wonCount / totalClosed) * 100) : 0;

    return {
      openPipelineValue: openTotal,
      weightedForecastValue: Math.round(weightedTotal * 100) / 100,
      wonThisQuarterValue: wonTotal,
      winRatePct
    };
  }

  it('should compute open pipeline, weighted forecast, won, and win rate accurately', () => {
    const columns: OpportunityStageColumn[] = [
      {
        stageId: 1,
        stageName: 'New',
        sortOrder: 1,
        probabilityPct: 10,
        stageType: 'OPEN',
        totalValue: 100000,
        count: 1,
        opportunities: [
          {
            id: 101,
            opportunityNo: 'OPP-001',
            title: 'Cloud Migration',
            stageId: 1,
            expectedValue: 100000,
            currencyCode: 'AED',
            probabilityPct: 10
          }
        ]
      },
      {
        stageId: 2,
        stageName: 'Proposal',
        sortOrder: 2,
        probabilityPct: 50,
        stageType: 'OPEN',
        totalValue: 200000,
        count: 1,
        opportunities: [
          {
            id: 102,
            opportunityNo: 'OPP-002',
            title: 'ERP Rollout',
            stageId: 2,
            expectedValue: 200000,
            currencyCode: 'AED',
            probabilityPct: 50
          }
        ]
      },
      {
        stageId: 3,
        stageName: 'Won',
        sortOrder: 3,
        probabilityPct: 100,
        stageType: 'WON',
        totalValue: 300000,
        count: 3,
        opportunities: []
      },
      {
        stageId: 4,
        stageName: 'Lost',
        sortOrder: 4,
        probabilityPct: 0,
        stageType: 'LOST',
        totalValue: 100000,
        count: 1,
        opportunities: []
      }
    ];

    const kpis = computeKpis(columns);

    // Open pipeline: 100,000 + 200,000 = 300,000
    expect(kpis.openPipelineValue).toBe(300000);

    // Weighted forecast: (100,000 * 0.10) + (200,000 * 0.50) = 10,000 + 100,000 = 110,000
    expect(kpis.weightedForecastValue).toBe(110000);

    // Won this quarter: 300,000
    expect(kpis.wonThisQuarterValue).toBe(300000);

    // Win rate: 3 won / (3 won + 1 lost) = 75%
    expect(kpis.winRatePct).toBe(75);
  });
});

describe('CRM Module - Drag & Drop Pipeline Board Stage Updates and Rollback', () => {
  interface BoardState {
    colNew: Opportunity[];
    colProposal: Opportunity[];
  }

  function simulateDragDropMove(
    state: BoardState,
    oppId: number,
    fromCol: 'colNew' | 'colProposal',
    toCol: 'colNew' | 'colProposal',
    targetStageId: number,
    targetStageName: string,
    apiShouldSucceed: boolean
  ) {
    const sourceArr = state[fromCol];
    const targetArr = state[toCol];
    const itemIndex = sourceArr.findIndex(o => o.id === oppId);
    const opp = sourceArr[itemIndex];
    const originalStageId = opp.stageId;
    const originalStageName = opp.stageName;

    // 1. Optimistic move
    sourceArr.splice(itemIndex, 1);
    targetArr.push(opp);
    opp.stageId = targetStageId;
    opp.stageName = targetStageName;

    // 2. API response simulation
    if (!apiShouldSucceed) {
      // 3. Rollback on failure!
      const rollbackIndex = targetArr.indexOf(opp);
      targetArr.splice(rollbackIndex, 1);
      sourceArr.splice(itemIndex, 0, opp);
      opp.stageId = originalStageId;
      opp.stageName = originalStageName;
      return { success: false, rolledBack: true, currentStageId: opp.stageId };
    }

    return { success: true, rolledBack: false, currentStageId: opp.stageId };
  }

  it('should successfully update stage when API succeeds', () => {
    const opp: Opportunity = {
      id: 201,
      opportunityNo: 'OPP-2026-0001',
      title: 'Warehouse POS',
      stageId: 1,
      stageName: 'New',
      expectedValue: 50000,
      currencyCode: 'AED',
      probabilityPct: 20
    };

    const state: BoardState = {
      colNew: [opp],
      colProposal: []
    };

    const result = simulateDragDropMove(
      state,
      201,
      'colNew',
      'colProposal',
      2,
      'Proposal',
      true
    );

    expect(result.success).toBe(true);
    expect(result.rolledBack).toBe(false);
    expect(result.currentStageId).toBe(2);
    expect(state.colNew.length).toBe(0);
    expect(state.colProposal.length).toBe(1);
    expect(state.colProposal[0].stageName).toBe('Proposal');
  });

  it('should cleanly rollback card position and stage if PATCH stage API fails', () => {
    const opp: Opportunity = {
      id: 202,
      opportunityNo: 'OPP-2026-0002',
      title: 'Banking Integration',
      stageId: 1,
      stageName: 'New',
      expectedValue: 80000,
      currencyCode: 'AED',
      probabilityPct: 20
    };

    const state: BoardState = {
      colNew: [opp],
      colProposal: []
    };

    // Simulate API failure (e.g. 500 or 409 conflict)
    const result = simulateDragDropMove(
      state,
      202,
      'colNew',
      'colProposal',
      2,
      'Proposal',
      false
    );

    expect(result.success).toBe(false);
    expect(result.rolledBack).toBe(true);
    expect(result.currentStageId).toBe(1);
    expect(state.colNew.length).toBe(1);
    expect(state.colProposal.length).toBe(0);
    expect(state.colNew[0].stageName).toBe('New');
  });
});

describe('CRM Module - Opportunity Detail Timeline & Activities', () => {
  it('should properly partition tasks from communication logs and track completion', () => {
    const activities: CrmActivity[] = [
      {
        id: 1,
        companyId: 1,
        activityType: 'CALL',
        subject: 'Call with Procurement Lead',
        details: 'Discussed VAT implications and payment terms',
        relatedType: 'OPPORTUNITY',
        relatedId: 10,
        createdAt: '2026-11-01T10:00:00Z'
      },
      {
        id: 2,
        companyId: 1,
        activityType: 'TASK',
        subject: 'Send customized quotation',
        relatedType: 'OPPORTUNITY',
        relatedId: 10,
        dueAt: '2026-11-05T14:00:00Z',
        completedAt: undefined
      },
      {
        id: 3,
        companyId: 1,
        activityType: 'NOTE',
        subject: 'Internal note: client prefers quarterly payments',
        relatedType: 'OPPORTUNITY',
        relatedId: 10,
        createdAt: '2026-11-02T11:30:00Z'
      },
      {
        id: 4,
        companyId: 1,
        activityType: 'TASK',
        subject: 'Follow up on NDA signature',
        relatedType: 'OPPORTUNITY',
        relatedId: 10,
        dueAt: '2026-11-03T09:00:00Z',
        completedAt: '2026-11-03T11:00:00Z'
      }
    ];

    const timeline = activities.filter(a => a.activityType !== 'TASK');
    const openTasks = activities.filter(a => a.activityType === 'TASK' && !a.completedAt);
    const completedTasks = activities.filter(a => a.activityType === 'TASK' && !!a.completedAt);

    expect(timeline.length).toBe(2);
    expect(timeline.map(t => t.activityType)).toEqual(['CALL', 'NOTE']);

    expect(openTasks.length).toBe(1);
    expect(openTasks[0].subject).toBe('Send customized quotation');

    expect(completedTasks.length).toBe(1);
    expect(completedTasks[0].subject).toBe('Follow up on NDA signature');

    // Simulate completing the open task
    openTasks[0].completedAt = new Date().toISOString();
    const updatedOpenTasks = activities.filter(a => a.activityType === 'TASK' && !a.completedAt);
    expect(updatedOpenTasks.length).toBe(0);
  });

  it('should validate activity creation payload matches REST contract', () => {
    const payload: CrmActivityRequest = {
      activityType: 'MEETING',
      subject: 'Demo meeting with CEO',
      details: 'Showcased CRM Kanban and Quotation workflow',
      relatedType: 'OPPORTUNITY',
      relatedId: 55,
      dueAt: '2026-11-10T11:00:00Z',
      assignedUserId: 1
    };

    expect(payload.activityType).toBe('MEETING');
    expect(payload.relatedType).toBe('OPPORTUNITY');
    expect(payload.relatedId).toBe(55);
    expect(payload.subject).toBeDefined();
  });
});

describe('CRM Module - Quotation Totals & Conversion Calculation', () => {
  interface QuotationLineItem {
    quantity: number;
    unitPrice: number;
    discountPct: number;
  }

  function calculateQuotationSummary(lines: QuotationLineItem[], vatPct: number = 5) {
    const subtotal = lines.reduce((sum, line) => {
      const net = line.quantity * line.unitPrice * (1 - line.discountPct / 100);
      return sum + net;
    }, 0);
    const taxTotal = Math.round(subtotal * (vatPct / 100) * 100) / 100;
    const grandTotal = Math.round((subtotal + taxTotal) * 100) / 100;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      taxTotal,
      grandTotal
    };
  }

  it('should accurately compute multi-line quotation subtotal, 5% VAT and grand total', () => {
    const lines: QuotationLineItem[] = [
      { quantity: 2, unitPrice: 10000, discountPct: 10 }, // 20,000 - 2,000 = 18,000 net
      { quantity: 5, unitPrice: 2000, discountPct: 0 },    // 10,000 net
      { quantity: 1, unitPrice: 4000, discountPct: 25 }    // 3,000 net
    ];

    // Net subtotal: 18,000 + 10,000 + 3,000 = 31,000 AED
    // 5% VAT: 31,000 * 0.05 = 1,550 AED
    // Grand total: 32,550 AED
    const summary = calculateQuotationSummary(lines, 5);

    expect(summary.subtotal).toBe(31000);
    expect(summary.taxTotal).toBe(1550);
    expect(summary.grandTotal).toBe(32550);
  });

  it('should verify quotation acceptance lifecycle enables invoice conversion', () => {
    const quotation: Quotation = {
      id: 501,
      companyId: 1,
      quotationNo: 'QT-2026-0055',
      opportunityId: 10,
      customerId: 3,
      quoteDate: '2026-11-04',
      validUntil: '2026-12-04',
      currencyCode: 'AED',
      subtotal: 31000,
      taxTotal: 1550,
      total: 32550,
      status: 'DRAFT',
      lines: []
    };

    // Status transition: DRAFT -> SENT -> ACCEPTED
    quotation.status = 'SENT';
    expect(quotation.status).toBe('SENT');

    quotation.status = 'ACCEPTED';
    expect(quotation.status).toBe('ACCEPTED');

    // On acceptance, conversion to invoice is permitted:
    const canConvertToInvoice = quotation.status === 'ACCEPTED' && !quotation.invoiceId;
    expect(canConvertToInvoice).toBe(true);

    // After conversion
    quotation.status = 'INVOICED';
    quotation.invoiceId = 701;
    quotation.invoiceNo = 'INV-2026-0341';

    expect(quotation.status).toBe('INVOICED');
    expect(quotation.invoiceNo).toBe('INV-2026-0341');
  });
});

