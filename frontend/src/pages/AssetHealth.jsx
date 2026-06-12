import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import Pagination from '@/components/ui/Pagination';

const CONDITIONS = ['excellent', 'good', 'fair', 'damaged', 'under_maintenance'];

export default function AssetHealth() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ condition: 'good', note: '' });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/assets/${id}/health?page=${page}&limit=10`)
      .then(({ data }) => setData(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id, page]);

  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true); setMsg('');
    try {
      await api.post(`/assets/${id}/health`, form);
      setMsg('Health report logged successfully.');
      setForm({ condition: 'good', note: '' });
      load();
    } catch (err) {
      setMsg(err.response?.data?.message || 'Failed to log report');
    } finally { setSubmitting(false); }
  };

  if (loading && !data) return <Spinner />;

  return (
    <div className="max-w-2xl space-y-6">
      <button onClick={() => navigate(-1)} className="text-sm text-blue-600 hover:underline">← Back</button>

      {data?.asset && (
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{data.asset.name}</h1>
          <Badge label={data.asset.status} />
        </div>
      )}

      {/* Log new report */}
      <Card>
        <h2 className="font-medium mb-4">Log Condition Report</h2>
        <form onSubmit={submit} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Condition</label>
            <select
              value={form.condition}
              onChange={(e) => setForm({ ...form, condition: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>{c.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Note (optional)</label>
            <textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              rows={2}
              placeholder="Describe the condition or damage..."
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          {form.condition === 'under_maintenance' && (
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
              ⚠️ Setting to Under Maintenance will zero out available quantity until cleared.
            </p>
          )}
          {msg && <p className={`text-sm ${msg.includes('success') ? 'text-green-600' : 'text-red-500'}`}>{msg}</p>}
          <Button type="submit" loading={submitting}>Submit Report</Button>
        </form>
      </Card>

      {/* History */}
      <Card>
        <h2 className="font-medium mb-4">Condition History</h2>
        {loading ? <Spinner /> : (
          <div className="space-y-3">
            {data?.records?.map((r) => (
              <div key={r._id} className="flex items-start justify-between border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge label={r.condition} />
                    <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleString()}</span>
                  </div>
                  {r.note && <p className="text-sm text-gray-600 mt-1">{r.note}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">by {r.reportedBy?.name || 'Admin'}</p>
                </div>
              </div>
            ))}
            {data?.records?.length === 0 && <p className="text-sm text-gray-400">No reports yet.</p>}
          </div>
        )}
        <Pagination page={data?.pagination?.page} pages={data?.pagination?.pages} onChange={setPage} />
      </Card>
    </div>
  );
}
