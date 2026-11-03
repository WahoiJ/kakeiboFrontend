import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE_URL, errorMessage } from '../api';

const SignUpForm: React.FC = () => {
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSending, setIsSending] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSending(true);
    try {
      await axios.post(`${API_BASE_URL}/api/users/register`, {
        userName,
        password
      });
      setSuccess('アカウント登録が成功しました。ログインしてください。');
      // 成功したらログイン画面に遷移
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: unknown) {
      setError(errorMessage(err, '登録に失敗しました。'));
      setIsSending(false);
    }
  };

  return (
    <div>
      <h2>アカウント登録</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>ユーザー名:</label>
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            required
          />
        </div>
        <div>
          <label>パスワード（英数字のみ）:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            pattern="[a-zA-Z0-9]+"
            title="英数字のみ使用できます"
            required
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {success && <p style={{ color: 'green' }}>{success}</p>}
        <button type="submit" disabled={isSending}>登録</button>
      </form>
      <p>すでにアカウントをお持ちですか？ <Link to="/login">ログイン</Link></p>
    </div>
  );
};

export default SignUpForm;
