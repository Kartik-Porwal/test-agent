const express = require('express');
const router  = express.Router();
const Conversation = require('../models/conversation');

// Live dashboard snapshot stream. Poll the persisted conversation records so
// dashboard values reflect backend state rather than browser-side simulation.
router.get('/stream', async (req, res) => {
  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders?.();
  res.write('retry: 2000\n\n');

  let closed = false;
  let polling = false;
  const sendSnapshot = async () => {
    if (closed || polling) return;
    polling = true;
    try {
      const records = await Conversation.find().sort({ startTime: -1 }).lean();
      const conversations = records.map(conversation => ({
        id: conversation.id,
        customer: conversation.customer,
        agent: conversation.agent,
        status: conversation.status,
        alertLevel: conversation.alertLevel,
        startTime: conversation.startTime,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        metrics: conversation.metrics,
        tags: conversation.tags,
        queue: conversation.queue,
        region: conversation.region,
        messageCount: conversation.messages?.length || 0
      }));
      const regions = {};
      conversations.forEach(conversation => {
        const region = conversation.region || conversation.customer?.region || 'Unassigned';
        if (!regions[region]) regions[region] = { activeCount: 0, slaCount: 0, total: 0, messageCount: 0 };
        regions[region].total += 1;
        regions[region].messageCount += conversation.messageCount;
        if (['active', 'waiting'].includes(conversation.status)) regions[region].activeCount += 1;
        if (conversation.status !== 'resolved' && conversation.alertLevel === 'high') regions[region].slaCount += 1;
      });
      const snapshot = {
        timestamp: Date.now(),
        conversations,
        activeCount: conversations.filter(c => ['active', 'waiting'].includes(c.status)).length,
        slaCount: conversations.filter(c => c.status !== 'resolved' && c.alertLevel === 'high').length,
        messageCount: conversations.reduce((sum, c) => sum + c.messageCount, 0),
        regions
      };
      if (!closed) res.write(`event: dashboard\ndata: ${JSON.stringify(snapshot)}\n\n`);
    } catch (error) {
      if (!closed) res.write(`event: dashboard_error\ndata: ${JSON.stringify({ message: 'Unable to read live dashboard data' })}\n\n`);
    } finally {
      polling = false;
    }
  };

  sendSnapshot();
  const interval = setInterval(sendSnapshot, 2000);
  req.on('close', () => {
    closed = true;
    clearInterval(interval);
  });
});

// Simple placeholder – return empty metrics structure
router.get('/', (_req, res) => {
  res.json({ conversations: [], agents: [], daily: [] });
});

module.exports = router;
