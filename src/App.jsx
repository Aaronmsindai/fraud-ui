import { useState, useEffect } from 'react';
import './App.css';

function App() {
  // --- Auth State ---
  const [token, setToken] = useState(''); 
  const [role, setRole] = useState('teller');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');

  // --- Prediction State ---
  const [cardNetwork, setCardNetwork] = useState('Unknown');
  const [cardNumber, setCardNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [hour, setHour] = useState('');
  const [age, setAge] = useState('');
  const [isInternational, setIsInternational] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [driftData, setDriftData] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [retraining, setRetraining] = useState(false);

  const API_URL = 'https://fraud-detection-api-71aw.onrender.com';

  // --- Fetch Functions ---
  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/history`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setHistory(await res.json());
    } catch (error) { console.error(error); }
  };

  const fetchDrift = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/drift`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setDriftData(await res.json());
    } catch (error) { console.error(error); }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/audit`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setAuditLogs(await res.json());
    } catch (error) { console.error(error); }
  };

  const triggerRetrain = async () => {
    setRetraining(true);
    try {
      const res = await fetch(`${API_URL}/admin/retrain`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      alert(data.message);
      fetchAuditLogs(); 
    } catch (error) { console.error(error); } finally { setRetraining(false); }
  };

  useEffect(() => {
    if (token) {
      fetchHistory();
      if (role === 'admin') { fetchDrift(); fetchAuditLogs(); }
    }
  }, [token, role]);

  // --- Auth Handlers ---
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    
    try {
      if (isRegistering) {
        if (!/^[a-zA-Z]/.test(username)) { setAuthError("Username must start with a letter."); return; }
        if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(username)) { setAuthError("Username can only contain letters, numbers, and underscores."); return; }

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
          if (Array.isArray(data.detail)) { setAuthError(data.detail[0].msg); }
          else if (typeof data.detail === 'object') { setAuthError("Validation error. Please check your inputs."); }
          else { setAuthError(data.detail || "Registration failed"); }
        }
      } else {
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);
        const res = await fetch(`${API_URL}/login`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: formData });
        
        if (res.ok) {
          const data = await res.json();
          setToken(data.access_token);
          setRole(data.role);
        } else {
          setAuthError("Invalid username or password");
        }
      }
    } catch (error) {
      setAuthError("Failed to connect to the server. It may be waking up.");
    }
  };

  const handleLogout = () => {
    setToken(''); setRole('teller'); setResult(null); setHistory([]); setDriftData(null); setAuditLogs([]);
  };

  // --- Helpers ---
  const detectCardNetwork = (number) => {
    const clean = number.replace(/[\s-]/g, '');
    if (/^4/.test(clean)) return "Visa";
    if (/^(5[1-5]|2[2-7])/.test(clean)) return "Mastercard";
    if (/^3[47]/.test(clean)) return "Amex";
    if (/^62/.test(clean)) return "UnionPay";
    return "Unknown";
  };

  const isValidLuhn = (cardNumber) => {
    let cleanNumber = cardNumber.replace(/[\s-]/g, '');
    if (!/^\d+$/.test(cleanNumber)) return false;
    let sum = 0, shouldDouble = false;
    for (let i = cleanNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(cleanNumber.charAt(i));
      if (shouldDouble) { digit *= 2; if (digit > 9) digit -= 9; }
      sum += digit; shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
  };

  const handlePredict = async (e) => {
    e.preventDefault();
    if (!isValidLuhn(cardNumber)) {
      alert("Invalid Card Number. Please use a valid test card like 4242 4242 4242 4242.");
      return;
    }
    setLoading(true); setResult(null);

    try {
      const response = await fetch(`${API_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          card_network: cardNetwork, card_number: cardNumber, amount: parseFloat(amount),
          hour_of_day: parseInt(hour), user_age: parseInt(age), is_international: isInternational ? 1 : 0,
        }),
      });

      if (response.status === 401) { handleLogout(); return; }
      if (!response.ok) throw new Error('API Error');
      
      const data = await response.json();
      setResult(data);
      fetchHistory(); 
      if (role === 'admin') { fetchDrift(); fetchAuditLogs(); }
    } catch (error) {
      alert("Failed to connect to the API.");
    } finally {
      setLoading(false);
    }
  };

  // --- Render Login/Register ---
  if (!token) {
    return (
      <div className="app-container">
        <div className="header">
          <h1>🏦 Secure Bank Portal</h1>
          <p>Employee Authentication</p >
        </div>
        <div className="card" style={{ maxWidth: '400px', margin: '0 auto' }}>
          <form onSubmit={handleAuth}>
            <h2 style={{ marginBottom: '20px', textAlign: 'center', color: '#4DB8FF' }}>
              {isRegistering ? 'Create Account' : 'Sign In'}
            </h2>
            {authError && <div style={{ color: '#FF4B4B', marginBottom: '15px', padding: '10px', background: 'rgba(255,75,75,0.1)', borderRadius: '5px', fontSize: '0.9rem' }}>{authError}</div>}
            
            <div className="form-group">
              <label>Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required minLength="3" />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            
            <button type="submit" style={{ marginTop: '20px' }}>{isRegistering ? 'Register' : 'Login'}</button>
          </form>
          
          <p style={{ marginTop: '20px', textAlign: 'center', cursor: 'pointer', color: '#4DB8FF' }} onClick={() => setIsRegistering(!isRegistering)}>
            {isRegistering ? 'Already have an account? Login' : 'Need an account? Register'}
          </p >
        </div>
      </div>
    );
  }

  // --- Calculate KPIs for Dashboard ---
  const totalAnalyzed = history.length;
  const fraudCount = history.filter(tx => tx.prediction === 'FRAUD DETECTED').length;
  const safeCount = totalAnalyzed - fraudCount;

  // --- Render Dashboard ---
  return (
    <div className="dashboard-wrapper">
      {/* SIDEBAR */}
      <div className="sidebar">
        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#4DB8FF', marginBottom: '20px' }}>
          ⚡ FraudShield AI
        </div>
        <div className="nav-item active">Dashboard</div>
        <div className="nav-item">Transactions</div>
        <div className="nav-item">Risk Analytics</div>
        {role === 'admin' && <div className="nav-item">Admin Settings</div>}
        
        <div style={{ marginTop: 'auto' }}>
          <div className="nav-item" onClick={handleLogout} style={{ color: '#FF4B4B' }}>
            Logout
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="main-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, color: '#FAFAFA' }}>Dashboard Overview</h1>
            <p style={{ color: '#A0AABF', margin: '5px 0 0 0' }}>Real-time transaction analysis</p >
          </div>
          <div style={{ color: '#4DB8FF', fontWeight: 'bold' }}>
            Role: {role.toUpperCase()}
          </div>
        </div>

        {/* KPI CARDS */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <span className="kpi-title">Total Analyzed</span>
            <span className="kpi-value">{totalAnalyzed}</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-title">Fraud Detected</span>
            <span className="kpi-value danger">{fraudCount}</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-title">Safe Transactions</span>
            <span className="kpi-value success">{safeCount}</span>
          </div>
        </div>

        {/* ADMIN SECTION (If admin) */}
        {role === 'admin' && driftData && (
          <div className="dashboard-card" style={{ borderColor: driftData.drift_detected ? '#FF4B4B' : '#2ca02c' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, color: driftData.drift_detected ? '#FF4B4B' : '#2ca02c' }}>{driftData.message}</h3>
              <button onClick={triggerRetrain} disabled={retraining} className="primary-btn" style={{ padding: '8px 15px', fontSize: '0.9rem' }}>
                {retraining ? 'Retraining...' : '🔄 Retrain Model'}
              </button>
            </div>
            {driftData.recent_average_amount !== undefined && (
              <div style={{ display: 'flex', gap: '20px', fontSize: '0.9rem', color: '#FAFAFA' }}>
                <span>Recent Avg: <strong>${driftData.recent_average_amount}</strong></span>
                <span>Baseline Avg: <strong>${driftData.baseline_average_amount}</strong></span>
              </div>
            )}
          </div>
        )}

        {/* WORKSPACE GRID (Form + Table) */}
        <div className="workspace-grid">
          
          {/* LEFT COL: FORM */}
          <div className="dashboard-card">
            <h3 style={{ marginBottom: '20px', color: '#FAFAFA' }}>Analyze New Transaction</h3>
            <form onSubmit={handlePredict}>
              <div className="form-group">
                <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Card Number</span>
                  {cardNumber.length >= 1 && (
                    <span style={{ color: '#4DB8FF', fontWeight: 'bold', fontSize: '0.8rem' }}>{detectCardNetwork(cardNumber)}</span>
                  )}
                </label>
                <input type="text" value={cardNumber} onChange={(e) => { setCardNumber(e.target.value); setCardNetwork(detectCardNetwork(e.target.value)); }} placeholder="4242..." required />
              </div>
              <div className="form-group">
                <label>Amount ($)</label>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 4500" min="0.01" step="0.01" required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label>Hour (0-23)</label>
                  <input type="number" value={hour} onChange={(e) => setHour(e.target.value)} placeholder="e.g. 2" min="0" max="23" required />
                </div>
                <div className="form-group">
                  <label>User Age</label>
                  <input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 25" min="18" max="120" required />
                </div>
              </div>
              <div className="checkbox-group" style={{ marginBottom: '20px' }}>
                <input type="checkbox" checked={isInternational} onChange={(e) => setIsInternational(e.target.checked)} />
                <label>International Transaction</label>
              </div>
              <button type="submit" disabled={loading} style={{ width: '100%' }}>{loading ? 'Analyzing...' : 'Analyze Transaction'}</button>
            </form>

            {result && (
              <div className={`result-box ${result.prediction === 'FRAUD DETECTED' ? 'result-fraud' : 'result-safe'}`} style={{ marginTop: '20px' }}>
                <h2 style={{ margin: 0 }}>{result.prediction}</h2>
                <p style={{ margin: '5px 0' }}>Confidence: {result.fraud_probability}%</p >
              </div>
            )}
          </div>

          {/* RIGHT COL: HISTORY TABLE */}
          <div className="dashboard-card">
            <h3 style={{ marginBottom: '20px', color: '#FAFAFA' }}>Recent Transactions</h3>
            {history.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2E3A4E', color: '#A0AABF' }}>
                    <th style={{ padding: '10px' }}>Card</th>
                    <th style={{ padding: '10px' }}>Amount</th>
                    <th style={{ padding: '10px' }}>Time</th>
                    <th style={{ padding: '10px' }}>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((tx, index) => (
                    <tr key={index} className="table-row-hover" style={{ borderBottom: '1px solid #1E232E', color: '#FAFAFA' }}>
                      <td style={{ padding: '15px 10px' }}>{tx.card_network} (...{tx.card_number.slice(-4)})</td>
                      <td style={{ padding: '15px 10px' }}>${tx.amount}</td>
                      <td style={{ padding: '15px 10px', color: '#A0AABF' }}>
                        {tx.hour_of_day === 0 ? '12:00 AM' : tx.hour_of_day === 12 ? '12:00 PM' : tx.hour_of_day > 12 ? `${tx.hour_of_day - 12}:00 PM` : `${tx.hour_of_day}:00 AM`}
                      </td>
                      <td style={{ padding: '15px 10px' }}>
                        <span style={{ 
                          padding: '5px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold',
                          background: tx.prediction === 'FRAUD DETECTED' ? 'rgba(255, 75, 75, 0.1)' : 'rgba(44, 160, 44, 0.1)',
                          color: tx.prediction === 'FRAUD DETECTED' ? '#FF4B4B' : '#2ca02c'
                        }}>
                          {tx.prediction}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ textAlign: 'center', color: '#A0AABF', marginTop: '30px' }}>No transactions analyzed yet.</p >
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

export default App;