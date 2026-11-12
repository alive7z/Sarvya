// Fictional fixture with intentional accessibility issues; never a live scan result.
export const DEMO_HOST = 'forma.example';

export const demoIssues = [
  {
    id: 'image-alt',
    title: 'Image missing alternative text',
    rule: 'image-alt',
    severity: 'critical',
    wcag: '1.1.1',
    count: 3,
    selector: 'img.hero-art',
    explanation:
      'Images that convey information need a text alternative so screen reader users can understand their purpose.',
    snippet: '<img class="hero-art" src="/samples/forma-workspace.svg">',
    fix: '<img class="hero-art" src="/samples/forma-workspace.svg" alt="A bright workspace with a desk, chair, and plant">',
    status: 'Not tested',
    nodes: [
      {
        id: 'image-alt-node-0',
        index: 1,
        selector: 'img.hero-art',
        snippet: '<img class="hero-art" src="/samples/forma-workspace.svg">',
        fix: '<img class="hero-art" src="/samples/forma-workspace.svg" alt="A bright workspace with a desk, chair, and plant">',
        summary: 'Element does not have an alt attribute',
      },
      {
        id: 'image-alt-node-1',
        index: 2,
        selector: 'img.team-photo',
        snippet: '<img class="team-photo" src="/samples/forma-team.svg">',
        fix: '<img class="team-photo" src="/samples/forma-team.svg" alt="Two colleagues collaborating at a shared desk">',
        summary: 'Element does not have an alt attribute',
      },
      {
        id: 'image-alt-node-2',
        index: 3,
        selector: 'img.product-chart',
        snippet: '<img class="product-chart" src="/samples/forma-growth.svg">',
        fix: '<img class="product-chart" src="/samples/forma-growth.svg" alt="Bar chart showing quarterly performance gains">',
        summary: 'Element does not have an alt attribute',
      },
    ],
  },
  {
    id: 'contrast',
    title: 'Text has insufficient contrast',
    rule: 'color-contrast',
    severity: 'serious',
    wcag: '1.4.3',
    count: 2,
    selector: '.muted-copy',
    explanation:
      'This text does not have enough contrast against its background to remain readable for many people.',
    snippet: '<p class="muted-copy">Good things start with a little space.</p>',
    fix: '<p class="muted-copy" style="color: #4b5563;">Good things start with a little space.</p>\n<!-- Candidate contrast improvement; verify in context. -->',
    status: 'Not tested',
    nodes: [
      {
        id: 'contrast-node-0',
        index: 1,
        selector: '.muted-copy',
        snippet: '<p class="muted-copy">Good things start with a little space.</p>',
        fix: '<p class="muted-copy" style="color: #4b5563;">Good things start with a little space.</p>\n<!-- Candidate contrast improvement; verify in context. -->',
        summary: 'Intentionally pale demo text; check its contrast against the surrounding background.',
      },
      {
        id: 'contrast-node-1',
        index: 2,
        selector: 'span.subtext',
        snippet: '<span class="subtext">A little inspiration, once a month.</span>',
        fix: '<span class="subtext" style="color: #374151;">A little inspiration, once a month.</span>\n<!-- Candidate contrast improvement; verify in context. -->',
        summary: 'Intentionally pale demo text; check its contrast against the surrounding background.',
      },
    ],
  },
  {
    id: 'button-name',
    title: 'Button has no accessible name',
    rule: 'button-name',
    severity: 'serious',
    wcag: '4.1.2',
    count: 1,
    selector: 'button.icon-only',
    explanation: 'A button needs a programmatic name that describes its action.',
    snippet: '<button class="icon-only"><svg>…</svg></button>',
    fix: '<button class="icon-only" aria-label="Open your account"><svg>…</svg></button>',
    status: 'Not tested',
    nodes: [
      {
        id: 'button-name-node-0',
        index: 1,
        selector: 'button.icon-only',
        snippet: '<button class="icon-only"><svg>…</svg></button>',
        fix: '<button class="icon-only" aria-label="Open your account"><svg>…</svg></button>',
        summary: 'Element does not have inner text or an aria-label',
      },
    ],
  },
  {
    id: 'label',
    title: 'Form field has no label',
    rule: 'label',
    severity: 'moderate',
    wcag: '1.3.1',
    count: 1,
    selector: 'input#email',
    explanation:
      'Visible and programmatic labels help people identify what information belongs in a field.',
    snippet: '<input id="email" type="email">',
    fix: '<label for="email">Email address</label>\n<input id="email" type="email">',
    status: 'Not tested',
    nodes: [
      {
        id: 'label-node-0',
        index: 1,
        selector: 'input#email',
        snippet: '<input id="email" type="email">',
        fix: '<label for="email">Email address</label>\n<input id="email" type="email">',
        summary: 'Form control does not have a label',
      },
    ],
  },
  {
    id: 'lang',
    title: 'Document language is missing',
    rule: 'html-has-lang',
    severity: 'moderate',
    wcag: '3.1.1',
    count: 1,
    selector: 'html',
    explanation:
      'Set the page language so assistive technology can pronounce content correctly.',
    snippet: '<html>',
    fix: '<html lang="en">',
    status: 'Not tested',
    nodes: [
      {
        id: 'lang-node-0',
        index: 1,
        selector: 'html',
        snippet: '<html>',
        fix: '<html lang="en">',
        summary: 'The <html> element does not have a lang attribute',
      },
    ],
  },
];

export const demoHtml = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Forma — Make space for a better everyday · Demo</title>
<style>
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:16px}body{margin:0;background:#fcfcf9;color:#25334a;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6}a{color:inherit;text-decoration:none}button,input{font:inherit}button,a{touch-action:manipulation}button{cursor:pointer}a:focus-visible,button:focus-visible,input:focus-visible{outline:3px solid #2563eb;outline-offset:4px}button svg{display:block;pointer-events:none}.demo-strip{padding:6px 20px;background:#eaf0f8;color:#506684;text-align:center;font-size:9px;letter-spacing:.08em}.nav{display:flex;align-items:center;justify-content:space-between;gap:12px;max-width:1100px;margin:auto;padding:17px 6%;border-bottom:1px solid #e9eced}.wordmark{font-family:Georgia,serif;font-size:28px;font-weight:bold;line-height:1;color:#2d4465;letter-spacing:-1.5px}.wordmark span{color:#7c9cbe}.nav-links{display:flex;align-items:center;gap:20px;font-size:11px;color:#687589}.icon-only{display:grid;place-items:center;width:32px;height:32px;border:1px solid #e0e7ed;border-radius:50%;background:#fff;color:#445e7b}.hero{display:grid;grid-template-columns:1fr 1.1fr;align-items:center;gap:30px;max-width:1100px;margin:auto;padding:36px 6% 32px}.eyebrow{display:flex;align-items:center;gap:7px;color:#5e7a9f;font-size:9px;font-weight:700;letter-spacing:.13em;text-transform:uppercase}.eyebrow:before{content:'';width:18px;height:1px;background:#8ca5c5}.hero h1{font-family:Georgia,'Times New Roman',serif;font-size:clamp(30px,5vw,56px);font-weight:400;line-height:1.09;letter-spacing:-1.8px;margin:15px 0}.hero h1 em{font-style:italic;color:#6a89ac}.hero-description{max-width:280px;margin:0 0 18px;color:#6b7888;font-size:12px;line-height:1.8}.muted-copy{color:#b4bec9;font-size:10px;margin:11px 0 0}.cta{display:inline-flex;align-items:center;justify-content:center;gap:14px;padding:11px 17px;background:#365b8c;color:white;border:0;border-radius:7px;font-size:11px;font-weight:600}.cta:hover{background:#294a76}.art-wrap{position:relative;min-width:0}.hero-art{display:block;width:100%;height:auto;max-height:330px;object-fit:contain;border-radius:18px}.art-note{position:absolute;bottom:12px;left:12px;padding:7px 11px;border:1px solid #fff9;border-radius:8px;background:#fffffff0;box-shadow:0 4px 12px #334b6b0a;font-size:9px;color:#52677e}.art-note b{color:#2d4666}.promises{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;max-width:1100px;margin:0 auto;padding:17px 6%;border-top:1px solid #e5e9eb;border-bottom:1px solid #e5e9eb;color:#798695;font-size:9px}.promises span{display:flex;align-items:center;gap:7px}.promises b{color:#566c83;font-weight:400}.collection{max-width:1100px;margin:0 auto;padding:30px 6% 36px}.section-top{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:18px}.section-top h2,.newsletter h2{margin:0;color:#2d4260;font-family:Georgia,serif;font-size:25px;font-weight:400;line-height:1.2;letter-spacing:-.6px}.section-top p{margin:5px 0 0;color:#7b8794;font-size:10px}.section-top a{flex-shrink:0;border-bottom:1px solid #b3c2d1;padding-bottom:2px;color:#587391;font-size:10px}.product-grid{display:grid;grid-template-columns:1fr 1fr;gap:17px}.product-card{min-width:0;border:1px solid #e6ebec;border-radius:12px;overflow:hidden;background:#fff}.product-card img{display:block;width:100%;aspect-ratio:560/340;object-fit:cover}.product-body{padding:13px 15px}.product-body span{font-size:9px;color:#7f8e9e}.product-body h3{margin:3px 0 5px;font-size:13px;font-weight:600;color:#374f6a}.product-body p{margin:0;font-size:10px;color:#788694}.newsletter{display:grid;grid-template-columns:1fr 1.1fr;align-items:center;gap:24px;max-width:1100px;margin:0 auto;padding:28px 6%;background:#edf2f5}.newsletter h2{font-size:23px}.subtext{display:block;font-size:11px;color:#b8c2cb;margin-top:7px}.form-label{display:block;margin-bottom:5px;font-size:10px;color:#607488}.form-row{display:flex;gap:7px}.form-row input{min-width:0;flex:1;border:1px solid #d4dfe6;border-radius:6px;background:#fff;padding:10px;font-size:10px;color:#324963}.form-row button{border-radius:6px;padding:9px 12px}.form-note,.form-status{margin:7px 0 0;color:#6c8093;font-size:9px}.footer{max-width:1100px;margin:auto;padding:20px 6%;display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;color:#82909d;font-size:9px}.footer .wordmark{font-size:21px}dialog{max-width:310px;border:1px solid #d9e3ec;border-radius:14px;padding:24px;color:#354b65;background:#fcfcf9}dialog::backdrop{background:#24354b55}dialog h2{font-family:Georgia,serif;font-weight:400;margin-top:0}dialog p{font-size:12px}.broken{outline:3px solid #f97316!important;outline-offset:4px}
@media(max-width:480px){.nav-links{gap:12px}.nav-links a:last-child{display:none}.hero{grid-template-columns:1fr;gap:22px;padding-top:27px}.hero h1{font-size:42px;max-width:290px}.hero-description{max-width:100%}.hero-art{max-height:none}.promises{gap:9px;font-size:8px}.promises span{align-items:start}.newsletter{grid-template-columns:1fr;gap:17px}.section-top{align-items:start}.product-grid{gap:10px}.product-body{padding:11px}.section-top h2{font-size:23px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
</style>
</head>
<body>
<div class="demo-strip">SARVYA DEMO · FICTIONAL STORE · INTENTIONAL ACCESSIBILITY ISSUES</div>
<header class="nav">
<a class="wordmark" href="#home" aria-label="Forma home">forma<span>.</span></a>
<nav class="nav-links" aria-label="Store navigation"><a href="#collection">The collection</a><a href="#newsletter">Our journal</a></nav>
<button class="icon-only" type="button" onclick="document.getElementById('demo-account').showModal()"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg></button>
</header>
<main id="home">
<section class="hero" aria-labelledby="hero-title">
<div><div class="eyebrow">Considered spaces, everyday living</div><h1 id="hero-title">Make space for<br>a <em>better everyday.</em></h1><p class="hero-description">Thoughtful essentials for the places where ideas grow. Less clutter, more room for what matters.</p><a class="cta" href="#collection">Explore the collection <span aria-hidden="true">↗</span></a><p class="muted-copy">Good things start with a little space.</p></div>
<div class="art-wrap"><img class="hero-art" src="/samples/forma-workspace.svg"><div class="art-note"><b>A corner of your own.</b> Made for focus.</div></div>
</section>
<div class="promises"><span><b aria-hidden="true">✧</b> Designed with intention</span><span><b aria-hidden="true">◌</b> A calmer kind of workspace</span><span><b aria-hidden="true">↗</b> Small details. Lasting impact.</span></div>
<section id="collection" class="collection" aria-labelledby="collection-title">
<div class="section-top"><div><h2 id="collection-title">Room for good things.</h2><p>A few ideas for a more thoughtful working day.</p></div><a href="#newsletter">Get inspired <span aria-hidden="true">↗</span></a></div>
<div class="product-grid"><article class="product-card"><img class="team-photo" src="/samples/forma-team.svg"><div class="product-body"><span>THE SHARED SPACE</span><h3>Better, together.</h3><p>Make room for conversation, connection, and a fresh perspective.</p></div></article><article class="product-card"><img class="product-chart" src="/samples/forma-growth.svg"><div class="product-body"><span>THE EVERYDAY EDIT</span><h3>A little progress, every day.</h3><p>Small changes that make a meaningful difference to your routine.</p></div></article></div>
</section>
<section class="newsletter" id="newsletter" aria-labelledby="newsletter-title"><div><h2 id="newsletter-title">Good ideas. In your inbox.</h2><span class="subtext">A little inspiration, once a month.</span></div><form id="demo-newsletter"><span class="form-label">Email address</span><div class="form-row"><input id="email" type="email" placeholder="you@example.com" required><button class="cta" type="submit">Join the list <span aria-hidden="true">↗</span></button></div><p class="form-note">Demo form. No email is sent or stored.</p><p class="form-status" id="form-status" role="status"></p></form></section>
</main>
<footer class="footer"><a class="wordmark" href="#home" aria-label="Forma home">forma<span>.</span></a><span>A fictional brand, made for the Sarvya demo.</span><a href="#collection">Back to the collection ↑</a></footer>
<dialog id="demo-account" aria-labelledby="account-title"><h2 id="account-title">A place of your own.</h2><p>This is a demo account panel. No sign-in or personal information is required.</p><form method="dialog"><button class="cta">Close</button></form></dialog>
<script>document.getElementById('demo-newsletter').addEventListener('submit',function(event){event.preventDefault();document.getElementById('form-status').textContent='Demo complete. No email was sent or stored.';});</script>
</body>
</html>`;
