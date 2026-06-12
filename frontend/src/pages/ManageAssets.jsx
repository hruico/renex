import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '@/lib/axios';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import Pagination from '@/components/ui/Pagination';
import QRModal from '@/components/QRModal';

export default function ManageAssets() {
  const [assets, setAssets] = useState([]);
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [qr, setQr] = useState(null); // { id, name }
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/assets?page=${page}&limit=20`).then(({ data }) => {
      setAssets(data.assets ?? []);
      setPagination(data.pagination ?? {});
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const del = async (id) => {
    if (!confirm('Delete this asset?')) return;
    await api.delete(`/assets/${id}`);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Manage Assets</h1>
        <Button onClick={() => navigate('/assets/manage/new')}>+ Add Asset</Button>
      </div>

      {loading ? <Spinner /> : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['Name','Category','Total','Available','Status','Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {assets.map((a) => (
                  <tr key={a._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{a.name}</td>
                    <td className="px-4 py-3 text-gray-500">{a.category}</td>
                    <td className="px-4 py-3">{a.totalQuantity}</td>
                    <td className="px-4 py-3">{a.availableQuantity}</td>
                    <td className="px-4 py-3"><Badge label={a.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        <Link to={`/assets/manage/${a._id}/edit`} className="text-blue-600 hover:underline text-xs">Edit</Link>
                        <Link to={`/assets/${a._id}`} className="text-gray-500 hover:underline text-xs">View</Link>
                        <Link to={`/assets/${a._id}/health`} className="text-green-600 hover:underline text-xs">Health</Link>
                        <button onClick={() => setQr({ id: a._id, name: a.name })} className="text-purple-600 hover:underline text-xs">QR</button>
                        <button onClick={() => del(a._id)} className="text-red-500 hover:underline text-xs">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {assets.length === 0 && <p className="text-center text-gray-400 py-10">No assets yet.</p>}
          </div>
          <Pagination page={pagination.page} pages={pagination.pages} onChange={setPage} />
        </>
      )}

      <QRModal
        open={!!qr}
        assetId={qr?.id}
        assetName={qr?.name}
        onClose={() => setQr(null)}
      />
    </div>
  );
}
