import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '@/lib/axios';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import Pagination from '@/components/ui/Pagination';

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [pagination, setPagination] = useState({});
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 20 });
    if (status) params.set('status', status);
    api.get(`/bookings/mine?${params}`).then(({ data }) => {
      setBookings(data.bookings ?? []);
      setPagination(data.pagination ?? {});
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [status, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">My Bookings</h1>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none">
          <option value="">All</option>
          {['pending','approved','issued','returned','rejected','overdue'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {loading ? <Spinner /> : (
        <>
          <div className="space-y-3">
            {bookings.map((b) => (
              <Link key={b._id} to={`/bookings/${b._id}`}>
                <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 hover:border-blue-300 transition flex items-center justify-between">
                  <div>
                    <p className="font-medium">{b.asset?.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{b.asset?.category} · Qty: {b.quantityRequested}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(b.startDate).toLocaleDateString()} – {new Date(b.endDate).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge label={b.status} />
                </div>
              </Link>
            ))}
          </div>
          {bookings.length === 0 && <p className="text-center text-gray-400 py-12">No bookings yet.</p>}
          <Pagination page={pagination.page} pages={pagination.pages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
