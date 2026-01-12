import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

export const contactsRouter = Router();

const validAddressTypes = ['lightning_address', 'node_id', 'bolt12_offer'];

// List all contacts with their addresses
contactsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search } = req.query;

    // Build search filter (case-insensitive search works in PostgreSQL, for SQLite we use contains)
    const searchFilter = search
      ? {
          OR: [
            { name: { contains: search as string } },
            { label: { contains: search as string } },
            {
              addresses: {
                some: {
                  address: { contains: search as string },
                },
              },
            },
          ],
        }
      : undefined;

    const contacts = await prisma.contact.findMany({
      where: searchFilter,
      orderBy: { name: 'asc' },
      include: {
        addresses: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
        _count: {
          select: { payments: true },
        },
      },
    });

    res.json(contacts);
  } catch (error) {
    console.error('Error listing contacts:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get contact by ID
contactsRouter.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const contact = await prisma.contact.findUnique({
      where: { id },
      include: {
        addresses: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
        _count: {
          select: { payments: true },
        },
      },
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json(contact);
  } catch (error) {
    console.error('Error getting contact:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Create new contact with addresses
contactsRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, label, avatarUrl, addresses } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return res.status(400).json({ error: 'At least one address is required' });
    }

    // Validate addresses
    for (const addr of addresses) {
      if (!addr.address || !addr.type) {
        return res.status(400).json({ error: 'Each address must have address and type' });
      }
      if (!validAddressTypes.includes(addr.type)) {
        return res.status(400).json({ error: `Invalid address type: ${addr.type}` });
      }
    }

    // Ensure only one primary address
    const primaryCount = addresses.filter((a: { isPrimary?: boolean }) => a.isPrimary).length;
    if (primaryCount > 1) {
      return res.status(400).json({ error: 'Only one address can be primary' });
    }

    // If no primary is set, make the first one primary
    const addressesData = addresses.map(
      (
        addr: { address: string; type: string; label?: string; isPrimary?: boolean },
        index: number
      ) => ({
        address: addr.address,
        type: addr.type,
        isPrimary: addr.isPrimary || (primaryCount === 0 && index === 0),
      })
    );

    const contact = await prisma.contact.create({
      data: {
        name,
        label: label || null,
        avatarUrl: avatarUrl || null,
        addresses: {
          create: addressesData,
        },
      },
      include: {
        addresses: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
        _count: {
          select: { payments: true },
        },
      },
    });

    res.status(201).json(contact);
  } catch (error) {
    console.error('Error creating contact:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update contact (name, label, avatar, and optionally addresses)
contactsRouter.put('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, label, avatarUrl, addresses } = req.body;

    // Check if contact exists
    const existing = await prisma.contact.findUnique({
      where: { id },
      include: { addresses: true },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // If addresses are provided, validate and update intelligently
    if (addresses && Array.isArray(addresses)) {
      if (addresses.length === 0) {
        return res.status(400).json({ error: 'At least one address is required' });
      }

      // Validate addresses
      for (const addr of addresses) {
        if (!addr.address || !addr.type) {
          return res.status(400).json({ error: 'Each address must have address and type' });
        }
        if (!validAddressTypes.includes(addr.type)) {
          return res.status(400).json({ error: `Invalid address type: ${addr.type}` });
        }
      }

      // Ensure only one primary address
      const primaryCount = addresses.filter((a: { isPrimary?: boolean }) => a.isPrimary).length;
      if (primaryCount > 1) {
        return res.status(400).json({ error: 'Only one address can be primary' });
      }

      // Get existing address IDs
      const existingIds = existing.addresses.map((a) => a.id);
      const incomingIds = addresses
        .filter((a: { id?: string }) => a.id)
        .map((a: { id?: string }) => a.id);

      // Find addresses to delete (existing but not in incoming)
      const idsToDelete = existingIds.filter((eid) => !incomingIds.includes(eid));

      // If deleting addresses, check for recurring payments using them
      if (idsToDelete.length > 0) {
        const recurringPayments = await prisma.recurringPayment.findMany({
          where: {
            addressId: { in: idsToDelete },
            status: 'active',
          },
        });

        // Get the first remaining address to reassign
        const remainingAddress = addresses.find(
          (a: { id?: string }) => !a.id || !idsToDelete.includes(a.id)
        );
        const firstExistingRemaining = existing.addresses.find((a) => !idsToDelete.includes(a.id));

        for (const rp of recurringPayments) {
          // Try to find a similar address type, or use the first remaining
          const sameTypeAddr = addresses.find(
            (a: { type: string; id?: string }) =>
              a.type === existing.addresses.find((ea) => ea.id === rp.addressId)?.type &&
              (!a.id || !idsToDelete.includes(a.id))
          );

          const newAddressId =
            sameTypeAddr?.id || firstExistingRemaining?.id || remainingAddress?.id;

          if (newAddressId) {
            await prisma.recurringPayment.update({
              where: { id: rp.id },
              data: { addressId: newAddressId, lastError: null },
            });
            console.log(
              `[Contacts] Updated recurring payment ${rp.id} to use address ${newAddressId}`
            );
          }
        }

        // Delete addresses that are no longer needed
        await prisma.contactAddress.deleteMany({
          where: { id: { in: idsToDelete } },
        });
      }

      // Update existing addresses and create new ones
      for (let index = 0; index < addresses.length; index++) {
        const addr = addresses[index] as {
          id?: string;
          address: string;
          type: string;
          isPrimary?: boolean;
        };
        const isPrimary = addr.isPrimary || (primaryCount === 0 && index === 0);

        if (addr.id && existingIds.includes(addr.id)) {
          // Update existing address
          await prisma.contactAddress.update({
            where: { id: addr.id },
            data: {
              address: addr.address,
              type: addr.type,
              isPrimary,
            },
          });
        } else {
          // Create new address
          await prisma.contactAddress.create({
            data: {
              contactId: id,
              address: addr.address,
              type: addr.type,
              isPrimary,
            },
          });
        }
      }
    }

    const contact = await prisma.contact.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(label !== undefined && { label: label || null }),
        ...(avatarUrl !== undefined && { avatarUrl: avatarUrl || null }),
      },
      include: {
        addresses: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
        _count: {
          select: { payments: true },
        },
      },
    });

    res.json(contact);
  } catch (error) {
    console.error('Error updating contact:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete contact (cascade deletes addresses)
contactsRouter.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if contact exists
    const existing = await prisma.contact.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Remove contact references from payment metadata first
    await prisma.paymentMetadata.updateMany({
      where: { contactId: id },
      data: { contactId: null },
    });

    // Delete contact (addresses are cascade deleted)
    await prisma.contact.delete({ where: { id } });

    res.json({ success: true, message: 'Contact deleted' });
  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Add address to contact
contactsRouter.post(
  '/:id/addresses',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { address, type, isPrimary } = req.body;

      // Check if contact exists
      const contact = await prisma.contact.findUnique({
        where: { id },
        include: { addresses: true },
      });
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      if (!address || !type) {
        return res.status(400).json({ error: 'Address and type are required' });
      }

      if (!validAddressTypes.includes(type)) {
        return res.status(400).json({ error: `Invalid address type: ${type}` });
      }

      // If this is set as primary, unset other primaries
      if (isPrimary) {
        await prisma.contactAddress.updateMany({
          where: { contactId: id },
          data: { isPrimary: false },
        });
      }

      const newAddress = await prisma.contactAddress.create({
        data: {
          contactId: id,
          address,
          type,
          isPrimary: isPrimary || contact.addresses.length === 0,
        },
      });

      res.status(201).json(newAddress);
    } catch (error) {
      console.error('Error adding address:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

// Update address
contactsRouter.put(
  '/:id/addresses/:addressId',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id, addressId } = req.params;
      const { address, type, isPrimary } = req.body;

      // Check if address exists and belongs to this contact
      const existing = await prisma.contactAddress.findFirst({
        where: { id: addressId, contactId: id },
      });
      if (!existing) {
        return res.status(404).json({ error: 'Address not found' });
      }

      if (type && !validAddressTypes.includes(type)) {
        return res.status(400).json({ error: `Invalid address type: ${type}` });
      }

      // If setting as primary, unset other primaries
      if (isPrimary) {
        await prisma.contactAddress.updateMany({
          where: { contactId: id, id: { not: addressId } },
          data: { isPrimary: false },
        });
      }

      const updatedAddress = await prisma.contactAddress.update({
        where: { id: addressId },
        data: {
          ...(address !== undefined && { address }),
          ...(type !== undefined && { type }),
          ...(isPrimary !== undefined && { isPrimary }),
        },
      });

      res.json(updatedAddress);
    } catch (error) {
      console.error('Error updating address:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

// Delete address
contactsRouter.delete(
  '/:id/addresses/:addressId',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id, addressId } = req.params;

      // Check if address exists and belongs to this contact
      const existing = await prisma.contactAddress.findFirst({
        where: { id: addressId, contactId: id },
      });
      if (!existing) {
        return res.status(404).json({ error: 'Address not found' });
      }

      // Count remaining addresses
      const addressCount = await prisma.contactAddress.count({
        where: { contactId: id },
      });

      if (addressCount <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last address' });
      }

      await prisma.contactAddress.delete({ where: { id: addressId } });

      // If deleted address was primary, make the first remaining one primary
      if (existing.isPrimary) {
        const firstRemaining = await prisma.contactAddress.findFirst({
          where: { contactId: id },
          orderBy: { createdAt: 'asc' },
        });
        if (firstRemaining) {
          await prisma.contactAddress.update({
            where: { id: firstRemaining.id },
            data: { isPrimary: true },
          });
        }
      }

      res.json({ success: true, message: 'Address deleted' });
    } catch (error) {
      console.error('Error deleting address:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

// Get payment history for contact
contactsRouter.get(
  '/:id/payments',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { limit, offset } = req.query;

      // Check if contact exists
      const contact = await prisma.contact.findUnique({ where: { id } });
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      const payments = await prisma.paymentMetadata.findMany({
        where: { contactId: id },
        orderBy: { createdAt: 'desc' },
        take: limit ? parseInt(limit as string) : 50,
        skip: offset ? parseInt(offset as string) : 0,
      include: {
        categories: {
          include: {
            category: true,
          },
        },
      },
      });

      res.json(payments);
    } catch (error) {
      console.error('Error getting contact payments:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);
