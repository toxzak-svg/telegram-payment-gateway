import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function PasswordlessLogin() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }

    try {
      await fetch('/api/v1/auth/magic-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      setSent(true);
    } catch (err) {
      setError('Failed to send magic link');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-semibold text-center mb-4">Sign in with your email</h2>
          {sent ? (
            <p className="text-center text-green-700">Magic link sent — check your inbox.</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 border rounded-lg" />
              </div>

              {error && <p className="text-red-600 text-sm">{error}</p>}

              <button className="w-full bg-blue-600 text-white py-3 rounded-lg">Send magic link</button>
            </form>
          )}

          <div className="mt-4 text-center">
            <button className="text-sm text-blue-600 hover:underline" onClick={() => navigate('/login')}>
              Back to API key login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
