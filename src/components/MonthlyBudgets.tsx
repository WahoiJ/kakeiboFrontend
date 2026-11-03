import React, { useState, useEffect, useCallback } from "react";
import { apiFetch, currentMonthString, errorMessage, yen, type MonthlyBudget } from "../api";
import { FixedCostEditor } from "./FixedCostEditor";
import { itemsFromBudget, itemsToPayload, newRow, type FixedCostRow } from "../fixedCosts";
import { calcTakeHome } from "../takeHome";
import { clearDraft, loadDraft, saveDraft } from "../draft";

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

type BudgetForm = {
    mode: Mode;
    income: string;
    fixedRows: FixedCostRow[];
    savingsGoal: string;
    directAmount: string;
};

/** 下書きとして保存する形（行の id は保存しない） */
type BudgetFormDraft = Omit<BudgetForm, 'fixedRows'> & { fixedRows: { name: string; amount: string }[] };

type BudgetSettingsDraft = { month: string; gross: string; over40: boolean; residentTax: string; grossOpen?: boolean };

const emptyForm = (): BudgetForm => ({ mode: 'reverse', income: '', fixedRows: [newRow()], savingsGoal: '', directAmount: '' });

const toDraft = (f: BudgetForm): BudgetFormDraft => ({
    ...f,
    fixedRows: f.fixedRows.map(r => ({ name: r.name, amount: r.amount })),
});

const fromDraft = (d: BudgetFormDraft): BudgetForm => ({
    mode: d.mode === 'direct' ? 'direct' : 'reverse',
    income: d.income ?? '',
    fixedRows: d.fixedRows?.length ? d.fixedRows.map(r => newRow(r.name ?? '', r.amount ?? '')) : [newRow()],
    savingsGoal: d.savingsGoal ?? '',
    directAmount: d.directAmount ?? '',
});

export const MonthlyBudgets: React.FC<MonthlyBudgetsFormProps> = ({ onAddMonthlyBudets, userId }) => {
    const thisMonth = currentMonthString();
    // 設定月と「額面から計算」の入力は月をまたいで下書き保存する
    const [settings] = useState(() => loadDraft<BudgetSettingsDraft>(userId, 'budget-settings'));
    const [budgetMonthValue, setBudgetMonthValue] = useState<string>(settings?.month || thisMonth); // YYYY-MM
    const [form, setForm] = useState<BudgetForm>(emptyForm);
    const [prefillNote, setPrefillNote] = useState<string | null>(null);
    const [restored, setRestored] = useState(false);
    const [gross, setGross] = useState<string>(settings?.gross ?? '');
    const [over40, setOver40] = useState<boolean>(settings?.over40 ?? false);
    const [residentTax, setResidentTax] = useState<string>(settings?.residentTax ?? '');
    // 「額面から手取りを計算する」の開閉状態も保持し、再描画やリロードで閉じないようにする
    const [grossOpen, setGrossOpen] = useState<boolean>(settings?.grossOpen ?? false);
    const [budgets, setBudgets] = useState<MonthlyBudget[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);

    const draftName = `budget:${budgetMonthValue}`;
    const { mode, income, fixedRows, savingsGoal, directAmount } = form;

    /** ユーザーの入力で form を変更し、その月の下書きとして保存する */
    const editForm = (patch: Partial<BudgetForm>) => {
        setForm(prev => {
            const next = { ...prev, ...patch };
            saveDraft<BudgetFormDraft>(userId, draftName, toDraft(next));
            return next;
        });
        setRestored(true);
    };

    const saveSettings = (patch: Partial<BudgetSettingsDraft>) => {
        const next = { month: budgetMonthValue, gross, over40, residentTax, grossOpen, ...patch };
        saveDraft<BudgetSettingsDraft>(userId, 'budget-settings', next);
    };

    const fetchBudgets = useCallback(async () => {
        if (!userId || userId === 'undefined') return;
        try {
            setBudgets(await apiFetch<MonthlyBudget[]>(`/api/budgets?userId=${Number(userId)}`));
        } catch (err) {
            console.error('Failed to fetch budgets:', err);
            setError(errorMessage(err, '予算の取得に失敗しました'));
        } finally {
            setLoaded(true);
        }
    }, [userId]);

    useEffect(() => {
        fetchBudgets();
    }, [fetchBudgets]);

    const selected = budgets.find(b => b.budget_month === budgetMonthValue);

    /** 保存済みの内容（または直前の月の内容）を入力欄に読み込む。下書きは使わない */
    const loadFromServer = useCallback((month: string) => {
        const current = budgets.find(b => b.budget_month === month);
        if (current) {
            setForm({
                mode: current.income != null ? 'reverse' : 'direct',
                income: toInput(current.income),
                fixedRows: itemsFromBudget(current),
                savingsGoal: toInput(current.savings_goal),
                directAmount: toInput(current.available_amount),
            });
            setPrefillNote(null);
            return;
        }
        const previous = budgets
            .filter(b => b.budget_month < month && b.income != null)
            .sort((a, b) => b.budget_month.localeCompare(a.budget_month))[0];
        setForm({
            mode: 'reverse',
            income: toInput(previous?.income),
            fixedRows: itemsFromBudget(previous),
            savingsGoal: toInput(previous?.savings_goal),
            directAmount: '',
        });
        setPrefillNote(previous ? `${formatMonth(previous.budget_month)}の設定を入れています` : null);
    }, [budgets]);

    // 月を切り替えたとき・保存済みデータを取得したときに入力欄を読み込む。
    // その月に保存していない入力（下書き）があれば、そちらを優先して復元する
    useEffect(() => {
        if (!loaded) return;
        const draft = loadDraft<BudgetFormDraft>(userId, `budget:${budgetMonthValue}`);
        if (draft) {
            setForm(fromDraft(draft));
            setPrefillNote(null);
            setRestored(true);
            return;
        }
        setRestored(false);
        loadFromServer(budgetMonthValue);
    }, [loaded, budgetMonthValue, loadFromServer, userId]);

    const discardDraft = () => {
        clearDraft(userId, draftName);
        setRestored(false);
        loadFromServer(budgetMonthValue);
    };

    const incomeNum = Number(income) || 0;
    const fixedNum = fixedRows.reduce((a, r) => a + (Number(r.amount) || 0), 0);
    const savingsNum = Number(savingsGoal) || 0;
    const computed = incomeNum - fixedNum - savingsNum;
    const available = mode === 'reverse' ? computed : Number(directAmount) || 0;
    const perDay = Math.floor(available / daysInMonth(budgetMonthValue));

    const takeHome = gross !== ''
        ? calcTakeHome({
            grossMonthly: Number(gross) || 0,
            over40,
            residentTaxMonthly: residentTax === '' ? null : Number(residentTax) || 0,
        })
        : null;

    const canSubmit = mode === 'reverse'
        ? income !== ''
        : directAmount !== '' && Number(directAmount) >= 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setIsSending(true);
        try {
            const body = mode === 'reverse'
                ? { income: incomeNum, fixed_cost_items: itemsToPayload(fixedRows), savings_goal: savingsNum }
                : { available_amount: Number(directAmount) };
            const newBudget = await apiFetch<MonthlyBudget>('/api/budgets', {
                method: 'POST',
                body: JSON.stringify({ user_id: Number(userId), budget_month: budgetMonthValue, ...body }),
            });
            clearDraft(userId, draftName);
            setRestored(false);
            setSuccess(`${formatMonth(newBudget.budget_month)}の予算を ${yen(newBudget.available_amount)} で保存しました`);
            onAddMonthlyBudets(newBudget);
            await fetchBudgets();
        } catch (err) {
            console.error('Failed to save budget:', err);
            setError(errorMessage(err, '予算の保存に失敗しました') + '（入力内容は残っています）');
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
                        onChange={(e) => { setBudgetMonthValue(e.target.value); setSuccess(null); saveSettings({ month: e.target.value }); }}
                        required
                    />
                </div>

                {restored && (
                    <div className="draft-note">
                        <span>保存していない入力があります</span>
                        <button type="button" className="btn btn-ghost" onClick={discardDraft}>
                            {selected ? '保存済みの内容に戻す' : '入力を消す'}
                        </button>
                    </div>
                )}

                <div className="segmented" role="radiogroup" aria-label="設定方法">
                    <button type="button" role="radio" aria-checked={mode === 'reverse'}
                        className={mode === 'reverse' ? 'active' : ''} onClick={() => editForm({ mode: 'reverse' })}>
                        収入から逆算
                    </button>
                    <button type="button" role="radio" aria-checked={mode === 'direct'}
                        className={mode === 'direct' ? 'active' : ''} onClick={() => editForm({ mode: 'direct' })}>
                        金額を直接入力
                    </button>
                </div>

                {mode === 'reverse' ? (
                    <>
                        {prefillNote && <p className="hint">{prefillNote}</p>}
                        {moneyField('budget-income', '収入', income, v => editForm({ income: v }), '手取りの月収')}
                        <details
                            className="gross-calc"
                            open={grossOpen}
                            onToggle={(e) => {
                                const open = (e.currentTarget as HTMLDetailsElement).open;
                                if (open !== grossOpen) { setGrossOpen(open); saveSettings({ grossOpen: open }); }
                            }}
                        >
                            <summary>額面から手取りを計算する</summary>
                            <div className="gross-body">
                                {moneyField('budget-gross', '額面（総支給額）', gross, v => { setGross(v); saveSettings({ gross: v }); }, '給与明細の総支給額。会社員・扶養なし・賞与なしの前提で概算します')}
                                <label className="check">
                                    <input type="checkbox" checked={over40} onChange={(e) => { setOver40(e.target.checked); saveSettings({ over40: e.target.checked }); }} />
                                    40〜64歳（介護保険料あり）
                                </label>
                                {moneyField('budget-resident', '住民税（月額・任意）', residentTax, v => { setResidentTax(v); saveSettings({ residentTax: v }); }, '住民税決定通知書の金額。空欄なら概算します')}
                                {takeHome && (
                                    <>
                                        <div className="calc">
                                            <div className="calc-row"><span>額面</span><span>{yen(Number(gross) || 0)}</span></div>
                                            <div className="calc-row"><span>− 健康保険{over40 ? '・介護保険' : ''}</span><span>{yen(takeHome.health)}</span></div>
                                            <div className="calc-row"><span>− 厚生年金</span><span>{yen(takeHome.pension)}</span></div>
                                            <div className="calc-row"><span>− 雇用保険</span><span>{yen(takeHome.employment)}</span></div>
                                            <div className="calc-row"><span>− 所得税</span><span>{yen(takeHome.incomeTax)}</span></div>
                                            <div className="calc-row"><span>− 住民税{takeHome.residentTaxEstimated ? '（概算）' : ''}</span><span>{yen(takeHome.residentTax)}</span></div>
                                            <div className="calc-row calc-total"><span>手取り（目安）</span><span>{yen(takeHome.takeHome)}</span></div>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn btn-ghost"
                                            onClick={() => editForm({ income: String(takeHome.takeHome) })}
                                        >
                                            この手取りを収入に入れる
                                        </button>
                                    </>
                                )}
                            </div>
                        </details>
                        <FixedCostEditor rows={fixedRows} onChange={rows => editForm({ fixedRows: rows })} />
                        {moneyField('budget-savings', '貯めたい額', savingsGoal, v => editForm({ savingsGoal: v }))}

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
                        {computed < 0 && (
                            <p className="msg-warning">固定費と貯めたい額の合計が収入を超えています。このまま保存すると、使えるお金はマイナスになります</p>
                        )}
                    </>
                ) : (
                    moneyField('budget-amount', '使ってよい金額', directAmount, v => editForm({ directAmount: v }),
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
