import React, { useState, useEffect } from "react";
import { ExpenseForm } from "./ExpenseForm";

type DailyExpense = {
    expense_id: number;
    user_id: number;
    expense_date: string | null;
    amount: number;
};

interface ApiFetchProps {
    userId: string;
}

export const ApiFetch: React.FC<ApiFetchProps> = ({ userId }) => {
    const [expenses, setExpenses] = useState<DailyExpense[]>([]);
    const [error, setError] = useState<string | null>(null);
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';

    useEffect(() => {
        console.log('ApiFetch userId:', userId);

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
                console.log('Response status:', res.status);
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                return res.json();
            })
            .then(data => {
                console.log('Fetched data:', data);
                setExpenses(data);
            })
            .catch(err => {
                console.error('Fetch error:', err);
                setError(err.message);
            });
    }, [userId]);

    const handleAddExpense = (newExpense: DailyExpense) => {
        setExpenses(prev => [...prev, newExpense]);
    };

    const saveMonthlyExpense = async (userId: number, budgetMonth: string, totalAmount: number, headers: HeadersInit) => {
        try {
            const response = await fetch(`${baseUrl}/api/monthly-expenses`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    user_id: userId,
                    budget_month: budgetMonth,
                    amount: totalAmount,
                }),
            });

            if (response.ok) {
                console.log('Monthly expense saved:', totalAmount);
            } else {
                console.error('Failed to save monthly expense');
            }
        } catch (error) {
            console.error('Error saving monthly expense:', error);
        }
    };

    return (
        <div>
            {error && <div style={{ color: 'red' }}>Error: {error}</div>}
            <ExpenseForm userId={userId} onAddExpense={handleAddExpense} />
            <ul>
                <h2>出費履歴</h2>
                {expenses.length > 0 ? (
                    expenses.map(expense => (
                        <li key={expense.expense_id}>
                            {expense.expense_date} : {expense.amount}円
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