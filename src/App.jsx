import { useState } from 'react';
import './App.css';

function App() {
  // 1. Define state for the form inputs
  const [amount, setAmount] = useState('');
  const [hour, setHour] = useState('');
  const [age, setAge] = useState('');
  const [isInternational, setIsInternational] = useState(false);

  // 2. Define state for the API response
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // 3. Handle the form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      // Call your live Render API
      const response = await fetch('https://fraud-detection-api-71aw.onrender.com/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
          hour_of_day: parseInt(hour),
          user_age: parseInt(age),
          is_international: isInternational ? 1 : 0,
        }),
      });

      if (!response.ok) throw new Error('API Error');
      
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error(error);
      alert("Failed to connect to the API. Is the Render server awake?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="header">
        <h1>🚨 Fraud Detection Portal</h1>
        <p>Banking Transaction Real-Time Analysis</p >
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Transaction Amount ($)</label>
            <input 
              type="number" 
              value={amount} 
              onChange={(e) => setAmount(e.target.value)} 
              placeholder="e.g. 4500" 
              required 
            />
          </div>

          <div className="form-group">
            <label>Hour of Day (0 - 23)</label>
            <input 
              type="number" 
              value={hour} 
              onChange={(e) => setHour(e.target.value)} 
              placeholder="e.g. 2" 
              min="0" max="23"
              required 
            />
          </div>

          <div className="form-group">
            <label>User Age</label>
            <input 
              type="number" 
              value={age} 
              onChange={(e) => setAge(e.target.value)} 
              placeholder="e.g. 25" 
              required 
            />
          </div>

          <div className="checkbox-group">
            <input 
              type="checkbox" 
              checked={isInternational} 
              onChange={(e) => setIsInternational(e.target.checked)} 
            />
            <label>Is this an International Transaction?</label>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'Analyzing...' : 'Analyze Transaction'}
          </button>
        </form>

        {/* Display the Result */}
        {result && (
          <div className={`result-box ${result.prediction === 'FRAUD DETECTED' ? 'result-fraud' : 'result-safe'}`}>
            <h2>{result.prediction}</h2>
            <p>Confidence: <strong>{result.fraud_probability}%</strong></p >
          </div>
        )}
      </div>
    </div>
  );
}

export default App;