import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '@/lib/axios';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import Pagination from '@/components/ui/Pagination';

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [pagination, setPagination] = useState({});
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 20 });
    if (status) params.set('status', status);
    api.get(`/bookings?${params}`).then(({ data }) => {
      setBookings(data.bookings ?? []);
      setPagination(data.pagination ?? {});
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [status, page]);

  useEffect(() => { load(); }, [load]);

  const action = async (id, type) => {
    await api.put(`/bookings/${id}/${type}`).catch(console.error);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">All Bookings</h1>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none">
          <option value="">All</option>
          {['pending','approved','issued','returned','rejected','overdue'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['User','Asset','Qty','Dates','Status','Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bookings.map((b) => (
                  <tr key={b._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium">{b.user?.name}</p>
                      <p className="text-xs text-gray-400">{b.user?.email}</p>
                    </td>
                    <td className="px-4 py-3">{b.asset?.name}</td>
                    <td className="px-4 py-3">{b.quantityRequested}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(b.startDate).toLocaleDateString()} – {new Date(b.endDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3"><Badge label={b.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        <Link to={`/bookings/${b._id}`} className="text-blue-600 hover:underline text-xs">View</Link>
                        {b.status === 'pending' && <>
                          <button onClick={() => action(b._id, 'approve')} className="text-green-600 hover:underline text-xs">Approve</button>
                          <button onClick={() => action(b._id, 'reject')} className="text-red-500 hover:underline text-xs">Reject</button>
                        </>}
                        {b.status === 'approved' && <button onClick={() => action(b._id, 'issue')} className="text-purple-600 hover:underline text-xs">Issue</button>}
                        {['issued','overdue'].includes(b.status) && <button onClick={() => action(b._id, 'return')} className="text-gray-600 hover:underline text-xs">Return</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {bookings.length === 0 && <p className="text-center text-gray-400 py-10">No bookings found.</p>}
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {bookings.map((b) => (
              <div key={b._id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{b.asset?.name}</p>
                    <p className="text-xs text-gray-500">{b.user?.name} · Qty: {b.quantityRequested}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(b.startDate).toLocaleDateString()} – {new Date(b.endDate).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge label={b.status} />
                </div>
                <div className="flex gap-3 flex-wrap pt-1">
                  <Link to={`/bookings/${b._id}`} className="text-blue-600 hover:underline text-xs">View</Link>
                  {b.status === 'pending' && <>
                    <button onClick={() => action(b._id, 'approve')} className="text-green-600 hover:underline text-xs">Approve</button>
                    <button onClick={() => action(b._id, 'reject')} className="text-red-500 hover:underline text-xs">Reject</button>
                  </>}
                  {b.status === 'approved' && <button onClick={() => action(b._id, 'issue')} className="text-purple-600 hover:underline text-xs">Issue</button>}
                  {['issued','overdue'].includes(b.status) && <button onClick={() => action(b._id, 'return')} className="text-gray-600 hover:underline text-xs">Return</button>}
                </div>
              </div>
            ))}
            {bookings.length === 0 && <p className="text-center text-gray-400 py-10">No bookings found.</p>}
          </div>

          <Pagination page={pagination.page} pages={pagination.pages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
