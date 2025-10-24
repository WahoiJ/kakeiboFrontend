import React, { useState, useEffect } from "react";

type MonthlyBudgets = {
    user_id: number;
    budget_month: string;
    available_amount: number;
}

interface MonthlyBudgetsFormProps {
    onAddMonthlyBudets: (buget: MonthlyBudgets) => void;
    userId: string;
}


export const MonthlyBudgets: React.FC<MonthlyBudgetsFormProps> = ({ onAddMonthlyBudets, userId }) => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const budgetMonthString = `${year}-${month}`;
    const [budgetMonthValue, setBudgetMonthValue] = useState<string>(budgetMonthString);
    const [inputAvailableAmount, setInputAvailableAmount] = useState<number>(0);
    const [availableAmount, setAvailableAmount] = useState<number>(0);

    useEffect(() => {
        if (!userId || userId === 'undefined') {
            console.warn('userId が undefined です');
            return;
        }

        const userIdNumber = Number(userId); // String を Number に変換

        const fetchBudgets = async () => {
            const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
            const token = localStorage.getItem('token');
            const headers: HeadersInit = {
                'Content-Type': 'application/json',
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            const response = await fetch(`${baseUrl}/api/budgets?userId=${userIdNumber}`, {
                method: 'GET',
                headers: headers,
            });
            if (response.ok) {
                const data: MonthlyBudgets[] = await response.json();
                // 現在の月のavailableAmountを設定
                const currentBudget = data.find(b => b.budget_month === budgetMonthString);
                if (currentBudget) {
                    setAvailableAmount(currentBudget.available_amount);
                } else {
                    setAvailableAmount(0); // データがない場合は0
                }
            } else {
                console.error('Failed to fetch budgets, status:', response.status);
                setAvailableAmount(0);
            }
        };
        fetchBudgets();
    }, [userId, budgetMonthString]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
        const token = localStorage.getItem('token');
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        const response = await fetch(`${baseUrl}/api/budgets`, {
            method: "POST",
            headers: headers,
            body: JSON.stringify({
                user_id: Number(userId),
                budget_month: budgetMonthValue,
                available_amount: inputAvailableAmount,
            }),
        });
        if (response.ok) {
            const newBudget: MonthlyBudgets = await response.json();
            onAddMonthlyBudets(newBudget);
            setBudgetMonthValue(budgetMonthString);
            // フォームをリセット
            setInputAvailableAmount(0);
            // useEffectが再実行されてDBから最新データを取得
            setAvailableAmount(newBudget.available_amount);
        } else {
            console.error('Failed to save budget, response status:', response.status);
        }
    };
    return (
        <>
            <form onSubmit={handleSubmit}>

                <h2>月の出費目標を入力する</h2>
                <div>
                    <label>設定月</label>
                    <input
                        type="text"
                        value={budgetMonthValue}
                        onChange={(e) => setBudgetMonthValue((e.target.value))}
                        required
                    />
                </div>
                <div>
                    <label>出費可能額:</label>
                    <input
                        type="number"
                        value={inputAvailableAmount}
                        onChange={(e) => setInputAvailableAmount(Number(e.target.value))}
                        required
                    />
                </div>
                <button type="submit">入力</button>
            </form>
            <div>登録した額: {availableAmount}円</div>

        </>
    );
};