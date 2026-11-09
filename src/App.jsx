import { useState } from 'react';
import './App.css';

function App() {
  // --- Authentication State ---
  const [token, setToken] = useState(''); 
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');

  // --- Prediction State ---
  const [amount, setAmount] = useState('');
  const [hour, setHour] = useState('');
  const [age, setAge] = useState('');
  const [isInternational, setIsInternational] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const API_URL = 'https://fraud-detection-api-71aw.onrender.com';

  // --- Handle Login / Register ---
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    
    if (isRegistering) {
      // Register
      const res = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        alert("Registration successful! Please log in.");
        setIsRegistering(false);
      } else {
        const data = await res.json();
        setAuthError(data.detail || "Registration failed");
      }
    } else {
      // Login
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setToken(data.access_token);
      } else {
        setAuthError("Invalid username or password");
      }
    }
  };

  const handleLogout = () => {
    setToken('');
    setResult(null);
  };

  // --- Handle Prediction ---
  const handlePredict = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(`${API_URL}/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
          hour_of_day: parseInt(hour),
          user_age: parseInt(age),
          is_international: isInternational ? 1 : 0,
        }),
      });

      if (response.status === 401) {
        handleLogout();
        alert("Session expired. Please log in again.");
        return;
      }

      if (!response.ok) throw new Error('API Error');
      
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error(error);
      alert("Failed to connect to the API. Is the server awake?");
    } finally {
      setLoading(false);
    }
  };

  // --- RENDER LOGIN PAGE ---
  if (!token) {
    return (
      <div className="app-container">
        <div className="header">
          <h1>🏦 Secure Bank Portal</h1>
          <p>Employee Authentication</p >
        </div>
        <div className="card">
          <form onSubmit={handleAuth}>
            <h2 style={{ marginBottom: '20px', textAlign: 'center', color: '#4DB8FF' }}>
              {isRegistering ? 'Create Account' : 'Sign In'}
            </h2>
            {authError && <p style={{ color: '#FF4B4B', marginBottom: '15px' }}>{authError}</p >}
            
            <div className="form-group">
              <label>Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            
            <button type="submit">{isRegistering ? 'Register' : 'Login'}</button>
          </form>
          
          <p style={{ marginTop: '20px', textAlign: 'center', cursor: 'pointer', color: '#4DB8FF' }} onClick={() => setIsRegistering(!isRegistering)}>
            {isRegistering ? 'Already have an account? Login' : 'Need an account? Register'}
          </p >
        </div>
      </div>
    );
  }

  // --- RENDER DASHBOARD ---
  return (
    <div className="app-container">
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '600px' }}>
        <div>
          <h1>🚨 Fraud Detection Portal</h1>
          <p>Banking Transaction Real-Time Analysis</p >
        </div>
        <button onClick={handleLogout} style={{ width: 'auto', padding: '10px 20px', background: 'transparent', border: '1px solid #FF4B4B', color: '#FF4B4B', cursor: 'pointer', borderRadius: '8px' }}>
          Logout
        </button>
      </div>

      <div className="card">
        <form onSubmit={handlePredict}>
          <div className="form-group">
            <label>Transaction Amount ($)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 4500" required />
          </div>
          <div className="form-group">
            <label>Hour of Day (0 - 23)</label>
            <input type="number" value={hour} onChange={(e) => setHour(e.target.value)} placeholder="e.g. 2" min="0" max="23" required />
          </div>
          <div className="form-group">
            <label>User Age</label>
            <input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 25" required />
          </div>
          <div className="checkbox-group">
            <input type="checkbox" checked={isInternational} onChange={(e) => setIsInternational(e.target.checked)} />
            <label>Is this an International Transaction?</label>
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Analyzing...' : 'Analyze Transaction'}
          </button>
        </form>

        {result && (
          <div className={`result-box ${result.prediction === 'FRAUD DETECTED' ? 'result-fraud' : 'result-safe'}`}>
            <h2>{result.prediction}</h2>
            <p>Confidence: <strong>{result.fraud_probability}%</strong></p >
            <p style={{ fontSize: '0.9rem', marginTop: '10px', opacity: 0.8 }}>
              Recorded at: {new Date(result.timestamp).toLocaleString()}
            </p >
          </div>
        )}
      </div>
    </div>
  );
}

export default App;