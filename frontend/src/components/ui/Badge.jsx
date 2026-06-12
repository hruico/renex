const colors = {
  pending:    'bg-yellow-100 text-yellow-800',
  approved:   'bg-blue-100 text-blue-800',
  issued:     'bg-purple-100 text-purple-800',
  returned:   'bg-green-100 text-green-800',
  rejected:   'bg-red-100 text-red-800',
  overdue:    'bg-red-200 text-red-900',
  available:  'bg-green-100 text-green-800',
  low_stock:  'bg-yellow-100 text-yellow-800',
  unavailable:'bg-gray-100 text-gray-600',
  admin:      'bg-indigo-100 text-indigo-800',
  user:       'bg-gray-100 text-gray-700',
};

export default function Badge({ label }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[label] || 'bg-gray-100 text-gray-700'}`}>
      {label?.replace('_', ' ')}
    </span>
  );
}
