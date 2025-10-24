import React, { useState, useEffect } from "react";

type DailyExpense = {
    expense_id: number;
    user_id: number;
    expense_date: string | null;
    amount: number;
};

interface ApiFetchProps {
    userId: string;
}

export const History: React.FC<ApiFetchProps> = ({ userId }) => {
    const [expenses, setExpenses] = useState<DailyExpense[]>([]);
    const [error, setError] = useState<string | null>(null);

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

        try {
            const response = await fetch(`http://localhost:8080/api/expenses/${expenseId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // 削除成功時、リストから該当レコードを削除
            setExpenses(expenses.filter(expense => expense.expense_id !== expenseId));
        } catch (err) {
            console.error('Delete error:', err);
            setError(err instanceof Error ? err.message : 'エラーが発生しました');
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