import Button from './Button';

export default function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center gap-2 justify-end mt-4">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>Prev</Button>
      <span className="text-sm text-gray-600">Page {page} of {pages}</span>
      <Button variant="secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</Button>
    </div>
  );
}
