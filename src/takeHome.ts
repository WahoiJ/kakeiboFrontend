// 額面（月給）から手取りを概算する。
// 会社員・扶養なし・賞与なしを前提にした「目安」で、実際の給与明細とは数千円程度ずれることがある。
// 料率は 2025〜2026 年度の値をもとにしている。

/** 健康保険（協会けんぽ全国平均 10.0% の本人負担分） */
const HEALTH_RATE = 0.05;
/** 介護保険（40〜64歳のみ、1.59% の本人負担分） */
const CARE_RATE = 0.00795;
/** 厚生年金（18.3% の本人負担分） */
const PENSION_RATE = 0.0915;
/** 雇用保険（一般の事業・本人負担） */
const EMPLOYMENT_RATE = 0.0055;

const HEALTH_BASE_MAX = 1_390_000; // 標準報酬月額の上限（健康保険）
const PENSION_BASE_MIN = 88_000;   // 標準報酬月額の下限（厚生年金）
const PENSION_BASE_MAX = 650_000;  // 標準報酬月額の上限（厚生年金）

export type TakeHomeInput = {
    /** 額面の月給（通勤手当などを含む総支給額） */
    grossMonthly: number;
    /** 40〜64歳なら介護保険料がかかる */
    over40: boolean;
    /** 住民税の月額（住民税決定通知書の値）。未指定なら同じ年収だった前提で概算 */
    residentTaxMonthly?: number | null;
};

export type TakeHomeResult = {
    health: number;
    pension: number;
    employment: number;
    incomeTax: number;
    residentTax: number;
    residentTaxEstimated: boolean;
    totalDeductions: number;
    takeHome: number;
};

/** 給与所得控除（令和7年分以降） */
const salaryDeduction = (annual: number): number => {
    if (annual <= 1_900_000) return Math.min(annual, 650_000);
    if (annual <= 3_600_000) return annual * 0.3 + 80_000;
    if (annual <= 6_600_000) return annual * 0.2 + 440_000;
    if (annual <= 8_500_000) return annual * 0.1 + 1_100_000;
    return 1_950_000;
};

/** 所得税の基礎控除（令和7・8年分） */
const basicDeductionIncomeTax = (income: number): number => {
    if (income <= 1_320_000) return 950_000;
    if (income <= 3_360_000) return 880_000;
    if (income <= 4_890_000) return 680_000;
    if (income <= 6_550_000) return 630_000;
    if (income <= 23_500_000) return 580_000;
    if (income <= 24_000_000) return 480_000;
    if (income <= 24_500_000) return 320_000;
    if (income <= 25_000_000) return 160_000;
    return 0;
};

/** 所得税（速算表、復興特別所得税 2.1% 込み） */
const incomeTaxAnnual = (taxable: number): number => {
    const t = Math.floor(Math.max(taxable, 0) / 1000) * 1000;
    const brackets: [number, number, number][] = [
        [1_950_000, 0.05, 0],
        [3_300_000, 0.10, 97_500],
        [6_950_000, 0.20, 427_500],
        [9_000_000, 0.23, 636_000],
        [18_000_000, 0.33, 1_536_000],
        [40_000_000, 0.40, 2_796_000],
        [Infinity, 0.45, 4_796_000],
    ];
    const [, rate, sub] = brackets.find(([limit]) => t <= limit)!;
    return Math.max(t * rate - sub, 0) * 1.021;
};

export function calcTakeHome({ grossMonthly, over40, residentTaxMonthly }: TakeHomeInput): TakeHomeResult {
    const gross = Math.max(grossMonthly, 0);

    const healthBase = Math.min(gross, HEALTH_BASE_MAX);
    const health = Math.round(healthBase * (HEALTH_RATE + (over40 ? CARE_RATE : 0)));
    const pension = gross > 0 ? Math.round(Math.min(Math.max(gross, PENSION_BASE_MIN), PENSION_BASE_MAX) * PENSION_RATE) : 0;
    const employment = Math.round(gross * EMPLOYMENT_RATE);
    const social = health + pension + employment;

    // 年額に換算して所得税を計算し、月割りにする
    const annualGross = gross * 12;
    const salaryIncome = Math.max(annualGross - salaryDeduction(annualGross), 0);
    const annualSocial = social * 12;
    const incomeTax = Math.round(
        incomeTaxAnnual(salaryIncome - annualSocial - basicDeductionIncomeTax(salaryIncome)) / 12,
    );

    // 住民税: 所得割 10%（基礎控除 43万円）+ 均等割・森林環境税 5,000円 を月割り
    let residentTax: number;
    const residentTaxEstimated = residentTaxMonthly == null;
    if (residentTaxMonthly != null) {
        residentTax = Math.max(residentTaxMonthly, 0);
    } else {
        const taxable = Math.floor(Math.max(salaryIncome - annualSocial - 430_000, 0) / 1000) * 1000;
        residentTax = taxable > 0 ? Math.round((taxable * 0.1 + 5_000) / 12) : 0;
    }

    const totalDeductions = social + incomeTax + residentTax;
    return {
        health,
        pension,
        employment,
        incomeTax,
        residentTax,
        residentTaxEstimated,
        totalDeductions,
        takeHome: gross - totalDeductions,
    };
}
