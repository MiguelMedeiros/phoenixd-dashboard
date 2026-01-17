import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

export const recurringPaymentsRouter = Router();

type RecurringPaymentFrequency =
  | 'every_minute'
  | 'every_5_minutes'
  | 'every_15_minutes'
  | 'every_30_minutes'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly';

// Calculate next run date based on frequency
function calculateNextRunAt(
  frequency: RecurringPaymentFrequency,
  timeOfDay: string,
  dayOfWeek?: number | null,
  dayOfMonth?: number | null,
  fromDate?: Date
): Date {
  const now = fromDate || new Date();
  const [hours, minutes] = timeOfDay.split(':').map(Number);

  const next = new Date(now);

  switch (frequency) {
    case 'every_minute':
      // Add 1 minute from now
      next.setTime(now.getTime() + 60 * 1000);
      break;

    case 'every_5_minutes':
      // Add 5 minutes from now
      next.setTime(now.getTime() + 5 * 60 * 1000);
      break;

    case 'every_15_minutes':
      // Add 15 minutes from now
      next.setTime(now.getTime() + 15 * 60 * 1000);
      break;

    case 'every_30_minutes':
      // Add 30 minutes from now
      next.setTime(now.getTime() + 30 * 60 * 1000);
      break;

    case 'hourly':
      // Add 1 hour from now
      next.setTime(now.getTime() + 60 * 60 * 1000);
      break;

    case 'daily':
      next.setUTCHours(hours, minutes, 0, 0);
      // If today's time has passed, schedule for tomorrow
      if (next <= now) {
        next.setUTCDate(next.getUTCDate() + 1);
      }
      break;

    case 'weekly': {
      next.setUTCHours(hours, minutes, 0, 0);
      // Find next occurrence of the specified day
      const targetDay = dayOfWeek ?? 1; // Default to Monday
      const currentDay = next.getUTCDay();
      let daysUntilTarget = (targetDay - currentDay + 7) % 7;

      // If it's the same day but time passed, go to next week
      if (daysUntilTarget === 0 && next <= now) {
        daysUntilTarget = 7;
      }

      next.setUTCDate(next.getUTCDate() + daysUntilTarget);
      break;
    }

    case 'monthly': {
      next.setUTCHours(hours, minutes, 0, 0);
      // Set to the specified day of month
      const targetDayOfMonth = dayOfMonth ?? 1;
      next.setUTCDate(targetDayOfMonth);

      // If this month's date has passed, go to next month
      if (next <= now) {
        next.setUTCMonth(next.getUTCMonth() + 1);
        next.setUTCDate(targetDayOfMonth);
      }

      // Handle edge cases like Feb 30 -> Feb 28
      const lastDayOfMonth = new Date(
        next.getUTCFullYear(),
        next.getUTCMonth() + 1,
        0
      ).getUTCDate();
      if (targetDayOfMonth > lastDayOfMonth) {
        next.setUTCDate(lastDayOfMonth);
      }
      break;
    }
  }

  return next;
}

// List all recurring payments (filtered by active connection)
recurringPaymentsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, contactId, showAll } = req.query;

    // Get active connection
    const activeConnection = await prisma.phoenixdConnection.findFirst({
      where: { isActive: true },
    });

    const where: {
      status?: string;
      contactId?: string;
      connectionId?: string | null;
    } = {};

    if (status && typeof status === 'string') {
      where.status = status;
    }

    if (contactId && typeof contactId === 'string') {
      where.contactId = contactId;
    }

    // Only filter by connection if not requesting all
    // Also include payments without connectionId (legacy/migrated payments)
    if (showAll !== 'true' && activeConnection) {
      // Show payments for active connection OR payments without a connection (legacy)
    }

    const recurringPayments = await prisma.recurringPayment.findMany({
      where: showAll === 'true' ? where : {
        ...where,
        OR: [
          { connectionId: activeConnection?.id },
          { connectionId: null }, // Legacy payments without connection
        ],
      },
      include: {
        contact: {
          include: {
            addresses: true,
          },
        },
        category: true,
        connection: {
          select: {
            id: true,
            name: true,
            isDocker: true,
          },
        },
        _count: {
          select: { executions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(recurringPayments);
  } catch (error) {
    console.error('Error listing recurring payments:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get single recurring payment
recurringPaymentsRouter.get(
  '/:id',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const recurringPayment = await prisma.recurringPayment.findUnique({
        where: { id },
        include: {
          contact: {
            include: {
              addresses: true,
            },
          },
          category: true,
          connection: {
            select: {
              id: true,
              name: true,
              isDocker: true,
            },
          },
          executions: {
            orderBy: { executedAt: 'desc' },
            take: 20,
          },
        },
      });

      if (!recurringPayment) {
        return res.status(404).json({ error: 'Recurring payment not found' });
      }

      res.json(recurringPayment);
    } catch (error) {
      console.error('Error getting recurring payment:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

// Create new recurring payment
recurringPaymentsRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      contactId,
      addressId,
      amountSat,
      frequency,
      dayOfWeek,
      dayOfMonth,
      timeOfDay,
      note,
      categoryId,
    } = req.body;

    // Validate required fields
    if (!contactId) {
      return res.status(400).json({ error: 'Contact ID is required' });
    }

    if (!addressId) {
      return res.status(400).json({ error: 'Address ID is required' });
    }

    if (!amountSat || amountSat <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    const validFrequencies = [
      'every_minute',
      'every_5_minutes',
      'every_15_minutes',
      'every_30_minutes',
      'hourly',
      'daily',
      'weekly',
      'monthly',
    ];
    if (!frequency || !validFrequencies.includes(frequency)) {
      return res.status(400).json({ error: 'Invalid frequency' });
    }

    // Validate contact exists
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: { addresses: true },
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Validate address belongs to contact
    const address = contact.addresses.find((a) => a.id === addressId);
    if (!address) {
      return res.status(400).json({ error: 'Address does not belong to contact' });
    }

    // Validate address type is payable (lightning_address or bolt12_offer)
    if (!['lightning_address', 'bolt12_offer'].includes(address.type)) {
      return res.status(400).json({
        error: 'Only Lightning Address or BOLT12 Offer can be used for recurring payments',
      });
    }

    // Validate category if provided
    if (categoryId) {
      const category = await prisma.paymentCategory.findUnique({
        where: { id: categoryId },
      });
      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }
    }

    // Get active connection to tie this payment to
    const activeConnection = await prisma.phoenixdConnection.findFirst({
      where: { isActive: true },
    });

    // Calculate next run date
    const time = timeOfDay || '09:00';
    const nextRunAt = calculateNextRunAt(
      frequency as RecurringPaymentFrequency,
      time,
      dayOfWeek,
      dayOfMonth
    );

    const recurringPayment = await prisma.recurringPayment.create({
      data: {
        contactId,
        addressId,
        connectionId: activeConnection?.id || null, // Tie to active connection
        amountSat,
        frequency,
        dayOfWeek: frequency === 'weekly' ? (dayOfWeek ?? 1) : null,
        dayOfMonth: frequency === 'monthly' ? (dayOfMonth ?? 1) : null,
        timeOfDay: time,
        note: note || null,
        categoryId: categoryId || null,
        nextRunAt,
        status: 'active',
      },
      include: {
        contact: {
          include: {
            addresses: true,
          },
        },
        category: true,
        connection: {
          select: {
            id: true,
            name: true,
            isDocker: true,
          },
        },
      },
    });

    res.status(201).json(recurringPayment);
  } catch (error) {
    console.error('Error creating recurring payment:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update recurring payment
recurringPaymentsRouter.put(
  '/:id',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const {
        addressId,
        amountSat,
        frequency,
        dayOfWeek,
        dayOfMonth,
        timeOfDay,
        note,
        categoryId,
        status,
      } = req.body;

      // Find existing payment with contact
      const existing = await prisma.recurringPayment.findUnique({
        where: { id },
        include: {
          contact: {
            include: {
              addresses: true,
            },
          },
        },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Recurring payment not found' });
      }

      // Build update data
      const updateData: {
        addressId?: string;
        amountSat?: number;
        frequency?: string;
        dayOfWeek?: number | null;
        dayOfMonth?: number | null;
        timeOfDay?: string;
        note?: string | null;
        categoryId?: string | null;
        status?: string;
        nextRunAt?: Date;
      } = {};

      // Validate and update addressId if provided
      if (addressId !== undefined && addressId !== existing.addressId) {
        const address = existing.contact.addresses.find((a) => a.id === addressId);
        if (!address) {
          return res.status(400).json({ error: 'Address does not belong to contact' });
        }
        if (!['lightning_address', 'bolt12_offer'].includes(address.type)) {
          return res.status(400).json({
            error: 'Only Lightning Address or BOLT12 Offer can be used for recurring payments',
          });
        }
        updateData.addressId = addressId;
      }

      if (amountSat !== undefined) {
        if (amountSat <= 0) {
          return res.status(400).json({ error: 'Amount must be greater than 0' });
        }
        updateData.amountSat = amountSat;
      }

      if (frequency !== undefined) {
        const validFrequencies = [
          'every_minute',
          'every_5_minutes',
          'every_15_minutes',
          'every_30_minutes',
          'hourly',
          'daily',
          'weekly',
          'monthly',
        ];
        if (!validFrequencies.includes(frequency)) {
          return res.status(400).json({ error: 'Invalid frequency' });
        }
        updateData.frequency = frequency;
      }

      if (dayOfWeek !== undefined) {
        updateData.dayOfWeek = dayOfWeek;
      }

      if (dayOfMonth !== undefined) {
        updateData.dayOfMonth = dayOfMonth;
      }

      if (timeOfDay !== undefined) {
        updateData.timeOfDay = timeOfDay;
      }

      if (note !== undefined) {
        updateData.note = note || null;
      }

      if (categoryId !== undefined) {
        if (categoryId) {
          const category = await prisma.paymentCategory.findUnique({
            where: { id: categoryId },
          });
          if (!category) {
            return res.status(404).json({ error: 'Category not found' });
          }
        }
        updateData.categoryId = categoryId || null;
      }

      if (status !== undefined) {
        if (!['active', 'paused', 'cancelled'].includes(status)) {
          return res.status(400).json({ error: 'Status must be active, paused, or cancelled' });
        }
        updateData.status = status;
      }

      // Recalculate next run date if schedule changed
      const newFrequency = frequency || existing.frequency;
      const newTimeOfDay = timeOfDay || existing.timeOfDay;
      const newDayOfWeek = dayOfWeek !== undefined ? dayOfWeek : existing.dayOfWeek;
      const newDayOfMonth = dayOfMonth !== undefined ? dayOfMonth : existing.dayOfMonth;

      if (
        frequency !== undefined ||
        timeOfDay !== undefined ||
        dayOfWeek !== undefined ||
        dayOfMonth !== undefined
      ) {
        updateData.nextRunAt = calculateNextRunAt(
          newFrequency as RecurringPaymentFrequency,
          newTimeOfDay,
          newDayOfWeek,
          newDayOfMonth
        );
      }

      const recurringPayment = await prisma.recurringPayment.update({
        where: { id },
        data: updateData,
        include: {
          contact: {
            include: {
              addresses: true,
            },
          },
          category: true,
          connection: {
            select: {
              id: true,
              name: true,
              isDocker: true,
            },
          },
        },
      });

      res.json(recurringPayment);
    } catch (error) {
      console.error('Error updating recurring payment:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

// Delete recurring payment
recurringPaymentsRouter.delete(
  '/:id',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const existing = await prisma.recurringPayment.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Recurring payment not found' });
      }

      await prisma.recurringPayment.delete({
        where: { id },
      });

      res.json({ success: true, message: 'Recurring payment deleted' });
    } catch (error) {
      console.error('Error deleting recurring payment:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

// Get executions for a recurring payment
recurringPaymentsRouter.get(
  '/:id/executions',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { limit, offset } = req.query;

      const executions = await prisma.recurringPaymentExecution.findMany({
        where: { recurringPaymentId: id },
        orderBy: { executedAt: 'desc' },
        take: limit ? parseInt(limit as string) : 50,
        skip: offset ? parseInt(offset as string) : 0,
      });

      res.json(executions);
    } catch (error) {
      console.error('Error listing executions:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

// Trigger immediate execution (manual run)
recurringPaymentsRouter.post(
  '/:id/execute',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const recurringPayment = await prisma.recurringPayment.findUnique({
        where: { id },
        include: {
          contact: {
            include: {
              addresses: true,
            },
          },
        },
      });

      if (!recurringPayment) {
        return res.status(404).json({ error: 'Recurring payment not found' });
      }

      // Import and use the scheduler's execute function
      const { executeRecurringPayment } = await import('../services/recurring-scheduler.js');
      const result = await executeRecurringPayment(recurringPayment);

      res.json(result);
    } catch (error) {
      console.error('Error executing recurring payment:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

export { calculateNextRunAt };
