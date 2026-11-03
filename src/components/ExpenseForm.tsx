import React, { useState } from "react";
import { apiFetch, errorMessage, todayString, type DailyExpense } from "../api";

const TEMP_KEY = 'tempMoney'; // 送信失敗時に入力額を一時保存するキー

interface ExpenseFormProps {
    userId: string;
    onAddExpense?: (newExpense: DailyExpense) => void;
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({ userId, onAddExpense }) => {
    const [expenseDate, setExpenseDate] = useState<string>(todayString());
    const [amount, setAmount] = useState<number>(Number(localStorage.getItem(TEMP_KEY)) || 0);
    const [isSending, setIsSending] = useState<boolean>(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSending) return;
        setIsSending(true);
        try {
            // 日々の出費を追加（月別出費の合計はバックエンドで自動再計算される）
            const newExpense = await apiFetch<DailyExpense>('/api/expenses', {
                method: 'POST',
                body: JSON.stringify({
                    user_id: Number(userId),
                    expense_date: expenseDate,
                    amount: amount,
                }),
            });
            localStorage.removeItem(TEMP_KEY);
            setExpenseDate(todayString());
            setAmount(0);
            onAddExpense?.(newExpense);
            alert('出費を追加しました！');
        } catch (error) {
            localStorage.setItem(TEMP_KEY, amount.toString());
            console.error('Error adding expense:', error);
            alert('出費の追加に失敗しました: ' + errorMessage(error, (error as Error).message));
        } finally {
            setIsSending(false);
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
                    required
                ></input>
            </div>
            <div>
                <label>出費額:</label>

                <input
                    type="number"
                    min={1}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    required
                />

                <label>円</label>
            </div>
            <button type="submit" disabled={amount <= 0 || isSending}>入力</button>
        </form>
    );
};
