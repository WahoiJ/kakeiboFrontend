import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE_URL, errorMessage } from '../api';

interface LoginProps {
  setUserName: (userName: string | null) => void;
  setIsLoggedIn: (isLoggedIn: boolean) => void;
  setUserId: (userId: string | null) => void;
}

type LoginResponse = {
  status: string;
  id: number;
  userName: string;
  token: string;
};

const Login: React.FC<LoginProps> = ({ setUserName, setIsLoggedIn, setUserId }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSending(true);
    try {
      const response = await axios.post<LoginResponse>(`${API_BASE_URL}/api/users/login`, {
        userName: username,
        password
      });
      const { token, id, userName } = response.data;
      if (!token || id == null) {
        throw new Error('invalid login response');
      }
      // 出費入力の一時保存（tempMoney）は残し、ログイン情報だけ置き換える
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify({ id, userName }));
      setUserName(userName);
      setUserId(String(id));
      setIsLoggedIn(true);
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(errorMessage(err, 'ログインに失敗しました。ユーザー名またはパスワードを確認してください。'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="card">
      <h2 className="card-title">ログイン</h2>
      <form className="form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="login-user">ユーザー名</label>
          <input
            id="login-user"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="login-pass">パスワード</label>
          <input
            id="login-pass"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="msg-error">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={isSending}>
          {isSending ? 'ログイン中…' : 'ログイン'}
        </button>
        <p className="auth-footer">アカウントをお持ちでない方は <Link to="/signup">新規登録</Link></p>
      </form>
    </div>
  );
};

export default Login;
