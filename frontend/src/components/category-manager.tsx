'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, Palette, Tag } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  type PaymentCategory,
} from '@/lib/api';
import { cn } from '@/lib/utils';

interface CategoryManagerProps {
  open: boolean;
  onClose: () => void;
  onCategorySelect?: (category: PaymentCategory) => void;
  selectedCategoryId?: string | null;
}

const PRESET_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
];

export function CategoryManager({
  open,
  onClose,
  onCategorySelect,
  selectedCategoryId,
}: CategoryManagerProps) {
  const t = useTranslations('categories');
  const tc = useTranslations('common');
  const { toast } = useToast();

  const [categories, setCategories] = useState<PaymentCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PaymentCategory | null>(null);

  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);

  useEffect(() => {
    if (open) {
      fetchCategories();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Failed to load categories:', error);
      toast({
        variant: 'destructive',
        title: tc('error'),
        description: 'Failed to load categories',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, { name, color });
        toast({ title: tc('success'), description: 'Category updated' });
      } else {
        await createCategory({ name, color });
        toast({ title: tc('success'), description: 'Category created' });
      }
      await fetchCategories();
      resetForm();
    } catch (error) {
      console.error('Failed to save category:', error);
      toast({
        variant: 'destructive',
        title: tc('error'),
        description: String(error),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
      await deleteCategory(id);
      toast({ title: tc('success'), description: 'Category deleted' });
      await fetchCategories();
    } catch (error) {
      console.error('Failed to delete category:', error);
      toast({
        variant: 'destructive',
        title: tc('error'),
        description: String(error),
      });
    }
  };

  const resetForm = () => {
    setName('');
    setColor(PRESET_COLORS[0]);
    setShowForm(false);
    setEditingCategory(null);
  };

  const startEdit = (category: PaymentCategory) => {
    setEditingCategory(category);
    setName(category.name);
    setColor(category.color);
    setShowForm(true);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            {t('manageCategories')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Add/Edit Form */}
          {showForm ? (
            <form onSubmit={handleSubmit} className="space-y-4 p-4 glass-card rounded-xl">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t('name')} *
                </label>
                <input
                  type="text"
                  placeholder="e.g., Coffee, Services, Donations"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="glass-input w-full px-4 py-2.5"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t('color')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={cn(
                        'w-8 h-8 rounded-full transition-all',
                        color === c && 'ring-2 ring-white ring-offset-2 ring-offset-background'
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-sm font-medium"
                >
                  {tc('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving || !name.trim()}
                  className="flex-1 btn-gradient flex items-center justify-center gap-2 !py-2"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : tc('save')}
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-white/20 text-muted-foreground hover:text-foreground hover:border-white/40 transition-colors"
            >
              <Plus className="h-4 w-4" />
              {t('addCategory')}
            </button>
          )}

          {/* Category List */}
          <div className="space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : categories.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">{t('noCategories')}</p>
            ) : (
              categories.map((category) => (
                <div
                  key={category.id}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl transition-colors',
                    selectedCategoryId === category.id
                      ? 'bg-primary/10 border border-primary'
                      : 'glass-card hover:bg-white/5',
                    onCategorySelect && 'cursor-pointer'
                  )}
                  onClick={() => onCategorySelect?.(category)}
                >
                  <div
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ backgroundColor: category.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{category.name}</p>
                    {category._count && (
                      <p className="text-xs text-muted-foreground">
                        {category._count.payments} payments
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(category);
                      }}
                      className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <Palette className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(category.id);
                      }}
                      className="p-2 rounded-lg hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
