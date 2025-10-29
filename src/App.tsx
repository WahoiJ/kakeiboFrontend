import { useState, useEffect, useCallback } from "react";
import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import SignUpForm from "./components/SignUpForm";
import { MonthlyBudgets } from "./components/MonthlyBudgets";
import { History } from "./components/History";
import { ExpenseForm } from "./components/ExpenseForm";

const today: Date = new Date();
const year: number = today.getFullYear();
const month: number = today.getMonth() + 1;
const date: number = today.getDate();
const budgetMonthString: string = `${year}-${month}`;
const lastDay: number = new Date(year, month, 0).getDate();//月の最終日を取得

type MonthlyBudget = {
    user_id: number;
    budget_month: string;
    available_amount: number;
};

type MonthlyExpenses = {
    user_id: number;
    budget_month: string;
    amount: number;
};


const Dashboard = ({ userName, setIsLoggedIn, setUserName, userId }: { userName: string; setIsLoggedIn: (isLoggedIn: boolean) => void; setUserName: (userName: string | null) => void; userId: string }) => {
    const [activeTab, setActiveTab] = useState<'monthlyBudgets' | 'history' | 'expenseForm'>('history');
    const [currentMonthBudget, setCurrentMonthBudget] = useState<MonthlyBudget | null>(null);
    const [currentMonthExpenses, setCurrentMonthExpenses] = useState<MonthlyExpenses | null>(null);


    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setIsLoggedIn(false);
        setUserName(null);
    };

    const handleAddBudget = useCallback((budget: MonthlyBudget) => {
        console.log('handleAddBudget called with:', budget);
        setCurrentMonthBudget(budget);
    }, []);

    // 当月の予算／出費を取得するリフレッシュ関数
    const refreshMonthData = useCallback(async () => {
        const userIdNumber = Number(userId);

        if (!userId || userId === 'undefined') {
            return;
        }

        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
        const token = localStorage.getItem('token');
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const budgetResponse = await fetch(`${baseUrl}/api/budgets?userId=${userIdNumber}`, {
                method: 'GET',
                headers: headers,
            });

            if (budgetResponse.ok) {
                const data: MonthlyBudget[] = await budgetResponse.json();
                const currentBudget = data.find(b => b.budget_month === budgetMonthString);
                if (currentBudget) {
                    setCurrentMonthBudget(currentBudget);
                } else {
                    setCurrentMonthBudget(null);
                }
            }
            const expenseResponse = await fetch(`${baseUrl}/api/monthly-expenses?userId=${userIdNumber}`, {
                method: 'GET',
                headers: headers,
            });

            if (expenseResponse.ok) {
                const expenseData: MonthlyExpenses[] = await expenseResponse.json();
                const currentExpenses = expenseData.find(e => e.budget_month === budgetMonthString);
                if (currentExpenses) {
                    setCurrentMonthExpenses(currentExpenses);
                } else {
                    setCurrentMonthExpenses(null);
                }
            }
        } catch (error) {
            console.error('Failed to fetch current budget:', error);
        }
    }, [userId]);

    // マウント／userId 変更時に一度リフレッシュ
    useEffect(() => {
        refreshMonthData();
    }, [userId, refreshMonthData]);

    const AmountPerDay = (monthlyBudgets: number, monthlyExpenses: number, dateToday: number, lastDay: number): number => {
        return Math.round((monthlyBudgets - monthlyExpenses) / (lastDay - dateToday));
    }

    return (
        <div>
            <p>ようこそ、{userName}さん</p>
            <p>あなたのUserID:{userId}</p>

            <button onClick={handleLogout}>ログアウト</button>

            {/* 月の予算情報 */}
            {currentMonthBudget && (
                <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '5px' }}>
                    <h3>今月の予算情報</h3>
                    <p>設定月: {currentMonthBudget.budget_month}</p>
                    <p style={{ fontSize: '18px', fontWeight: 'bold' }}>出費可能額: {currentMonthBudget.available_amount}円</p>
                    <p>一日当たり{AmountPerDay(currentMonthBudget.available_amount, currentMonthExpenses?.amount ?? 0, date, lastDay)}円、使えます。</p>
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
                {activeTab === 'expenseForm' && <ExpenseForm userId={userId} onAddExpense={() => { refreshMonthData(); }} />}
                {activeTab === 'monthlyBudgets' && <MonthlyBudgets onAddMonthlyBudets={handleAddBudget} userId={userId} />}
            </div>
        </div>
    );
};

function App() {
    const [userName, setUserName] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            setUserName(user.userName);
            setUserId(user.id);
            setIsLoggedIn(true);
        }
    }, []);

    return (
        <Router>
            <Routes>
                <Route path="/login" element={
                    !isLoggedIn ? (
                        <>
                            <div>{userName ? `ようこそ、${userName}さん` : `ログインしてください`}</div>
                            <Login setUserName={setUserName} setIsLoggedIn={setIsLoggedIn} setUserId={setUserId} />
                        </>
                    ) : (
                        <Navigate to="/dashboard" />
                    )
                } />
                <Route path="/signup" element={<SignUpForm />} />
                <Route path="/dashboard" element={
                    isLoggedIn ? (
                        <Dashboard userName={userName!} setIsLoggedIn={setIsLoggedIn} setUserName={setUserName} userId={userId!} />
                    ) : (
                        <>
                            <a href="https://kakeibobackend-t7v7.onrender.com/">応答がない場合バックエンドにアクセスしてみてください。</a>
                            <Navigate to="/login" />
                        </>
                    )
                } />
                <Route path="/" element={<Navigate to="/login" />} />
            </Routes>
        </Router>
    );
}


export default App
