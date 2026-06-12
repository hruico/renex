import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';

export default function AssetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ quantityRequested: 1, purpose: '', startDate: '', endDate: '' });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get(`/assets/${id}`).then(({ data }) => setAsset(data.asset)).finally(() => setLoading(false));
  }, [id]);

  const book = async (e) => {
    e.preventDefault();
    setSubmitting(true); setMsg('');
    try {
      await api.post('/bookings', { ...form, assetId: id, quantityRequested: Number(form.quantityRequested) });
      setMsg('Booking submitted successfully!');
      setForm({ quantityRequested: 1, purpose: '', startDate: '', endDate: '' });
    } catch (err) {
      setMsg(err.response?.data?.message || 'Failed to submit booking');
    } finally { setSubmitting(false); }
  };

  if (loading) return <Spinner />;
  if (!asset) return <p className="text-center py-12 text-gray-400">Asset not found.</p>;

  const f = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div className="max-w-3xl space-y-6">
      <button onClick={() => navigate(-1)} className="text-sm text-blue-600 hover:underline">← Back</button>
      <Card>
        {asset.imageUrl && <img src={asset.imageUrl} alt={asset.name} className="w-full h-56 object-cover rounded-lg mb-4" />}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold">{asset.name}</h1>
            <p className="text-sm text-gray-500">{asset.category}</p>
          </div>
          <Badge label={asset.status} />
        </div>
        {asset.description && <p className="text-sm text-gray-600 mt-3">{asset.description}</p>}
        <p className="text-sm mt-3 text-gray-500">Available: <span className="font-medium text-gray-900">{asset.availableQuantity} / {asset.totalQuantity}</span></p>
      </Card>

      {asset.status !== 'unavailable' && (
        <Card>
          <h2 className="font-medium mb-4">Book this Asset</h2>
          <form onSubmit={book} className="space-y-4">
            <Input label="Quantity" type="number" min={1} max={asset.availableQuantity} value={form.quantityRequested} onChange={f('quantityRequested')} required />
            <Input label="Purpose" value={form.purpose} onChange={f('purpose')} placeholder="What will you use it for?" required />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Start Date" type="date" value={form.startDate} onChange={f('startDate')} required />
              <Input label="End Date" type="date" value={form.endDate} onChange={f('endDate')} required />
            </div>
            {msg && <p className={`text-sm ${msg.includes('success') ? 'text-green-600' : 'text-red-500'}`}>{msg}</p>}
            <Button type="submit" loading={submitting}>Submit Booking Request</Button>
          </form>
        </Card>
      )}
    </div>
  );
}
