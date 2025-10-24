import React, { useState } from 'react';
import axios from 'axios';

const SignUpForm: React.FC = () => {
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
      await axios.post(`${baseUrl}/api/users/register`, {
        userName,
        password
      });
      setSuccess('アカウント登録が成功しました。ログインしてください。');
      // 成功したらログイン画面に遷移
      setTimeout(() => {
        window.location.href = '/'; // App.tsxがLoginを表示しているので
      }, 2000);
    } catch (err: unknown) {
      if (err instanceof Error && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setError(axiosErr.response?.data?.message || '登録に失敗しました。');
      } else {
        setError('ネットワークエラーが発生しました。');
      }
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
          <label>パスワード:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {success && <p style={{ color: 'green' }}>{success}</p>}
        <button type="submit">登録</button>
      </form>
      <p>すでにアカウントをお持ちですか？ <a href="/">ログイン</a></p>
    </div>
  );
};

export default SignUpForm;
