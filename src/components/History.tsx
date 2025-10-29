import React, { useState, useEffect } from "react";

type DailyExpense = {
    expense_id: number;
    user_id: number;
    expense_date: string | null;
    amount: number;
};

interface ApiFetchProps {
    userId: string;
    onRefresh?: () => void;
}

export const History: React.FC<ApiFetchProps> = ({ userId, onRefresh }) => {
    const [expenses, setExpenses] = useState<DailyExpense[]>([]);
    const [error, setError] = useState<string | null>(null);
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';

    useEffect(() => {
        if (!userId || userId === 'undefined') {
            console.warn('userId が undefined です');
            setError('ユーザーIDが設定されていません');
            return;
        }

        const userIdNumber = Number(userId); // String を Number に変換
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
        const url = `${baseUrl}/api/expenses?userId=${userIdNumber}`;

        const token = localStorage.getItem('token');
        if (!token) {
            setError('トークンがありません。ログインしてください。');
            return;
        }
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        fetch(url, {
            method: 'GET',
            headers: headers,
        })
            .then(res => {
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                return res.text();
            })
            .then(text => {
                if (!text) {
                    return [];
                }
                return JSON.parse(text);
            })
            .then(data => {
                setExpenses(data);
            })
            .catch(err => {
                console.error('Fetch error:', err);
                setError(err.message);
            });
    }, [userId]);

    const handleDeleteExpense = async (expenseId: number) => {
        const token = localStorage.getItem('token');
        if (!token) {
            setError('トークンがありません。ログインしてください。');
            return;
        }
        const userIdNumber = Number(userId);

        // 削除対象と現在の合計、新合計を計算
        const expenseToDelete = expenses.find(e => e.expense_id === expenseId);
        const currentTotal = expenses.reduce((a, b) => a + b.amount, 0);
        const newTotal = expenseToDelete ? currentTotal - expenseToDelete.amount : currentTotal;
        const budgetMonth = expenseToDelete && expenseToDelete.expense_date ? expenseToDelete.expense_date.slice(0,7) : new Date().toISOString().slice(0,7);

        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        };
        try {
            const response = await fetch(`${baseUrl}/api/expenses/${expenseId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // 削除成功時、リストから該当レコードを削除
            setExpenses(prev => prev.filter(expense => expense.expense_id !== expenseId));

            // サーバ側の MonthlyExpenses を新合計で更新（存在すれば更新、なければ作成）
            await saveMonthlyExpense(userIdNumber, budgetMonth, newTotal, headers);

            // 親に更新を依頼（現在の月の合計等を再取得）
            if (onRefresh) onRefresh();
        } catch (err) {
            console.error('Delete error:', err);
            setError(err instanceof Error ? err.message : 'エラーが発生しました');
        }
    };

    const saveMonthlyExpense = async (userIdNum: number, budgetMonth: string, totalAmount: number, headers: HeadersInit) => {
        try {
            const queryUrl = `${baseUrl}/api/monthly-expenses?userId=${userIdNum}&budgetMonth=${encodeURIComponent(budgetMonth)}`;
            const getRes = await fetch(queryUrl, { method: 'GET', headers });

            if (!getRes.ok && getRes.status !== 404 && getRes.status !== 204) {
                console.warn('Failed fetching monthly-expense:', getRes.status);
            }

            const text = await getRes.text();
            const data = text ? JSON.parse(text) : [];

            if (Array.isArray(data) && data.length > 0) {
                const existing = data[0];
                const id = existing.id ?? existing.monthly_expense_id ?? existing.monthlyExpenseId;
                if (id) {
                    const updateRes = await fetch(`${baseUrl}/api/monthly-expenses/${id}`, {
                        method: 'PUT',
                        headers,
                        body: JSON.stringify({ user_id: userIdNum, budget_month: budgetMonth, amount: totalAmount }),
                    });

                    if (!updateRes.ok) {
                        console.error('Failed to update monthly expense', updateRes.status);
                    }
                    return;
                }
            }

            // 見つからなければ作成
            const createRes = await fetch(`${baseUrl}/api/monthly-expenses`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ user_id: userIdNum, budget_month: budgetMonth, amount: totalAmount }),
            });

            if (!createRes.ok) {
                console.error('Failed to create monthly expense', createRes.status);
            }
        } catch (error) {
            console.error('Error saving monthly expense:', error);
        }
    };

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
                                onClick={() => handleDeleteExpense(expense.expense_id)}
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
                {expenses.reduce((a, b) => a + b.amount, 0)}円
            </ul>
        </div>
    );
};