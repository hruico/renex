import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import Pagination from '@/components/ui/Pagination';

export default function Assets() {
  const [assets, setAssets] = useState([]);
  const [pagination, setPagination] = useState({});
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 12 });
    if (search) params.set('search', search);
    if (category) params.set('category', category);
    if (status) params.set('status', status);
    api.get(`/assets?${params}`).then(({ data }) => {
      setAssets(data.assets);
      setPagination(data.pagination);
    }).finally(() => setLoading(false));
  }, [search, category, status, page]);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Assets</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="w-48" />
        <input value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} placeholder="Category" className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-40" />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Status</option>
          <option value="available">Available</option>
          <option value="low_stock">Low Stock</option>
          <option value="unavailable">Unavailable</option>
        </select>
      </div>

      {loading ? <Spinner /> : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {assets.map((a) => (
              <Link key={a._id} to={`/assets/${a._id}`}>
                <Card className="hover:border-blue-300 transition cursor-pointer h-full">
                  {a.imageUrl
                    ? <img src={a.imageUrl} alt={a.name} className="w-full h-36 object-cover rounded-lg mb-3" />
                    : <div className="w-full h-36 bg-gray-100 rounded-lg mb-3 flex items-center justify-center text-gray-300 text-3xl">📦</div>
                  }
                  <p className="font-medium text-sm truncate">{a.name}</p>
                  <p className="text-xs text-gray-500 mb-2">{a.category}</p>
                  <div className="flex items-center justify-between">
                    <Badge label={a.status} />
                    <span className="text-xs text-gray-500">{a.availableQuantity} / {a.totalQuantity}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
          {assets.length === 0 && <p className="text-center text-gray-400 py-12">No assets found.</p>}
          <Pagination page={pagination.page} pages={pagination.pages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
