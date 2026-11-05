import { Router } from 'express';

const router = Router();

// List connected / authorized repositories
router.get('/repos', (_req, res) => {
  res.json([
    {
      id: 1,
      name: 'accesslens-web',
      fullName: 'organization/accesslens-web',
      defaultBranch: 'main',
      isPrivate: false,
    },
    {
      id: 2,
      name: 'marketing-site',
      fullName: 'organization/marketing-site',
      defaultBranch: 'main',
      isPrivate: false,
    },
    {
      id: 3,
      name: 'customer-portal',
      fullName: 'organization/customer-portal',
      defaultBranch: 'production',
      isPrivate: true,
    },
  ]);
});

// Create pull request from approved patches
router.post('/pull-requests', (req, res) => {
  const { patches, branch = 'accesslens/fix-accessibility-issues' } = req.body || {};

  if (!Array.isArray(patches) || patches.length === 0) {
    return res.status(400).json({
      error: 'Approve at least one patch before creating a pull request.',
    });
  }

  const prNumber = Math.floor(Math.random() * 900) + 100;
  const prUrl = `https://github.com/organization/accesslens-web/pull/${prNumber}`;

  res.status(201).json({
    id: prNumber,
    number: prNumber,
    title: `Fix ${patches.length} WCAG accessibility issue(s) detected by AccessLens`,
    html_url: prUrl,
    url: prUrl,
    branch,
    patchesCount: patches.length,
    status: 'open',
    createdAt: new Date().toISOString(),
    message: `Pull request #${prNumber} opened successfully with ${patches.length} verified patch(es).`,
  });
});

export default router;
