import React, { useState } from "react";

type DailyExpense = {
    expense_id: number;
    user_id: number;
    expense_date: string | null;
    amount: number;
};

interface ExpenseFormProps {
    userId: string;
    onAddExpense?: (newExpense: DailyExpense) => void;
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({ userId, onAddExpense }) => {
    const today = new Date().toISOString().split('T')[0];//Tで日付までとそのあとを分割
    const [expenseDate, setExpenseDate] = useState<string>(today);
    const [amount, setAmount] = useState<number>(0);
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        const headers: HeadersInit = {
            "Content-Type": "application/json",
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        try {
            // 1. 日々の出費を追加
            const response = await fetch(`${baseUrl}/api/expenses`, {
                method: "POST",
                headers: headers,
                body: JSON.stringify({
                    user_id: Number(userId),
                    expense_date: expenseDate,
                    amount: amount,
                }),
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const newExpenseData = await response.json();

            // onAddExpense を呼び出して新しい支出を追加
            if (onAddExpense) {
                const newExpense: DailyExpense = {
                    expense_id: newExpenseData.expense_id || 0,
                    user_id: Number(userId),
                    expense_date: expenseDate,
                    amount: amount,
                };
                onAddExpense(newExpense);
            }

            // 2. 全出費を取得して合計を計算
            const expensesResponse = await fetch(`${baseUrl}/api/expenses?userId=${Number(userId)}`, {
                method: 'GET',
                headers: headers,
            });

            if (expensesResponse.ok) {
                const allExpenses: DailyExpense[] = await expensesResponse.json();
                const totalAmount = allExpenses.reduce((a, b) => a + b.amount, 0);

                // 3. 月別出費に保存
                const yearMonth = expenseDate.substring(0, 7); // YYYY-MM 形式
                await saveMonthlyExpense(Number(userId), yearMonth, totalAmount, headers);
            }

            setExpenseDate(today);
            setAmount(0);
        } catch (error) {
            console.error('Error adding expense:', error);
            alert('出費の追加に失敗しました: ' + (error as Error).message);
        }
    };

    // 月別出費を保存する関数
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
        <form onSubmit={handleSubmit}>
            <h2>出費を入力する</h2>
            <div>
                <label>日付:</label>
                <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                ></input>
            </div>
            <div>
                <label>出費額:</label>

                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    required
                />
                
                <label>円</label>
            </div>
            <button type="submit">入力</button>
        </form>
    );
};