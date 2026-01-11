'use client';

import { useState } from 'react';
import { FileText, Check, X, Loader2, Edit2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface PaymentNoteEditorProps {
  note?: string | null;
  onSave: (note: string | null) => Promise<void>;
  disabled?: boolean;
}

export function PaymentNoteEditor({ note, onSave, disabled }: PaymentNoteEditorProps) {
  const t = useTranslations('paymentLabels');
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(note || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(value.trim() || null);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setValue(note || '');
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="space-y-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t('addNote')}
          className="glass-input w-full px-3 py-2 text-sm h-20 resize-none"
          autoFocus
          disabled={saving}
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={handleCancel}
            disabled={saving}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <Check className="h-4 w-4 text-primary" />
            )}
          </button>
        </div>
      </div>
    );
  }

  if (note) {
    return (
      <div
        onClick={() => !disabled && setEditing(true)}
        className="flex items-start gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] cursor-pointer hover:bg-white/[0.04] transition-colors group"
      >
        <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-sm flex-1">{note}</p>
        <Edit2 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      disabled={disabled}
      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <FileText className="h-4 w-4" />
      {t('addNote')}
    </button>
  );
}
