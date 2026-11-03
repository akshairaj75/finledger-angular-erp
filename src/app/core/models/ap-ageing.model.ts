export interface ApAgeingVendor {
  vendorId: number;
  vendorCode: string;
  vendorName: string;
  current: number;
  days1To30: number;
  days31To60: number;
  days61To90: number;
  daysOver90: number;
  totalOutstanding: number;
}

export interface ApAgeingReport {
  asOfDate: string;
  vendors: ApAgeingVendor[];
  totalCurrent: number;
  total1To30: number;
  total31To60: number;
  total61To90: number;
  totalOver90: number;
  grandTotal: number;
}

