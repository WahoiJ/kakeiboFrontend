import React, { useState, useEffect, useCallback } from "react";
import { apiFetch, currentMonthString, errorMessage, type MonthlyBudget } from "../api";

interface MonthlyBudgetsFormProps {
    onAddMonthlyBudets: (budget: MonthlyBudget) => void;
    userId: string;
}

export const MonthlyBudgets: React.FC<MonthlyBudgetsFormProps> = ({ onAddMonthlyBudets, userId }) => {
    const thisMonth = currentMonthString();
    const [budgetMonthValue, setBudgetMonthValue] = useState<string>(thisMonth); // YYYY-MM
    const [inputAvailableAmount, setInputAvailableAmount] = useState<number>(0);
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
                    available_amount: inputAvailableAmount,
                }),
            });
            onAddMonthlyBudets(newBudget);
            setBudgetMonthValue(thisMonth);
            setInputAvailableAmount(0);
            await fetchBudgets();
        } catch (err) {
            console.error('Failed to save budget:', err);
            setError(errorMessage(err, '予算の保存に失敗しました'));
        } finally {
            setIsSending(false);
        }
    };

    const selected = budgets.find(b => b.budget_month === budgetMonthValue);

    return (
        <>
            <form onSubmit={handleSubmit}>
                <h2>月の出費目標を入力する</h2>
                <div>
                    <label>設定月</label>
                    <input
                        type="month"
                        value={budgetMonthValue}
                        onChange={(e) => setBudgetMonthValue(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label>出費可能額:</label>
                    <input
                        type="number"
                        min={0}
                        value={inputAvailableAmount}
                        onChange={(e) => setInputAvailableAmount(Number(e.target.value))}
                        required
                    />
                </div>
                {error && <p style={{ color: 'red' }}>{error}</p>}
                <button type="submit" disabled={isSending}>入力</button>
            </form>
            <div>{budgetMonthValue} の登録額: {selected ? `${selected.available_amount}円` : '未設定'}</div>
        </>
    );
};
