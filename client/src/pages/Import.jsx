import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';

const SAMPLE = 'Full Name,Company,Email,Phone,Deal Value,Lead Source,Tags\nEmma Patel,Summit Physio,emma@summit.example,+1 555 210 3344,4500,LinkedIn,seo;website\n';

export default function Import() {
  const qc = useQueryClient();
  const [file, setFile] = useState(null);
  const run = useMutation({
    mutationFn: () => { const form = new FormData(); form.append('file', file); return api('/leads/import', { method: 'POST', form }); },
    onSuccess: () => ['leads', 'pipeline', 'stats'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div><h1 className="text-2xl font-extrabold tracking-tight">Import leads</h1><p className="text-sm text-ink-500">Upload a CSV from a spreadsheet, another CRM or a lead list. Up to 2,000 rows.</p></div>
      <div className="card space-y-4 p-6">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-ink-200 px-6 py-10 text-center hover:border-brand-500">
          <FileSpreadsheet className="text-brand-600" />
          <span className="font-semibold">{file ? file.name : 'Choose a CSV file'}</span>
          <span className="text-sm text-ink-500">Columns are matched automatically: name, company, email, phone, value, source, stage, tags, notes.</span>
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { setFile(e.target.files[0]); run.reset(); }} />
        </label>
        <div className="flex items-center gap-3">
          <button className="btn btn-primary" disabled={!file || run.isPending} onClick={() => run.mutate()}><Upload size={15} />{run.isPending ? 'Importing…' : 'Import leads'}</button>
          <a className="text-sm font-semibold text-brand-700 hover:underline" href={`data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE)}`} download="leadflow-sample.csv">Download a sample CSV</a>
        </div>
        {run.isError && <p className="text-sm text-rose-600">{run.error.message}</p>}
        {run.data && (
          <div className="rounded-lg bg-ink-50 p-4 text-sm">
            <p className="font-semibold text-emerald-700">Imported {run.data.imported} lead{run.data.imported === 1 ? '' : 's'}. <Link to="/leads" className="underline">View leads</Link></p>
            {run.data.skipped.length > 0 && (
              <>
                <p className="mt-2 font-semibold">Skipped {run.data.skipped.length} row{run.data.skipped.length === 1 ? '' : 's'}:</p>
                <ul className="mt-1 list-disc pl-5 text-ink-500">{run.data.skipped.slice(0, 20).map((s) => <li key={s.row}>Row {s.row}: {s.reason}</li>)}</ul>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
