import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';

export default function AssetForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [form, setForm] = useState({ name: '', category: '', description: '', totalQuantity: '' });
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/assets/${id}`).then(({ data }) => {
      const { name, category, description, totalQuantity } = data.asset;
      setForm({ name, category, description: description || '', totalQuantity });
    }).finally(() => setLoading(false));
  }, [id]);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (image) fd.append('image', image);
      if (isEdit) await api.put(`/assets/${id}`, fd);
      else await api.post('/assets', fd);
      navigate('/assets/manage');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save asset');
    } finally { setSubmitting(false); }
  };

  const f = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  if (loading) return <Spinner />;

  return (
    <div className="max-w-lg">
      <button onClick={() => navigate(-1)} className="text-sm text-blue-600 hover:underline mb-4 block">← Back</button>
      <Card>
        <h1 className="text-lg font-semibold mb-5">{isEdit ? 'Edit Asset' : 'Add New Asset'}</h1>
        <form onSubmit={submit} className="space-y-4">
          <Input label="Name" value={form.name} onChange={f('name')} required />
          <Input label="Category" value={form.category} onChange={f('category')} required />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Description</label>
            <textarea value={form.description} onChange={f('description')} rows={3} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <Input label="Total Quantity" type="number" min={1} value={form.totalQuantity} onChange={f('totalQuantity')} required />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Image (optional)</label>
            <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files[0])} className="text-sm text-gray-500" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" loading={submitting}>{isEdit ? 'Save Changes' : 'Create Asset'}</Button>
        </form>
      </Card>
    </div>
  );
}
