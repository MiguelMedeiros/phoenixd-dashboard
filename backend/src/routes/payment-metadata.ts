import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

export const paymentMetadataRouter = Router();

// Get metadata for a payment by hash or ID
paymentMetadataRouter.get(
  '/:identifier',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { identifier } = req.params;

      const metadata = await prisma.paymentMetadata.findFirst({
        where: {
          OR: [{ paymentHash: identifier }, { paymentId: identifier }],
        },
        include: {
          contact: true,
          categories: true,
        },
      });

      if (!metadata) {
        return res.status(404).json({ error: 'Payment metadata not found' });
      }

      res.json(metadata);
    } catch (error) {
      console.error('Error getting payment metadata:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

// Create or update payment metadata
paymentMetadataRouter.put(
  '/:identifier',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { identifier } = req.params;
      const { note, categoryIds, contactId, isIncoming } = req.body;

      // Determine if this is a paymentHash (incoming) or paymentId (outgoing)
      const isIncomingPayment = isIncoming !== undefined ? isIncoming : identifier.length === 64;

      // Check if metadata already exists
      const existing = await prisma.paymentMetadata.findFirst({
        where: {
          OR: [{ paymentHash: identifier }, { paymentId: identifier }],
        },
        include: {
          categories: true,
        },
      });

      let metadata;
      if (existing) {
        // Build update data
        const updateData: {
          note?: string | null;
          contactId?: string | null;
          categories?: { set: { id: string }[] };
        } = {};

        if (note !== undefined) {
          updateData.note = note || null;
        }
        if (contactId !== undefined) {
          updateData.contactId = contactId || null;
        }
        if (categoryIds !== undefined) {
          // Set the categories relation (replace all)
          updateData.categories = {
            set: categoryIds.map((id: string) => ({ id })),
          };
        }

        // Update existing metadata
        metadata = await prisma.paymentMetadata.update({
          where: { id: existing.id },
          data: updateData,
          include: {
            contact: true,
            categories: true,
          },
        });
      } else {
        // Create new metadata
        metadata = await prisma.paymentMetadata.create({
          data: {
            paymentHash: isIncomingPayment ? identifier : null,
            paymentId: !isIncomingPayment ? identifier : null,
            note: note || null,
            contactId: contactId || null,
            ...(categoryIds &&
              categoryIds.length > 0 && {
                categories: {
                  connect: categoryIds.map((id: string) => ({ id })),
                },
              }),
          },
          include: {
            contact: true,
            categories: true,
          },
        });
      }

      res.json(metadata);
    } catch (error) {
      console.error('Error updating payment metadata:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

// Get payments by category
paymentMetadataRouter.get(
  '/by-category/:categoryId',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { categoryId } = req.params;
      const { limit, offset } = req.query;

      // Check if category exists
      const category = await prisma.paymentCategory.findUnique({ where: { id: categoryId } });
      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }

      const payments = await prisma.paymentMetadata.findMany({
        where: {
          categories: {
            some: { id: categoryId },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit ? parseInt(limit as string) : 50,
        skip: offset ? parseInt(offset as string) : 0,
        include: {
          contact: true,
          categories: true,
        },
      });

      res.json(payments);
    } catch (error) {
      console.error('Error getting payments by category:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

// Get payments by contact
paymentMetadataRouter.get(
  '/by-contact/:contactId',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { contactId } = req.params;
      const { limit, offset } = req.query;

      // Check if contact exists
      const contact = await prisma.contact.findUnique({ where: { id: contactId } });
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      const payments = await prisma.paymentMetadata.findMany({
        where: { contactId },
        orderBy: { createdAt: 'desc' },
        take: limit ? parseInt(limit as string) : 50,
        skip: offset ? parseInt(offset as string) : 0,
        include: {
          contact: true,
          categories: true,
        },
      });

      res.json(payments);
    } catch (error) {
      console.error('Error getting payments by contact:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

// Batch get metadata for multiple payments
paymentMetadataRouter.post(
  '/batch',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { paymentHashes, paymentIds } = req.body;

      if (!paymentHashes && !paymentIds) {
        return res.status(400).json({ error: 'paymentHashes or paymentIds required' });
      }

      const conditions = [];
      if (paymentHashes && paymentHashes.length > 0) {
        conditions.push({ paymentHash: { in: paymentHashes } });
      }
      if (paymentIds && paymentIds.length > 0) {
        conditions.push({ paymentId: { in: paymentIds } });
      }

      const metadata = await prisma.paymentMetadata.findMany({
        where: {
          OR: conditions,
        },
        include: {
          contact: true,
          categories: true,
        },
      });

      // Create a map for easy lookup
      const metadataMap: Record<string, (typeof metadata)[0]> = {};
      metadata.forEach((m) => {
        if (m.paymentHash) metadataMap[m.paymentHash] = m;
        if (m.paymentId) metadataMap[m.paymentId] = m;
      });

      res.json(metadataMap);
    } catch (error) {
      console.error('Error batch getting payment metadata:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);
