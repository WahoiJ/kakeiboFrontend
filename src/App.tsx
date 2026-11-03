import { useState, useEffect, useCallback } from "react";
import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import SignUpForm from "./components/SignUpForm";
import { MonthlyBudgets } from "./components/MonthlyBudgets";
import { History } from "./components/History";
import { ExpenseForm } from "./components/ExpenseForm";
import { apiFetch, AUTH_EXPIRED_EVENT, currentMonthString, yen, type MonthlyBudget, type MonthlyExpenses } from "./api";
import { clearAllDrafts, loadDraft, saveDraft } from "./draft";

/** 今日を含めた残り日数で、1日あたり使える額を計算 */
const amountPerDay = (budget: number, expenses: number, today: Date): number => {
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const remainingDays = lastDay - today.getDate() + 1;
    return Math.floor((budget - expenses) / remainingDays);
};

type Tab = 'history' | 'expenseForm' | 'monthlyBudgets';

const TABS: { key: Tab; label: string }[] = [
    { key: 'expenseForm', label: '出費の入力' },
    { key: 'history', label: '履歴' },
    { key: 'monthlyBudgets', label: '予算設定' },
];

const Dashboard = ({ userName, onLogout, userId }: { userName: string; onLogout: () => void; userId: string }) => {
    // 開いていたタブはリロードしても維持する
    const [activeTab, setActiveTabState] = useState<Tab>(() => {
        const saved = loadDraft<Tab>(userId, 'tab');
        return TABS.some(t => t.key === saved) ? saved! : 'expenseForm';
    });
    const setActiveTab = (tab: Tab) => {
        setActiveTabState(tab);
        saveDraft<Tab>(userId, 'tab', tab);
    };
    const [carriedFrom, setCarriedFrom] = useState<string | null>(null);
    const [currentMonthBudget, setCurrentMonthBudget] = useState<MonthlyBudget | null>(null);
    const [currentMonthExpenses, setCurrentMonthExpenses] = useState<MonthlyExpenses | null>(null);
    const [loaded, setLoaded] = useState(false);

    // 当月の予算／出費を取得するリフレッシュ関数
    const refreshMonthData = useCallback(async () => {
        if (!userId || userId === 'undefined') {
            return;
        }
        const month = currentMonthString();
        try {
            const [budgets, expenses] = await Promise.all([
                apiFetch<MonthlyBudget[]>(`/api/budgets?userId=${Number(userId)}`),
                apiFetch<MonthlyExpenses[]>(`/api/monthly-expenses?userId=${Number(userId)}`),
            ]);
            let current = budgets.find(b => b.budget_month === month) ?? null;
            if (!current) {
                // 今月の予算がなければ、直前に「収入から逆算」で設定した月の内容を自動で引き継いで保存する
                const previous = budgets
                    .filter(b => b.budget_month < month && b.income != null)
                    .sort((a, b) => b.budget_month.localeCompare(a.budget_month))[0];
                if (previous) {
                    current = await apiFetch<MonthlyBudget>('/api/budgets', {
                        method: 'POST',
                        body: JSON.stringify({
                            user_id: Number(userId),
                            budget_month: month,
                            income: previous.income,
                            fixed_costs: previous.fixed_costs,
                            fixed_cost_items: previous.fixed_cost_items ?? null,
                            savings_goal: previous.savings_goal,
                        }),
                    });
                    setCarriedFrom(previous.budget_month);
                }
            }
            setCurrentMonthBudget(current);
            setCurrentMonthExpenses(expenses.find(e => e.budget_month === month) ?? null);
        } catch (error) {
            console.error('Failed to fetch current month data:', error);
        } finally {
            setLoaded(true);
        }
    }, [userId]);

    // マウント／userId 変更時に一度リフレッシュ
    useEffect(() => {
        refreshMonthData();
    }, [refreshMonthData]);

    const today = new Date();
    const spent = currentMonthExpenses?.amount ?? 0;
    const budget = currentMonthBudget?.available_amount ?? 0;
    const remaining = budget - spent;
    const usedRatio = budget > 0 ? spent / budget : 0;
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const remainingDays = lastDay - today.getDate() + 1;

    return (
        <div>
            <header className="header">
                <div>
                    <h1>ずぼら家計簿</h1>
                    <div className="user">{userName} さん</div>
                </div>
                <button className="btn btn-ghost" onClick={onLogout}>ログアウト</button>
            </header>

            {/* 今月のサマリー */}
            <section className="card">
                {currentMonthBudget ? (
                    <>
                        <div className="summary-label">{today.getMonth() + 1}月の残り</div>
                        <div className={`summary-main${remaining < 0 ? ' negative' : ''}`}>{yen(remaining)}</div>
                        <div className="summary-perday">
                            1日あたり <strong>{yen(amountPerDay(budget, spent, today))}</strong> 使えます
                        </div>
                        <div className={`progress${usedRatio >= 1 ? ' over' : usedRatio >= 0.8 ? ' warn' : ''}`}>
                            <div style={{ width: `${Math.min(usedRatio, 1) * 100}%` }} />
                        </div>
                        <div className="summary-stats">
                            <div>予算<b>{yen(budget)}</b></div>
                            <div>使った額<b>{yen(spent)}</b></div>
                            <div>残り日数<b>{remainingDays}日</b></div>
                            <div>消化率<b>{Math.round(usedRatio * 100)}%</b></div>
                        </div>
                        {carriedFrom && (
                            <div className="summary-breakdown">
                                {Number(carriedFrom.slice(5))}月の予算を引き継ぎました。変更は「予算設定」から
                            </div>
                        )}
                        {currentMonthBudget.income != null && (
                            <div className="summary-breakdown">
                                収入 {yen(currentMonthBudget.income)} − 固定費 {yen(currentMonthBudget.fixed_costs ?? 0)} − 貯めたい額 {yen(currentMonthBudget.savings_goal ?? 0)}
                                {currentMonthBudget.fixed_cost_items && currentMonthBudget.fixed_cost_items.length > 0 && (
                                    <div className="summary-items">
                                        固定費の内訳: {currentMonthBudget.fixed_cost_items.map(i => `${i.name} ${yen(i.amount)}`).join('、')}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                ) : loaded ? (
                    <div className="empty-budget">
                        <p>今月の予算がまだ設定されていません</p>
                        <button className="btn btn-ghost" onClick={() => setActiveTab('monthlyBudgets')}>予算を設定する</button>
                    </div>
                ) : (
                    <div className="empty-budget">読み込み中…</div>
                )}
            </section>

            {/* タブ */}
            <nav className="tabs" role="tablist">
                {TABS.map(t => (
                    <button
                        key={t.key}
                        role="tab"
                        aria-selected={activeTab === t.key}
                        className={`tab${activeTab === t.key ? ' active' : ''}`}
                        onClick={() => setActiveTab(t.key)}
                    >
                        {t.label}
                    </button>
                ))}
            </nav>

            {/* タブの内容 */}
            {activeTab === 'history' && <History userId={userId} onRefresh={refreshMonthData} />}
            {activeTab === 'expenseForm' && <ExpenseForm userId={userId} onAddExpense={refreshMonthData} />}
            {activeTab === 'monthlyBudgets' && <MonthlyBudgets onAddMonthlyBudets={refreshMonthData} userId={userId} />}
        </div>
    );
};

type StoredUser = { id: number; userName: string };

const loadStoredUser = (): StoredUser | null => {
    try {
        const stored = localStorage.getItem('user');
        const token = localStorage.getItem('token');
        if (!stored || !token) return null;
        const user = JSON.parse(stored);
        return user && user.id != null && user.userName ? user : null;
    } catch {
        return null;
    }
};

function App() {
    const initialUser = loadStoredUser();
    const [userName, setUserName] = useState<string | null>(initialUser?.userName ?? null);
    const [userId, setUserId] = useState<string | null>(initialUser ? String(initialUser.id) : null);
    const [isLoggedIn, setIsLoggedIn] = useState(initialUser !== null);

    const signOut = useCallback(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setIsLoggedIn(false);
        setUserName(null);
        setUserId(null);
    }, []);

    // 自分でログアウトしたときは、この端末に残っている下書きも消す
    const handleLogout = useCallback(() => {
        clearAllDrafts();
        signOut();
    }, [signOut]);

    // トークン期限切れ（API が 401 を返した）ときはログアウトしてログイン画面へ
    useEffect(() => {
        const onExpired = () => {
            if (localStorage.getItem('token')) {
                alert('ログインの有効期限が切れました。再度ログインしてください。');
            }
            // 期限切れのときは下書きを残す（再ログイン後に続きから入力できる）
            signOut();
        };
        window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
        return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
    }, [signOut]);

    return (
        <Router>
            <Routes>
                <Route path="/login" element={
                    !isLoggedIn ? (
                        <div className="auth">
                            <div className="brand">
                                <h1>ずぼら家計簿</h1>
                                <p>今月あと1日いくら使えるかがすぐわかる</p>
                            </div>
                            <Login setUserName={setUserName} setIsLoggedIn={setIsLoggedIn} setUserId={setUserId} />
                            <p className="auth-footer">
                                応答がない場合は<a href="https://kakeibobackend-t7v7.onrender.com/" target="_blank" rel="noreferrer">サーバーを起動</a>してから再度お試しください
                            </p>
                        </div>
                    ) : (
                        <Navigate to="/dashboard" />
                    )
                } />
                <Route path="/signup" element={
                    <div className="auth">
                        <div className="brand">
                            <h1>ずぼら家計簿</h1>
                            <p>アカウントを作成</p>
                        </div>
                        <SignUpForm />
                    </div>
                } />
                <Route path="/dashboard" element={
                    isLoggedIn && userId && userName ? (
                        <Dashboard userName={userName} onLogout={handleLogout} userId={userId} />
                    ) : (
                        <Navigate to="/login" />
                    )
                } />
                <Route path="*" element={<Navigate to="/login" />} />
            </Routes>
        </Router>
    );
}

export default App
