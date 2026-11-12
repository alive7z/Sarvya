import { Router } from 'express';
import { limitAsync } from '../middleware/security.js';
import { generateFix, verifyFix } from '../services/fixService.js';

const router = Router();

// Generate a fix proposal
router.post('/generate', (req, res) => {
  const { ruleId, snippet, summary } = req.body || {};
  if (!ruleId) {
    return res.status(400).json({ error: 'ruleId is required.' });
  }

  const fix = generateFix(ruleId, snippet, summary);
  res.json({
    ruleId,
    fix,
    explanation: `Proposed remediation for rule "${ruleId}". Review and verify before applying.`,
  });
});

// Verify a proposed fix using isolated Chromium + axe-core
router.post('/verify', limitAsync(2, async (req, res) => {
  const { ruleId, fix } = req.body || {};

  if (!fix) {
    return res.status(400).json({ error: 'A fix snippet is required for verification.' });
  }

  try {
    const result = await verifyFix(ruleId, fix);
    res.json(result);
  } catch (err) {
    res.status(400).json({
      error: 'The proposal could not be verified. Check the rule ID and snippet, then try again.',
    });
  }
}));

export default router;
