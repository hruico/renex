import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

export default function Register() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { data } = await api.post('/auth/register', form);
      setAuth(data.user, data.accessToken);
      navigate(data.user.role === 'admin' ? '/dashboard' : '/assets');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  const f = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl border border-gray-200 p-8 w-full max-w-sm shadow-sm">
        <h1 className="text-2xl font-bold text-blue-600 mb-1">Renex</h1>
        <p className="text-sm text-gray-500 mb-6">Create your account</p>
        <form onSubmit={submit} className="space-y-4">
          <Input label="Name" value={form.name} onChange={f('name')} required />
          <Input label="Email" type="email" value={form.email} onChange={f('email')} required />
          <Input label="Password" type="password" value={form.password} onChange={f('password')} required />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" loading={loading} className="w-full justify-center">Create Account</Button>
        </form>
        <p className="text-sm text-center text-gray-500 mt-4">
          Have an account? <Link to="/login" className="text-blue-600 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
