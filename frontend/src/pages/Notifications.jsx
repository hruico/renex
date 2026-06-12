import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.get('/notifications?limit=50').then(({ data }) => {
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const markAll = async () => {
    await api.put('/notifications/read-all');
    load();
  };

  const markOne = async (id) => {
    await api.put(`/notifications/${id}/read`);
    load();
  };

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Notifications {unreadCount > 0 && <span className="ml-2 text-sm bg-blue-600 text-white px-2 py-0.5 rounded-full">{unreadCount}</span>}</h1>
        {unreadCount > 0 && <Button variant="ghost" onClick={markAll}>Mark all read</Button>}
      </div>

      {loading ? <Spinner /> : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div key={n._id} className={`bg-white rounded-xl border px-5 py-4 flex items-start justify-between gap-4 ${n.isRead ? 'border-gray-200' : 'border-blue-300 bg-blue-50'}`}>
              <div className="flex-1">
                <p className={`text-sm font-medium ${n.isRead ? 'text-gray-800' : 'text-blue-800'}`}>{n.title}</p>
                <p className="text-sm text-gray-600 mt-0.5">{n.message}</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                {n.relatedBooking && <Link to={`/bookings/${n.relatedBooking._id || n.relatedBooking}`} className="text-xs text-blue-600 hover:underline">View</Link>}
                {!n.isRead && <button onClick={() => markOne(n._id)} className="text-xs text-gray-400 hover:text-gray-600">✓</button>}
              </div>
            </div>
          ))}
          {notifications.length === 0 && <p className="text-center text-gray-400 py-12">No notifications.</p>}
        </div>
      )}
    </div>
  );
}
