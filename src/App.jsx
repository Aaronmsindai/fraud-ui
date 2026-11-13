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
  const [cardNetwork, setCardNetwork] = useState('Unknown'); // Auto-detected
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
        if (!/^[a-zA-Z]/.test(username)) {
          setAuthError("Username must start with a letter.");
          return;
        }
        if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(username)) {
          setAuthError("Username can only contain letters, numbers, and underscores.");
          return;
        }

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
          if (Array.isArray(data.detail)) {
            setAuthError(data.detail[0].msg);
          } else if (typeof data.detail === 'object') {
            setAuthError("Validation error. Please check your inputs.");
          } else {
            setAuthError(data.detail || "Registration failed");
          }
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
      console.error(error);
      setAuthError("Failed to connect to the server. It may be waking up. Please try again.");
    }
  };

  const handleLogout = () => {
    setToken(''); setRole('teller'); setResult(null); setHistory([]); setDriftData(null); setAuditLogs([]);
  };

  // --- BIN Detection (Frontend) ---
  const detectCardNetwork = (number) => {
    const clean = number.replace(/[\s-]/g, '');
    if (/^4/.test(clean)) return "Visa";
    if (/^(5[1-5]|2[2-7])/.test(clean)) return "Mastercard";
    if (/^3[47]/.test(clean)) return "American Express";
    if (/^62/.test(clean)) return "UnionPay";
    if (/^(6011|65|64[4-9])/.test(clean)) return "Discover";
    if (/^35/.test(clean)) return "JCB";
    return "Unknown";
  };

  // --- Luhn Algorithm (Frontend Check) ---
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

  // --- Handle Prediction ---
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
          card_network: cardNetwork,
          card_number: cardNumber,
          amount: parseFloat(amount),
          hour_of_day: parseInt(hour),
          user_age: parseInt(age),
          is_international: isInternational ? 1 : 0,
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
          <p>Employee Authentication</p>
        </div>
        <div className="card">
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
              {isRegistering && (
                <small style={{ color: '#A0AABF', marginTop: '5px' }}>
                  Must be 8+ chars, include 1 uppercase, 1 lowercase, 1 number, and 1 special character.
                </small>
              )}
            </div>
            
            <button type="submit">{isRegistering ? 'Register' : 'Login'}</button>
          </form>
          
          <p style={{ marginTop: '20px', textAlign: 'center', cursor: 'pointer', color: '#4DB8FF' }} onClick={() => setIsRegistering(!isRegistering)}>
            {isRegistering ? 'Already have an account? Login' : 'Need an account? Register'}
          </p>
        </div>
      </div>
    );
  }

  // --- Render Dashboard ---
  return (
    <div className="app-container">
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '600px' }}>
        <div>
          <h1>🚨 Fraud Detection Portal</h1>
          <p>Banking Transaction Real-Time Analysis</p>
        </div>
        <button onClick={handleLogout} style={{ width: 'auto', padding: '10px 20px', background: 'transparent', border: '1px solid #FF4B4B', color: '#FF4B4B', cursor: 'pointer', borderRadius: '8px' }}>Logout</button>
      </div>

      {role === 'admin' && (
        <>
          {driftData && (
            <div style={{ width: '100%', maxWidth: '600px', marginBottom: '20px', padding: '15px', borderRadius: '8px', background: driftData.drift_detected ? 'rgba(255, 75, 75, 0.2)' : 'rgba(44, 160, 44, 0.2)', border: `1px solid ${driftData.drift_detected ? '#FF4B4B' : '#2ca02c'}` }}>
              <h3 style={{ color: driftData.drift_detected ? '#FF4B4B' : '#2ca02c', margin: '0 0 10px 0' }}>{driftData.message}</h3>
              {driftData.recent_average_amount !== undefined && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#FAFAFA' }}>
                  <span>Recent Avg: <strong>${driftData.recent_average_amount}</strong></span>
                  <span>Baseline Avg: <strong>${driftData.baseline_average_amount}</strong></span>
                  <span>Fraud Rate: <strong>{driftData.recent_fraud_rate_percentage}%</strong></span>
                </div>
              )}
            </div>
          )}

          <div style={{ width: '100%', maxWidth: '600px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ color: '#4DB8FF', margin: 0 }}>Admin Control Center</h3>
              <button onClick={triggerRetrain} disabled={retraining} style={{ width: 'auto', padding: '8px 15px', fontSize: '0.9rem', background: '#4DB8FF', color: '#000', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                {retraining ? 'Retraining...' : '🔄 Retrain AI Model'}
              </button>
            </div>
            <div style={{ maxHeight: '200px', overflowY: 'auto', background: '#1E232E', padding: '15px', borderRadius: '8px', border: '1px solid #2E3A4E' }}>
              <p style={{ fontSize: '0.85rem', color: '#A0AABF', marginBottom: '10px', fontWeight: 'bold' }}>Immutable Audit Trail (Regulatory Compliance)</p>
              {auditLogs.length > 0 ? auditLogs.map((log, i) => (
                <div key={i} style={{ fontSize: '0.85rem', borderBottom: '1px solid #2E3A4E', paddingBottom: '8px', marginBottom: '8px', color: '#FAFAFA' }}>
                  <span style={{ color: log.prediction === 'FRAUD DETECTED' ? '#FF4B4B' : '#2ca02c', fontWeight: 'bold' }}>{log.prediction}</span> - ${log.amount} ({log.card_network}: {log.card_number}) <br/>
                  <span style={{ color: '#A0AABF', fontSize: '0.8rem' }}>Model: v{log.model_version} | {new Date(log.timestamp).toLocaleString()}</span>
                </div>
              )) : <p style={{ color: '#A0AABF', fontSize: '0.85rem' }}>No audit logs yet. Run a prediction!</p>}
            </div>
          </div>
        </>
      )}

      <div className="card">
        <form onSubmit={handlePredict}>
          <div className="form-group">
            <label style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Card Number</span>
              {/* Dynamic BIN Detection Badge */}
              {cardNumber.length >= 1 && (
                <span style={{ color: '#4DB8FF', fontWeight: 'bold', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                  {detectCardNetwork(cardNumber)}
                </span>
              )}
            </label>
            <input 
              type="text" 
              value={cardNumber} 
              onChange={(e) => {
                setCardNumber(e.target.value);
                setCardNetwork(detectCardNetwork(e.target.value));
              }} 
              placeholder="e.g. 4242424242424242" 
              minLength="16" 
              maxLength="19" 
              required 
            />
          </div>

          <div className="form-group">
            <label>Transaction Amount ($)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 4500" min="0.01" step="0.01" required />
          </div>
          <div className="form-group">
            <label>Hour of Day (0 - 23)</label>
            <input type="number" value={hour} onChange={(e) => setHour(e.target.value)} placeholder="e.g. 2" min="0" max="23" required />
          </div>
          <div className="form-group">
            <label>User Age (18+)</label>
            <input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 25" min="18" max="120" required />
          </div>
          <div className="checkbox-group">
            <input type="checkbox" checked={isInternational} onChange={(e) => setIsInternational(e.target.checked)} />
            <label>Is this an International Transaction?</label>
          </div>
          <button type="submit" disabled={loading}>{loading ? 'Analyzing...' : 'Analyze Transaction'}</button>
        </form>

        {result && (
          <div className={`result-box ${result.prediction === 'FRAUD DETECTED' ? 'result-fraud' : 'result-safe'}`}>
            <h2>{result.prediction}</h2>
            <p>Confidence: <strong>{result.fraud_probability}%</strong></p>
            <p style={{ fontSize: '0.9rem', marginTop: '10px', opacity: 0.8 }}>Recorded at: {new Date(result.timestamp).toLocaleString()}</p>
            {result.risk_factors && Object.keys(result.risk_factors).length > 0 && (
              <div style={{ marginTop: '15px', padding: '15px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', textAlign: 'left' }}>
                <h4 style={{ color: result.prediction === 'FRAUD DETECTED' ? '#FF4B4B' : '#2ca02c', marginBottom: '10px', fontSize: '1rem' }}>{result.prediction === 'FRAUD DETECTED' ? '🚨 Why was this flagged?' : '✅ Key decision factors'}</h4>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.9rem', color: '#FAFAFA', lineHeight: '1.5' }}>
                  {Object.entries(result.risk_factors).map(([factor, score]) => (
                    <li key={factor}><strong style={{ textTransform: 'capitalize' }}>{factor.replace(/_/g, ' ')}</strong><span style={{ color: result.prediction === 'FRAUD DETECTED' ? '#FF4B4B' : '#2ca02c', marginLeft: '5px' }}>(+{score} impact)</span></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {history.length > 0 ? (
          <div style={{ marginTop: '40px', overflowX: 'auto' }}>
            <h3 style={{ color: '#4DB8FF', marginBottom: '15px' }}>Recent Transaction History</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead><tr style={{ borderBottom: '1px solid #2E3A4E', color: '#A0AABF' }}><th style={{ padding: '10px' }}>Card</th><th style={{ padding: '10px' }}>Amount</th><th style={{ padding: '10px' }}>Time</th><th style={{ padding: '10px' }}>Result</th></tr></thead>
              <tbody>
                {history.map((tx, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #1E232E' }}>
                    <td style={{ padding: '10px' }}>{tx.card_network} (...{tx.card_number.slice(-4)})</td>
                    <td style={{ padding: '10px' }}>${tx.amount}</td>
                    <td style={{ padding: '10px' }}>{tx.hour_of_day === 0 ? '12:00 AM' : tx.hour_of_day === 12 ? '12:00 PM' : tx.hour_of_day > 12 ? `${tx.hour_of_day - 12}:00 PM` : `${tx.hour_of_day}:00 AM`}</td>
                    <td style={{ padding: '10px', color: tx.prediction === 'FRAUD DETECTED' ? '#FF4B4B' : '#2ca02c', fontWeight: 'bold' }}>{tx.prediction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p style={{ marginTop: '30px', textAlign: 'center', color: '#A0AABF' }}>No transaction history yet. Run a prediction above!</p>}
      </div>
    </div>
  );
}

export default App;