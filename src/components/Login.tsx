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
        <button type="submit" disabled={isSending}>ログイン</button>
        <Link to="/signup">登録する</Link>
      </form>
    </div>
  );
};

export default Login;
