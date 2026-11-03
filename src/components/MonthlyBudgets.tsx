import React, { useState, useEffect, useCallback } from "react";
import { apiFetch, currentMonthString, errorMessage, yen, type MonthlyBudget } from "../api";

interface MonthlyBudgetsFormProps {
    onAddMonthlyBudets: (budget: MonthlyBudget) => void;
    userId: string;
}

export const MonthlyBudgets: React.FC<MonthlyBudgetsFormProps> = ({ onAddMonthlyBudets, userId }) => {
    const thisMonth = currentMonthString();
    const [budgetMonthValue, setBudgetMonthValue] = useState<string>(thisMonth); // YYYY-MM
    const [inputAvailableAmount, setInputAvailableAmount] = useState<string>('');
    const [budgets, setBudgets] = useState<MonthlyBudget[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);

    const fetchBudgets = useCallback(async () => {
        if (!userId || userId === 'undefined') return;
        try {
            setBudgets(await apiFetch<MonthlyBudget[]>(`/api/budgets?userId=${Number(userId)}`));
        } catch (err) {
            console.error('Failed to fetch budgets:', err);
            setError(errorMessage(err, '予算の取得に失敗しました'));
        }
    }, [userId]);

    useEffect(() => {
        fetchBudgets();
    }, [fetchBudgets]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSending(true);
        try {
            const newBudget = await apiFetch<MonthlyBudget>('/api/budgets', {
                method: 'POST',
                body: JSON.stringify({
                    user_id: Number(userId),
                    budget_month: budgetMonthValue,
                    available_amount: Number(inputAvailableAmount),
                }),
            });
            onAddMonthlyBudets(newBudget);
            setBudgetMonthValue(thisMonth);
            setInputAvailableAmount('');
            await fetchBudgets();
        } catch (err) {
            console.error('Failed to save budget:', err);
            setError(errorMessage(err, '予算の保存に失敗しました'));
        } finally {
            setIsSending(false);
        }
    };

    const selected = budgets.find(b => b.budget_month === budgetMonthValue);

    const [selY, selM] = budgetMonthValue.split('-');

    return (
        <section className="card">
            <h2 className="card-title">月の予算を設定する</h2>
            <form className="form" onSubmit={handleSubmit}>
                <div className="field">
                    <label htmlFor="budget-month">設定月</label>
                    <input
                        id="budget-month"
                        type="month"
                        value={budgetMonthValue}
                        onChange={(e) => setBudgetMonthValue(e.target.value)}
                        required
                    />
                </div>
                <div className="field">
                    <label htmlFor="budget-amount">使ってよい金額</label>
                    <div className="input-suffix">
                        <input
                            id="budget-amount"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            placeholder={selected ? String(selected.available_amount) : '0'}
                            value={inputAvailableAmount}
                            onChange={(e) => setInputAvailableAmount(e.target.value)}
                            required
                        />
                        <span>円</span>
                    </div>
                </div>
                {error && <p className="msg-error">{error}</p>}
                <button className="btn btn-primary" type="submit" disabled={isSending || inputAvailableAmount === ''}>
                    {selected ? '予算を更新する' : '予算を登録する'}
                </button>
            </form>
            {selY && selM && (
                <p className="budget-current">
                    {selY}年{Number(selM)}月の現在の予算: <b>{selected ? yen(selected.available_amount) : '未設定'}</b>
                </p>
            )}
        </section>
    );
};
