import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import api from '@/lib/axios';

export default function Profile() {
  const { user, setAuth, token } = useAuthStore();
  const [pwd, setPwd] = useState({ current: '', newPwd: '', confirm: '' });
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const changePassword = async (e) => {
    e.preventDefault();
    if (pwd.newPwd !== pwd.confirm) return setMsg('Passwords do not match');
    setLoading(true); setMsg('');
    try {
      await api.put('/auth/password', { currentPassword: pwd.current, newPassword: pwd.newPwd });
      setMsg('Password updated successfully');
      setPwd({ current: '', newPwd: '', confirm: '' });
    } catch (err) {
      setMsg(err.response?.data?.message || 'Failed to update password');
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-lg space-y-5">
      <h1 className="text-xl font-semibold">Profile</h1>
      <Card>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold">{user?.name}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
          <Badge label={user?.role} />
        </div>
      </Card>

      <Card>
        <h2 className="font-medium mb-4">Change Password</h2>
        <form onSubmit={changePassword} className="space-y-4">
          <Input label="Current Password" type="password" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} required />
          <Input label="New Password" type="password" value={pwd.newPwd} onChange={(e) => setPwd({ ...pwd, newPwd: e.target.value })} required />
          <Input label="Confirm New Password" type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} required />
          {msg && <p className={`text-sm ${msg.includes('success') ? 'text-green-600' : 'text-red-500'}`}>{msg}</p>}
          <Button type="submit" loading={loading}>Update Password</Button>
        </form>
      </Card>
    </div>
  );
}
