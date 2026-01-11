import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

export const categoriesRouter = Router();

// List all categories
categoriesRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const categories = await prisma.paymentCategory.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { payments: true },
        },
      },
    });

    res.json(categories);
  } catch (error) {
    console.error('Error listing categories:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get category by ID
categoriesRouter.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const category = await prisma.paymentCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { payments: true },
        },
      },
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(category);
  } catch (error) {
    console.error('Error getting category:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create new category
categoriesRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, color, icon } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Check for duplicate name
    const existing = await prisma.paymentCategory.findUnique({ where: { name } });
    if (existing) {
      return res.status(400).json({ error: 'Category with this name already exists' });
    }

    const category = await prisma.paymentCategory.create({
      data: {
        name,
        color: color || '#6366f1',
        icon: icon || null,
      },
    });

    res.status(201).json(category);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update category
categoriesRouter.put('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, color, icon } = req.body;

    // Check if category exists
    const existing = await prisma.paymentCategory.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Check for duplicate name if name is being changed
    if (name && name !== existing.name) {
      const duplicate = await prisma.paymentCategory.findUnique({ where: { name } });
      if (duplicate) {
        return res.status(400).json({ error: 'Category with this name already exists' });
      }
    }

    const category = await prisma.paymentCategory.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(color && { color }),
        ...(icon !== undefined && { icon: icon || null }),
      },
    });

    res.json(category);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete category
categoriesRouter.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if category exists
    const existing = await prisma.paymentCategory.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Disconnect this category from all payment metadata first
    await prisma.paymentCategory.update({
      where: { id },
      data: {
        payments: {
          set: [], // Disconnect all payments
        },
      },
    });

    await prisma.paymentCategory.delete({ where: { id } });

    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});
