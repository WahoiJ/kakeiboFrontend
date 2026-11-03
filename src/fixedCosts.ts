import type { FixedCostItem, MonthlyBudget } from "./api";

/** 入力中の1行（金額は入力途中の文字列のまま持つ） */
export type FixedCostRow = { id: number; name: string; amount: string };

let nextId = 1;
export const newRow = (name = '', amount = ''): FixedCostRow => ({ id: nextId++, name, amount });

export const FIXED_COST_PRESETS = ['家賃', '光熱費', '通信費', 'サブスク', '保険', 'ローン'];

/** 保存済みの予算から入力行を作る。内訳がない古いデータは合計を1行にする */
export const itemsFromBudget = (budget: MonthlyBudget | undefined): FixedCostRow[] => {
    if (budget?.fixed_cost_items && budget.fixed_cost_items.length > 0) {
        return budget.fixed_cost_items.map(i => newRow(i.name, String(i.amount)));
    }
    if (budget?.fixed_costs) {
        return [newRow('固定費', String(budget.fixed_costs))];
    }
    return [newRow()];
};

/** 空行を除いて API に送る形にする */
export const itemsToPayload = (rows: FixedCostRow[]): FixedCostItem[] =>
    rows
        .filter(r => r.name.trim() !== '' || (Number(r.amount) || 0) > 0)
        .map(r => ({ name: r.name.trim() || 'その他', amount: Number(r.amount) || 0 }));
