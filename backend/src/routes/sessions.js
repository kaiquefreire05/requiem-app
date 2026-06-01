const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// All session routes require auth
router.use(authMiddleware);

// GET /api/sessions — list user sessions
router.get('/', async (req, res) => {
  try {
    const sessions = await prisma.chatSession.findMany({
      where: { userId: req.userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        compositionData: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, createdAt: true },
        },
      },
    });
    res.json({ sessions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar sessões' });
  }
});

// POST /api/sessions — create session
router.post('/', async (req, res) => {
  const { title } = req.body;
  try {
    const session = await prisma.chatSession.create({
      data: {
        title: title || 'Nova Composição',
        userId: req.userId,
      },
    });
    res.status(201).json({ session });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar sessão' });
  }
});

// GET /api/sessions/:id — get session with messages
router.get('/:id', async (req, res) => {
  try {
    const session = await prisma.chatSession.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!session) return res.status(404).json({ error: 'Sessão não encontrada' });
    res.json({ session });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar sessão' });
  }
});

// PATCH /api/sessions/:id — rename session or save composition data
router.patch('/:id', async (req, res) => {
  const { title, compositionData } = req.body;
  try {
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (compositionData !== undefined) updateData.compositionData = compositionData;
    updateData.updatedAt = new Date();

    const session = await prisma.chatSession.updateMany({
      where: { id: req.params.id, userId: req.userId },
      data: updateData,
    });
    if (session.count === 0) return res.status(404).json({ error: 'Sessão não encontrada' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar sessão' });
  }
});

// DELETE /api/sessions/:id — delete session
router.delete('/:id', async (req, res) => {
  try {
    await prisma.chatSession.deleteMany({
      where: { id: req.params.id, userId: req.userId },
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao deletar sessão' });
  }
});

// POST /api/sessions/:id/messages — add message
router.post('/:id/messages', async (req, res) => {
  const { role, content } = req.body;
  if (!role || !content) {
    return res.status(400).json({ error: 'Role e content são obrigatórios' });
  }
  try {
    // Verify ownership
    const session = await prisma.chatSession.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!session) return res.status(404).json({ error: 'Sessão não encontrada' });

    const message = await prisma.message.create({
      data: { role, content, sessionId: req.params.id },
    });

    // Update session updatedAt
    await prisma.chatSession.update({
      where: { id: req.params.id },
      data: { updatedAt: new Date() },
    });

    res.status(201).json({ message });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao adicionar mensagem' });
  }
});

module.exports = router;
