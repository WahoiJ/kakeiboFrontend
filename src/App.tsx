import { useState, useEffect, useCallback } from "react";
import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import SignUpForm from "./components/SignUpForm";
import { MonthlyBudgets } from "./components/MonthlyBudgets";
import { History } from "./components/History";
import { ExpenseForm } from "./components/ExpenseForm";
import { apiFetch, AUTH_EXPIRED_EVENT, currentMonthString, type MonthlyBudget, type MonthlyExpenses } from "./api";

/** 今日を含めた残り日数で、1日あたり使える額を計算 */
const amountPerDay = (budget: number, expenses: number, today: Date): number => {
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const remainingDays = lastDay - today.getDate() + 1;
    return Math.floor((budget - expenses) / remainingDays);
};

const Dashboard = ({ userName, onLogout, userId }: { userName: string; onLogout: () => void; userId: string }) => {
    const [activeTab, setActiveTab] = useState<'monthlyBudgets' | 'history' | 'expenseForm'>('history');
    const [currentMonthBudget, setCurrentMonthBudget] = useState<MonthlyBudget | null>(null);
    const [currentMonthExpenses, setCurrentMonthExpenses] = useState<MonthlyExpenses | null>(null);

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
            setCurrentMonthBudget(budgets.find(b => b.budget_month === month) ?? null);
            setCurrentMonthExpenses(expenses.find(e => e.budget_month === month) ?? null);
        } catch (error) {
            console.error('Failed to fetch current month data:', error);
        }
    }, [userId]);

    // マウント／userId 変更時に一度リフレッシュ
    useEffect(() => {
        refreshMonthData();
    }, [refreshMonthData]);

    const spent = currentMonthExpenses?.amount ?? 0;

    return (
        <div>
            <p>ようこそ、{userName}さん</p>
            <p>あなたのUserID:{userId}</p>

            <button onClick={onLogout}>ログアウト</button>

            {/* 月の予算情報 */}
            {currentMonthBudget && (
                <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '5px' }}>
                    <h3>今月の予算情報</h3>
                    <p>設定月: {currentMonthBudget.budget_month}</p>
                    <p>出費可能額: {currentMonthBudget.available_amount}円</p>
                    <p>今月の出費: {spent}円</p>
                    <p style={{ fontSize: '18px', fontWeight: 'bold' }}>残り: {currentMonthBudget.available_amount - spent}円</p>
                    <p>一日当たり{amountPerDay(currentMonthBudget.available_amount, spent, new Date())}円、使えます。</p>
                </div>
            )}

            {/* タブボタン */}
            <div style={{ marginTop: '20px' }}>
                <button
                    onClick={() => setActiveTab('history')}
                    style={{ marginRight: '10px', fontWeight: activeTab === 'history' ? 'bold' : 'normal' }}
                >
                    履歴
                </button>
                <button
                    onClick={() => setActiveTab('expenseForm')}
                    style={{ marginRight: '10px', fontWeight: activeTab === 'expenseForm' ? 'bold' : 'normal' }}
                >
                    出費の入力
                </button>
                <button
                    onClick={() => setActiveTab('monthlyBudgets')}
                    style={{ fontWeight: activeTab === 'monthlyBudgets' ? 'bold' : 'normal' }}
                >
                    月の予算設定
                </button>
            </div>

            {/* タブの内容 */}
            <div style={{ marginTop: '20px' }}>
                {activeTab === 'history' && <History userId={userId} onRefresh={refreshMonthData} />}
                {activeTab === 'expenseForm' && <ExpenseForm userId={userId} onAddExpense={refreshMonthData} />}
                {activeTab === 'monthlyBudgets' && <MonthlyBudgets onAddMonthlyBudets={refreshMonthData} userId={userId} />}
            </div>
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

    const handleLogout = useCallback(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setIsLoggedIn(false);
        setUserName(null);
        setUserId(null);
    }, []);

    // トークン期限切れ（API が 401 を返した）ときはログアウトしてログイン画面へ
    useEffect(() => {
        const onExpired = () => {
            if (localStorage.getItem('token')) {
                alert('ログインの有効期限が切れました。再度ログインしてください。');
            }
            handleLogout();
        };
        window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
        return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
    }, [handleLogout]);

    return (
        <Router>
            <Routes>
                <Route path="/login" element={
                    !isLoggedIn ? (
                        <>
                            <div>ログインしてください</div>
                            <Login setUserName={setUserName} setIsLoggedIn={setIsLoggedIn} setUserId={setUserId} />
                            <p>
                                <a href="https://kakeibobackend-t7v7.onrender.com/" target="_blank" rel="noreferrer">
                                    応答がない場合バックエンドにアクセスしてみてください。
                                </a>
                            </p>
                        </>
                    ) : (
                        <Navigate to="/dashboard" />
                    )
                } />
                <Route path="/signup" element={<SignUpForm />} />
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
