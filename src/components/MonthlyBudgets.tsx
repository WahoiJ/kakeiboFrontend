import React, { useState, useEffect, useCallback } from "react";
import { apiFetch, currentMonthString, errorMessage, yen, type MonthlyBudget } from "../api";

interface MonthlyBudgetsFormProps {
    onAddMonthlyBudets: (budget: MonthlyBudget) => void;
    userId: string;
}

type Mode = 'reverse' | 'direct';

const formatMonth = (month: string): string => {
    const [y, m] = month.split('-');
    return y && m ? `${y}年${Number(m)}月` : month;
};

const daysInMonth = (month: string): number => {
    const [y, m] = month.split('-').map(Number);
    return y && m ? new Date(y, m, 0).getDate() : 30;
};

const toInput = (v: number | null | undefined): string => (v == null ? '' : String(v));

export const MonthlyBudgets: React.FC<MonthlyBudgetsFormProps> = ({ onAddMonthlyBudets, userId }) => {
    const thisMonth = currentMonthString();
    const [budgetMonthValue, setBudgetMonthValue] = useState<string>(thisMonth); // YYYY-MM
    const [mode, setMode] = useState<Mode>('reverse');
    const [income, setIncome] = useState<string>('');
    const [fixedCosts, setFixedCosts] = useState<string>('');
    const [savingsGoal, setSavingsGoal] = useState<string>('');
    const [directAmount, setDirectAmount] = useState<string>('');
    const [prefillNote, setPrefillNote] = useState<string | null>(null);
    const [budgets, setBudgets] = useState<MonthlyBudget[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
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

    const selected = budgets.find(b => b.budget_month === budgetMonthValue);

    // 月を切り替えたら、その月の設定を入力欄に読み込む。
    // 未設定の月なら、直前の月の収入・固定費・貯めたい額を初期値にする（毎月ほぼ同じなので）
    useEffect(() => {
        if (selected) {
            const reverse = selected.income != null;
            setMode(reverse ? 'reverse' : 'direct');
            setIncome(toInput(selected.income));
            setFixedCosts(toInput(selected.fixed_costs));
            setSavingsGoal(toInput(selected.savings_goal));
            setDirectAmount(toInput(selected.available_amount));
            setPrefillNote(null);
            return;
        }
        const previous = budgets
            .filter(b => b.budget_month < budgetMonthValue && b.income != null)
            .sort((a, b) => b.budget_month.localeCompare(a.budget_month))[0];
        setMode('reverse');
        setIncome(toInput(previous?.income));
        setFixedCosts(toInput(previous?.fixed_costs));
        setSavingsGoal(toInput(previous?.savings_goal));
        setDirectAmount('');
        setPrefillNote(previous ? `${formatMonth(previous.budget_month)}の設定を入れています` : null);
    }, [budgetMonthValue, selected, budgets]);

    const incomeNum = Number(income) || 0;
    const fixedNum = Number(fixedCosts) || 0;
    const savingsNum = Number(savingsGoal) || 0;
    const computed = incomeNum - fixedNum - savingsNum;
    const available = mode === 'reverse' ? computed : Number(directAmount) || 0;
    const perDay = Math.floor(available / daysInMonth(budgetMonthValue));

    const canSubmit = mode === 'reverse'
        ? income !== '' && computed >= 0
        : directAmount !== '' && Number(directAmount) >= 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setIsSending(true);
        try {
            const body = mode === 'reverse'
                ? { income: incomeNum, fixed_costs: fixedNum, savings_goal: savingsNum }
                : { available_amount: Number(directAmount) };
            const newBudget = await apiFetch<MonthlyBudget>('/api/budgets', {
                method: 'POST',
                body: JSON.stringify({ user_id: Number(userId), budget_month: budgetMonthValue, ...body }),
            });
            setSuccess(`${formatMonth(newBudget.budget_month)}の予算を ${yen(newBudget.available_amount)} で保存しました`);
            onAddMonthlyBudets(newBudget);
            await fetchBudgets();
        } catch (err) {
            console.error('Failed to save budget:', err);
            setError(errorMessage(err, '予算の保存に失敗しました'));
        } finally {
            setIsSending(false);
        }
    };

    const moneyField = (id: string, label: string, value: string, set: (v: string) => void, hint?: string) => (
        <div className="field">
            <label htmlFor={id}>{label}</label>
            <div className="input-suffix">
                <input
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="0"
                    value={value}
                    onChange={(e) => set(e.target.value)}
                />
                <span>円</span>
            </div>
            {hint && <span className="hint">{hint}</span>}
        </div>
    );

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

                <div className="segmented" role="radiogroup" aria-label="設定方法">
                    <button type="button" role="radio" aria-checked={mode === 'reverse'}
                        className={mode === 'reverse' ? 'active' : ''} onClick={() => setMode('reverse')}>
                        収入から逆算
                    </button>
                    <button type="button" role="radio" aria-checked={mode === 'direct'}
                        className={mode === 'direct' ? 'active' : ''} onClick={() => setMode('direct')}>
                        金額を直接入力
                    </button>
                </div>

                {mode === 'reverse' ? (
                    <>
                        {prefillNote && <p className="hint">{prefillNote}</p>}
                        {moneyField('budget-income', '収入', income, setIncome, '手取りの月収')}
                        {moneyField('budget-fixed', '固定費', fixedCosts, setFixedCosts, '家賃・光熱費・通信費・サブスクなど毎月決まって出ていくお金')}
                        {moneyField('budget-savings', '貯めたい額', savingsGoal, setSavingsGoal)}

                        <div className="calc">
                            <div className="calc-row"><span>収入</span><span>{yen(incomeNum)}</span></div>
                            <div className="calc-row"><span>− 固定費</span><span>{yen(fixedNum)}</span></div>
                            <div className="calc-row"><span>− 貯めたい額</span><span>{yen(savingsNum)}</span></div>
                            <div className={`calc-row calc-total${computed < 0 ? ' negative' : ''}`}>
                                <span>使えるお金</span><span>{yen(computed)}</span>
                            </div>
                            {computed >= 0 && income !== '' && (
                                <div className="calc-perday">1日あたり約 <b>{yen(perDay)}</b></div>
                            )}
                        </div>
                        {computed < 0 && <p className="msg-error">固定費と貯めたい額の合計が収入を超えています</p>}
                    </>
                ) : (
                    moneyField('budget-amount', '使ってよい金額', directAmount, setDirectAmount,
                        directAmount !== '' ? `1日あたり約 ${yen(perDay)}` : undefined)
                )}

                {error && <p className="msg-error">{error}</p>}
                {success && <p className="msg-success">{success}</p>}
                <button className="btn btn-primary" type="submit" disabled={isSending || !canSubmit}>
                    {selected ? `${formatMonth(budgetMonthValue)}の予算を更新する` : `${formatMonth(budgetMonthValue)}の予算を登録する`}
                </button>
            </form>
            <p className="budget-current">
                {formatMonth(budgetMonthValue)}の現在の予算: <b>{selected ? yen(selected.available_amount) : '未設定'}</b>
            </p>
        </section>
    );
};
