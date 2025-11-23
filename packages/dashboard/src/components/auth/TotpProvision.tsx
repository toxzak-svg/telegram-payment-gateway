import { useState } from 'react';

export default function TotpProvision({ email }: { email?: string }) {
  const [secretData, setSecretData] = useState<{ secret?: string; otpauth?: string } | null>(null);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');

  async function startProvision() {
    try {
      const res = await fetch('/api/v1/auth/totp/enable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const json = await res.json();
      if (json.success) setSecretData(json.data);
      else setMessage('Failed to start provisioning');
    } catch (err) {
      setMessage('Failed to start provisioning');
    }
  }

  async function confirmProvision(e: React.FormEvent) {
    e.preventDefault();
    // Real implementation would POST code and secret_proof to persist secret
    setMessage('Provisioning confirmed (skeleton)');
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h3 className="font-semibold mb-2">Enable TOTP (Authenticator app)</h3>
      {!secretData ? (
        <div>
          <p className="text-sm text-gray-600 mb-2">Click to generate a provisioning QR/secret.</p>
          <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={startProvision}>Start provisioning</button>
        </div>
      ) : (
        <div>
          <p className="text-sm text-gray-700 mb-2">Scan the QR or enter the secret into your authenticator app.</p>
          <pre className="p-2 bg-gray-50 rounded mb-2 text-sm break-words">{secretData.otpauth}</pre>
          <form onSubmit={confirmProvision} className="space-y-2">
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" className="px-3 py-2 border rounded w-full" />
            <button className="bg-green-600 text-white px-4 py-2 rounded">Confirm</button>
          </form>
        </div>
      )}

      {message && <p className="text-sm text-gray-600 mt-2">{message}</p>}
    </div>
  );
}
