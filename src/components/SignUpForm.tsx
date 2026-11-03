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
    <div className="card">
      <h2 className="card-title">アカウント登録</h2>
      <form className="form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="signup-user">ユーザー名</label>
          <input
            id="signup-user"
            type="text"
            autoComplete="username"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="signup-pass">パスワード</label>
          <input
            id="signup-pass"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            pattern="[a-zA-Z0-9]+"
            title="英数字のみ使用できます"
            required
          />
          <span className="hint">英数字のみ使用できます</span>
        </div>
        {error && <p className="msg-error">{error}</p>}
        {success && <p className="msg-success">{success}</p>}
        <button className="btn btn-primary" type="submit" disabled={isSending}>登録</button>
        <p className="auth-footer">すでにアカウントをお持ちの方は <Link to="/login">ログイン</Link></p>
      </form>
    </div>
  );
};

export default SignUpForm;
