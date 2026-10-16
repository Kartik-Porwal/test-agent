const express = require('express');
const { v4: uuidv4 } = require('uuid');
const ResponseTemplate = require('../models/responseTemplate');

const router = express.Router();

const starterTemplates = [
  { name: 'Welcome new visitor', description: 'Friendly greeting with clear next steps.', category: 'Onboarding', channel: 'Website', content: 'Thanks for visiting {{workspace}}. I can help you get started or point you to the right product guide.', variables: [{ name: 'workspace', description: 'Workspace or company name' }, { name: 'name', description: 'Visitor name' }] },
  { name: 'Product tour invite', description: 'Invite visitors to explore key features.', category: 'Onboarding', channel: 'Messenger', content: 'Would you like a quick tour of the features that can help your team?' },
  { name: 'Getting started checklist', description: 'Share a short first-session checklist.', category: 'Onboarding', channel: 'Email', content: 'Here is a short checklist to help you get started.' },
  { name: 'Trial follow-up', description: 'Guide visitors after trial activation.', category: 'Engagement', channel: 'Mobile', content: 'How is your trial going? I can answer questions or help you find the right plan.' },
  { name: 'Refund delay update', description: 'Explain refund timeline and next steps.', category: 'Transaction', channel: 'Chat', content: 'I’ve checked your refund status and will help clarify the expected timeline.' },
  { name: 'Order status update', description: 'Share tracking and delivery information.', category: 'Billing', channel: 'Website', content: 'I can help you check the latest status of your order.' }
];

// The demo workspace starts with a small library so the page is useful on first launch.
async function ensureStarterTemplates() {
  if (await ResponseTemplate.exists({})) return;
  await ResponseTemplate.insertMany(starterTemplates.map(template => ({ ...template, id: uuidv4(), uses: 0 })));
}

router.get('/', async (_req, res, next) => {
  try {
    await ensureStarterTemplates();
    const templates = await ResponseTemplate.find().sort({ createdAt: -1 });
    res.json(templates);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, category, content } = req.body;
    if (!name || !category || !content) {
      return res.status(400).json({ message: 'Name, category, and content are required' });
    }
    const template = await ResponseTemplate.create({
      id: uuidv4(),
      name,
      category,
      content,
      description: req.body.description || '',
      channel: req.body.channel || 'Chat',
      variables: Array.isArray(req.body.variables) ? req.body.variables : [],
      createdBy: req.body.createdBy || 'supervisor',
      isShared: Boolean(req.body.isShared),
      isPopular: Boolean(req.body.isPopular),
      uses: 0
    });
    res.status(201).json(template);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const template = await ResponseTemplate.findOne({ id: req.params.id });
    if (!template) return res.status(404).json({ message: 'Template not found' });
    res.json(template);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const allowedFields = ['name', 'category', 'content', 'description', 'channel', 'variables', 'isShared', 'isPopular', 'uses'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowedFields.includes(key)));
    const template = await ResponseTemplate.findOneAndUpdate({ id: req.params.id }, updates, { new: true, runValidators: true });
    if (!template) return res.status(404).json({ message: 'Template not found' });
    res.json(template);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await ResponseTemplate.deleteOne({ id: req.params.id });
    if (!result.deletedCount) return res.status(404).json({ message: 'Template not found' });
    res.json({ message: 'Template deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
