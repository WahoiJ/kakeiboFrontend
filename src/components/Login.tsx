import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

interface LoginProps {
  setUserName: (userName: string | null) => void;
  setIsLoggedIn: (isLoggedIn: boolean) => void;
  setUserId: (userId: string | null) => void;
}

const Login: React.FC<LoginProps> = ({ setUserName, setIsLoggedIn, setUserId }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      const response = await axios.post(`${baseUrl}/api/users/login`, {
        userName: username,
        password
      });
      // ログイン成功時の処理（例: ページ遷移）
      localStorage.clear(); // 古いデータをクリア
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data));
      setUserName(response.data.userName);
      setUserId(response.data.id.toString()); // IDをstringに変換
      setIsLoggedIn(true);
      navigate('/dashboard'); // React Router で遷移
    } catch (err: unknown) {
      if (err instanceof Error && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setError(axiosErr.response?.data?.message || 'ログインに失敗しました。');
      } else {
        setError('ログインに失敗しました。ユーザー名またはパスワードを確認してください。');
      }
    }
  };

  return (
    <div>
      <h2>ログイン</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>ユーザー名:</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div>
          <label>パスワード:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit">ログイン</button>
        <Link to="/signup">登録する</Link>
      </form>
    </div>
  );
};

export default Login;