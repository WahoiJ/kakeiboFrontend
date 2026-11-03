import React, { useState, useEffect } from "react";
import { apiFetch, currentMonthString, errorMessage, type DailyExpense } from "../api";

interface HistoryProps {
    userId: string;
    onRefresh?: () => void;
}

export const History: React.FC<HistoryProps> = ({ userId, onRefresh }) => {
    const [expenses, setExpenses] = useState<DailyExpense[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!userId || userId === 'undefined') {
            setError('ユーザーIDが設定されていません');
            return;
        }
        apiFetch<DailyExpense[] | null>(`/api/expenses?userId=${Number(userId)}`)
            .then(data => {
                setExpenses(data ?? []);
                setError(null);
            })
            .catch(err => {
                console.error('Fetch error:', err);
                setError(errorMessage(err, '出費履歴の取得に失敗しました'));
            });
    }, [userId]);

    const handleDeleteExpense = async (expenseId: number) => {
        try {
            // 月別出費の合計はバックエンドで自動再計算される
            await apiFetch<void>(`/api/expenses/${expenseId}`, { method: 'DELETE' });
            setExpenses(prev => prev.filter(expense => expense.expense_id !== expenseId));
            onRefresh?.();
        } catch (err) {
            console.error('Delete error:', err);
            setError(errorMessage(err, '削除に失敗しました'));
        }
    };

    const month = currentMonthString();
    const monthTotal = expenses
        .filter(e => e.expense_date?.startsWith(month))
        .reduce((a, b) => a + b.amount, 0);
    const allTotal = expenses.reduce((a, b) => a + b.amount, 0);

    return (
        <div>
            {error && <div style={{ color: 'red' }}>Error: {error}</div>}
            <ul>
                <h2>出費履歴</h2>
                {expenses.length > 0 ? (
                    expenses.map(expense => (
                        <li key={expense.expense_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <span>{expense.expense_date} : {expense.amount}円</span>
                            <button
                                onClick={() => {
                                    const confirmed = window.confirm(`${expense.expense_date}の${expense.amount}円を削除しますか？`);
                                    if (confirmed) {
                                        handleDeleteExpense(expense.expense_id);
                                    }
                                }}
                                style={{ backgroundColor: 'red', color: 'white', border: 'none', padding: '5px 10px', cursor: 'pointer', borderRadius: '4px' }}
                            >
                                削除
                            </button>
                        </li>
                    ))
                ) : (
                    <li>出費がありません</li>
                )}
                <h2>合計出費</h2>
                <p>今月（{month}）: {monthTotal}円</p>
                <p>全期間: {allTotal}円</p>
            </ul>
        </div>
    );
};
