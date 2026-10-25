// ─── Espro POS System User Manual - PDF Generator ───
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import { manualMeta, documentControl, chapters, appendices } from './friendly-content.mjs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatInline(str) {
  if (!str) return '';
  let res = str.replace(/\[([A-Z0-9\s\+\-]+)\]/g, '<kbd class="key-badge">$1</kbd>');
  res = res.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return res;
}

function formatContent(text) {
  if (!text) return '';
  const paragraphs = text.split('\n\n');
  let html = '';

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    const lines = trimmed.split('\n');
    let inList = false;

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      if (line.startsWith('- ') || line.startsWith('* ')) {
        if (!inList) {
          html += '<ul class="content-list">\n';
          inList = true;
        }
        const itemText = escapeHtml(line.substring(2));
        html += `  <li>${formatInline(itemText)}</li>\n`;
      } else {
        if (inList) {
          html += '</ul>\n';
          inList = false;
        }
        html += `<p class="content-p">${formatInline(escapeHtml(line))}</p>\n`;
      }
    }

    if (inList) {
      html += '</ul>\n';
    }
  }

  return html;
}

export async function generatePdf(outputPath = './Espro_POS_System_Manual.pdf') {
  console.log('Generating Coffee Cup Logo data URI for Cover...');
  const svgPath = path.resolve('public/favicon.svg');
  const svgBuffer = fs.readFileSync(svgPath);
  const pngBuffer = await sharp(svgBuffer)
    .resize(240, 240)
    .composite([
      {
        input: Buffer.from(
          `<svg width="240" height="240"><circle cx="120" cy="120" r="116" fill="#F3E9D7" stroke="#C08F5E" stroke-width="6"/></svg>`
        ),
        blend: 'dest-over',
      },
    ])
    .png()
    .toBuffer();
  const logoDataUri = `data:image/png;base64,${pngBuffer.toString('base64')}`;

  console.log('Building Cover Page HTML...');
  const coverHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=Consolas&display=swap');
      @page {
        size: A4 portrait;
        margin: 0;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        padding: 0;
        width: 210mm;
        height: 297mm;
        background-color: #2B1D16;
        color: #F3E9D7;
        font-family: 'Hanken Grotesk', Calibri, Arial, sans-serif;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        position: relative;
        overflow: hidden;
      }
      .accent-stripe-top {
        height: 12mm;
        background: linear-gradient(90deg, #7A4A2B 0%, #C08F5E 50%, #7A4A2B 100%);
        width: 100%;
      }
      .accent-stripe-bottom {
        height: 10mm;
        background: #C08F5E;
        width: 100%;
      }
      .cover-content {
        padding: 24mm 24mm;
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .logo-container {
        display: flex;
        align-items: center;
        gap: 18px;
      }
      .logo-img {
        width: 85px;
        height: 85px;
        filter: drop-shadow(0 4px 12px rgba(0,0,0,0.5));
      }
      .brand-title {
        font-size: 26pt;
        font-weight: 800;
        letter-spacing: 2px;
        color: #F3E9D7;
        text-transform: uppercase;
      }
      .brand-tagline {
        font-size: 11pt;
        color: #C08F5E;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        font-weight: 600;
      }
      .main-titles {
        margin: 18mm 0;
      }
      .doc-title {
        font-size: 42pt;
        font-weight: 800;
        color: #FFFFFF;
        line-height: 1.1;
        margin: 0 0 10px 0;
        letter-spacing: -0.5px;
      }
      .doc-subtitle {
        font-size: 22pt;
        font-weight: 600;
        color: #C08F5E;
        margin: 0 0 14px 0;
      }
      .doc-divider {
        width: 70mm;
        height: 4px;
        background-color: #C08F5E;
        margin: 18px 0;
        border-radius: 2px;
      }
      .doc-desc {
        font-size: 13pt;
        line-height: 1.5;
        color: #F3E9D7;
        max-width: 155mm;
        opacity: 0.95;
      }
      .cover-meta {
        background: rgba(43, 29, 22, 0.7);
        border: 1px solid #7A4A2B;
        border-left: 6px solid #C08F5E;
        padding: 16px 20px;
        border-radius: 4px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .meta-item {
        display: flex;
        flex-direction: column;
      }
      .meta-label {
        font-size: 8.5pt;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #C08F5E;
        font-weight: 700;
      }
      .meta-value {
        font-size: 11pt;
        color: #FFFFFF;
        font-weight: 600;
        margin-top: 2px;
      }
    </style>
  </head>
  <body>
    <div class="accent-stripe-top"></div>
    <div class="cover-content">
      <div class="logo-container">
        <img class="logo-img" src="${logoDataUri}" alt="Espro Logo">
        <div>
          <div class="brand-title">Espro POS</div>
          <div class="brand-tagline">Retail & Cafe Operations Hub</div>
        </div>
      </div>

      <div class="main-titles">
        <div class="doc-title">System User<br>Manual</div>
        <div class="doc-subtitle">Store Operations &amp; Training Guide</div>
        <div class="doc-divider"></div>
        <div class="doc-desc">
          Comprehensive operational procedures and reference manual for cafe counter sales, drink recipe costing, inventory management, staff timekeeping, and store financial reporting.
        </div>
      </div>

      <div class="cover-meta">
        <div class="meta-item">
          <span class="meta-label">Document Version</span>
          <span class="meta-value">${escapeHtml(manualMeta.version)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Publication Date</span>
          <span class="meta-value">${escapeHtml(manualMeta.date)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Target Audience</span>
          <span class="meta-value">Store Owners, Managers &amp; Baristas</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Prepared For</span>
          <span class="meta-value">${escapeHtml(manualMeta.preparedFor)}</span>
        </div>
      </div>
    </div>
    <div class="accent-stripe-bottom"></div>
  </body>
  </html>
  `;

  console.log('Building Body Pages HTML...');
  let bodyHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=Consolas&display=swap');
      
      * {
        box-sizing: border-box;
      }

      body {
        font-family: 'Hanken Grotesk', Calibri, Arial, sans-serif;
        font-size: 10.5pt;
        line-height: 1.45;
        color: #2B1D16;
        margin: 0;
        padding: 0;
      }

      h1.chapter-title {
        page-break-before: always;
        font-size: 19pt;
        font-weight: 800;
        color: #2B1D16;
        border-bottom: 3px solid #7A4A2B;
        padding-bottom: 6px;
        margin-top: 0;
        margin-bottom: 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      h2.section-heading {
        font-size: 13pt;
        font-weight: 700;
        color: #7A4A2B;
        margin-top: 16px;
        margin-bottom: 6px;
        page-break-after: avoid;
      }
      h3.sub-heading {
        font-size: 11pt;
        font-weight: 700;
        color: #2B1D16;
        margin-top: 12px;
        margin-bottom: 4px;
        page-break-after: avoid;
      }

      p.content-p {
        margin: 6px 0;
        text-align: justify;
      }
      ul.content-list, ol.content-list {
        margin: 6px 0 10px 22px;
        padding: 0;
      }
      li {
        margin-bottom: 4px;
      }

      /* Role Badges */
      .badge-admin {
        background-color: #7A4A2B;
        color: #FFFFFF;
        font-size: 8pt;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        vertical-align: middle;
      }
      .badge-all {
        background-color: #2D6A4F;
        color: #FFFFFF;
        font-size: 8pt;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        vertical-align: middle;
      }

      /* Metadata Block */
      .meta-block {
        background-color: #FBF5EA;
        border: 1px solid #D6C0A0;
        border-left: 5px solid #C08F5E;
        padding: 8px 12px;
        margin-bottom: 14px;
        border-radius: 0 4px 4px 0;
      }
      .meta-block p {
        margin: 2px 0;
        font-size: 10pt;
      }
      .meta-block strong {
        color: #7A4A2B;
      }

      /* Callout Boxes */
      .callout {
        margin: 12px 0;
        padding: 10px 14px;
        border-radius: 0 4px 4px 0;
        page-break-inside: avoid;
      }
      .callout-header {
        font-weight: 800;
        font-size: 9pt;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 4px;
      }
      .callout-content {
        font-size: 9.5pt;
        line-height: 1.4;
      }
      .callout-tip {
        border-left: 5px solid #2D6A4F;
        background-color: #EBF5F0;
        color: #1B4332;
      }
      .callout-tip .callout-header { color: #2D6A4F; }
      .callout-note {
        border-left: 5px solid #2E6585;
        background-color: #EDF4F8;
        color: #1A3C4F;
      }
      .callout-note .callout-header { color: #2E6585; }
      .callout-warning {
        border-left: 5px solid #C2671A;
        background-color: #FDF4ED;
        color: #7A3D0B;
      }
      .callout-warning .callout-header { color: #C2671A; }

      /* Tables */
      table.manual-table {
        width: 100%;
        border-collapse: collapse;
        margin: 12px 0;
        page-break-inside: avoid;
        font-size: 9.5pt;
      }
      table.manual-table thead {
        display: table-header-group;
      }
      table.manual-table th {
        background-color: #7A4A2B;
        color: #FFFFFF;
        font-weight: 700;
        text-align: left;
        padding: 7px 10px;
        border: 1px solid #7A4A2B;
      }
      table.manual-table td {
        padding: 6px 10px;
        border: 1px solid #D6C0A0;
        vertical-align: top;
      }
      table.manual-table tbody tr:nth-child(even) {
        background-color: #FBF5EA;
      }
      table.manual-table tbody tr:nth-child(odd) {
        background-color: #FFFFFF;
      }

      /* Prominent Screenshot Placeholder Frame */
      .screenshot-frame {
        border: 2px dashed #C08F5E;
        background-color: #FDFBF7;
        border-radius: 8px;
        padding: 18px 16px;
        margin: 16px 0;
        text-align: center;
        min-height: 140px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        page-break-inside: avoid;
      }
      .screenshot-badge {
        background-color: #7A4A2B;
        color: #FFFFFF;
        font-size: 8.5pt;
        font-weight: 700;
        padding: 3px 10px;
        border-radius: 12px;
        letter-spacing: 0.5px;
        margin-bottom: 6px;
        display: inline-block;
      }
      .screenshot-title {
        font-family: 'Hanken Grotesk', Calibri, sans-serif;
        font-weight: 700;
        font-size: 11pt;
        color: #2B1D16;
        margin-bottom: 4px;
      }
      .screenshot-space-indicator {
        margin: 12px 0;
        padding: 14px 28px;
        border: 1px dashed #D6C0A0;
        border-radius: 6px;
        background-color: #FFFFFF;
        color: #C08F5E;
        font-size: 9pt;
        font-family: Consolas, monospace;
      }
      .screenshot-hint {
        font-size: 8.5pt;
        color: #735B4D;
        font-style: italic;
      }

      kbd.key-badge {
        font-family: Consolas, monospace;
        background-color: #F3E9D7;
        border: 1px solid #D6C0A0;
        border-radius: 3px;
        color: #2B1D16;
        display: inline-block;
        font-size: 9pt;
        font-weight: 600;
        padding: 1px 5px;
      }

      .toc-wrapper {
        page-break-before: always;
        page-break-after: always;
      }
      .toc-title {
        font-size: 19pt;
        font-weight: 800;
        color: #2B1D16;
        border-bottom: 3px solid #7A4A2B;
        padding-bottom: 6px;
        margin-bottom: 14px;
      }
      .toc-item {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        padding: 4px 0;
        border-bottom: 1px dotted #D6C0A0;
      }
      .toc-item a {
        text-decoration: none;
        color: #2B1D16;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .toc-subitem {
        margin-left: 20px;
        font-size: 9pt;
        border-bottom: 1px dotted #E5D8C5;
      }
      .toc-subitem a {
        font-weight: 400;
        color: #555555;
      }

      .doc-control-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-bottom: 16px;
      }
      .doc-control-card {
        background-color: #FBF5EA;
        border: 1px solid #D6C0A0;
        padding: 10px 14px;
        border-radius: 4px;
      }
    </style>
  </head>
  <body>
  `;

  // Document Control Section
  bodyHtml += `
    <div style="page-break-after: always;">
      <h1 class="chapter-title" style="page-break-before: avoid;">Document Control &amp; System Information</h1>
      <p class="content-p">${escapeHtml(documentControl.purpose)}</p>
      
      <div class="doc-control-grid">
        <div class="doc-control-card">
          <p style="margin: 0 0 4px 0;"><strong>System Title:</strong> Espro POS – Retail &amp; Cafe Operations Hub</p>
          <p style="margin: 0 0 4px 0;"><strong>Manual Identifier:</strong> ESPRO-MAN-V1.0</p>
          <p style="margin: 0 0 4px 0;"><strong>Version:</strong> ${escapeHtml(documentControl.version)}</p>
          <p style="margin: 0 0 4px 0;"><strong>Publication Date:</strong> ${escapeHtml(documentControl.date)}</p>
        </div>
        <div class="doc-control-card">
          <p style="margin: 0 0 4px 0;"><strong>Target Audience:</strong> ${escapeHtml(documentControl.audience)}</p>
          <p style="margin: 0 0 4px 0;"><strong>Prepared By:</strong> ${escapeHtml(documentControl.preparedBy)}</p>
          <p style="margin: 0 0 4px 0;"><strong>Operational Environment:</strong> Philippine Peso (₱) | Asia/Manila (PHT)</p>
        </div>
      </div>

      <h2 class="section-heading">Operational Structure</h2>
      <p class="content-p">This manual is organized into eleven operational chapters and reference appendices:</p>
      <ul class="content-list">
        <li><strong>Chapters 1–4:</strong> Counter operations (System overview, user authentication, shift timekeeping with 4-digit PIN, counter order processing, and receipt printing).</li>
        <li><strong>Chapters 5–8:</strong> Back-office management (Menu engineering, recipe costing, FEFO inventory tracking, expense recording, and financial profitability reports).</li>
        <li><strong>Chapters 9–11:</strong> Staff administration &amp; standard procedures (Employee directory, shift scheduling, opening/closing checklists, and troubleshooting reference).</li>
      </ul>
      <p class="content-p"><strong>Interface Screenshot References:</strong> Each chapter includes designated screenshot frames labeled <code>SYSTEM SCREENSHOT PLACEHOLDER</code> providing dedicated spaces for interface illustrations and terminal captures.</p>
    </div>
  `;

  // Table of Contents Section
  bodyHtml += `
    <div class="toc-wrapper">
      <div class="toc-title">Table of Contents</div>
  `;

  chapters.forEach((ch) => {
    const badgeClass = ch.roleBadge === 'ADMIN ONLY' ? 'badge-admin' : 'badge-all';
    bodyHtml += `
      <div class="toc-item">
        <a href="#${ch.id}">
          <span>Chapter ${ch.number} – ${escapeHtml(ch.title)}</span>
          <span class="${badgeClass}">${ch.roleBadge}</span>
        </a>
      </div>
    `;
    if (ch.sections && ch.sections.length > 0) {
      ch.sections.forEach((sec) => {
        bodyHtml += `
          <div class="toc-item toc-subitem">
            <a href="#${ch.id}">
              <span>${escapeHtml(sec.heading)}</span>
            </a>
          </div>
        `;
      });
    }
  });

  appendices.forEach((app) => {
    bodyHtml += `
      <div class="toc-item" style="margin-top: 6px;">
        <a href="#${app.id}">
          <strong>Appendix ${app.letter} – ${escapeHtml(app.title)}</strong>
        </a>
      </div>
    `;
  });

  bodyHtml += `</div>`; // Close TOC wrapper

  // Render Chapters
  chapters.forEach((ch) => {
    const badgeClass = ch.roleBadge === 'ADMIN ONLY' ? 'badge-admin' : 'badge-all';
    bodyHtml += `
      <div class="chapter-block" id="${ch.id}">
        <h1 class="chapter-title">
          <span>Chapter ${ch.number} – ${escapeHtml(ch.title)}</span>
          <span class="${badgeClass}">${ch.roleBadge}</span>
        </h1>

        <div class="meta-block">
          <p><strong>Purpose:</strong> ${escapeHtml(ch.purpose)}</p>
          <p><strong>Where to find it:</strong> ${escapeHtml(ch.whereToFind)}</p>
        </div>

        <h2 class="section-heading">Overview</h2>
        ${formatContent(ch.overview)}
    `;

    // Framed Screenshot Placeholder Box
    if (ch.screenshot) {
      bodyHtml += `
        <div class="screenshot-frame">
          <div class="screenshot-badge">SYSTEM SCREENSHOT PLACEHOLDER</div>
          <div class="screenshot-title">[ ${escapeHtml(ch.screenshot.label)} ]</div>
          <div class="screenshot-space-indicator">( Paste UI Screenshot Here )</div>
          <div class="screenshot-hint">${escapeHtml(ch.screenshot.caption)}</div>
        </div>
      `;
    }

    // Render Subsections & Tasks
    if (ch.sections && ch.sections.length > 0) {
      ch.sections.forEach((sec) => {
        bodyHtml += `
          <h2 class="section-heading">${escapeHtml(sec.heading)}</h2>
          ${formatContent(sec.content)}
        `;

        if (sec.callouts && sec.callouts.length > 0) {
          sec.callouts.forEach((c) => {
            const typeLower = (c.type || 'NOTE').toLowerCase();
            bodyHtml += `
              <div class="callout callout-${typeLower}">
                <div class="callout-header">${escapeHtml(c.type)}: ${escapeHtml(c.title)}</div>
                <div class="callout-content">${formatInline(escapeHtml(c.content))}</div>
              </div>
            `;
          });
        }

        if (sec.table) {
          bodyHtml += `
            <table class="manual-table">
              <thead>
                <tr>
          `;
          sec.table.headers.forEach((h) => {
            bodyHtml += `<th>${escapeHtml(h)}</th>`;
          });
          bodyHtml += `
                </tr>
              </thead>
              <tbody>
          `;
          sec.table.rows.forEach((row) => {
            bodyHtml += `<tr>`;
            row.forEach((cell) => {
              bodyHtml += `<td>${formatInline(escapeHtml(cell))}</td>`;
            });
            bodyHtml += `</tr>`;
          });
          bodyHtml += `
              </tbody>
            </table>
          `;
        }

        if (sec.tasks && sec.tasks.length > 0) {
          sec.tasks.forEach((task) => {
            bodyHtml += `
              <h3 class="sub-heading">Procedure: ${escapeHtml(task.title)}</h3>
              <ol class="content-list">
            `;
            task.steps.forEach((step) => {
              bodyHtml += `<li>${formatInline(escapeHtml(step))}</li>`;
            });
            bodyHtml += `</ol>`;

            if (task.expectedResult) {
              bodyHtml += `
                <div class="callout callout-tip">
                  <div class="callout-header">Expected Result</div>
                  <div class="callout-content">${formatInline(escapeHtml(task.expectedResult))}</div>
                </div>
              `;
            }
          });
        }
      });
    }

    bodyHtml += `</div>`;
  });

  appendices.forEach((app) => {
    bodyHtml += `
      <div class="appendix-block" id="${app.id}">
        <h1 class="chapter-title">Appendix ${app.letter} – ${escapeHtml(app.title)}</h1>
        ${formatContent(app.content)}
    `;

    if (app.table) {
      bodyHtml += `
        <table class="manual-table">
          <thead>
            <tr>
      `;
      app.table.headers.forEach((h) => {
        bodyHtml += `<th>${escapeHtml(h)}</th>`;
      });
      bodyHtml += `
            </tr>
          </thead>
          <tbody>
      `;
      app.table.rows.forEach((r) => {
        bodyHtml += `<tr>`;
        r.forEach((cell) => {
          bodyHtml += `<td>${formatInline(escapeHtml(cell))}</td>`;
        });
        bodyHtml += `</tr>`;
      });
      bodyHtml += `
          </tbody>
        </table>
      `;
    }

    bodyHtml += `</div>`;
  });

  bodyHtml += `
  </body>
  </html>
  `;

  console.log('Launching headless Chrome to render PDF parts...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // Render Cover PDF
  console.log('Rendering Cover PDF...');
  const coverPage = await browser.newPage();
  await coverPage.setContent(coverHtml, { waitUntil: 'networkidle0' });
  const coverPdfBuffer = await coverPage.pdf({
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: false,
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
  });
  await coverPage.close();

  // Render Body PDF
  console.log('Rendering Body PDF with running headers and footers...');
  const bodyPage = await browser.newPage();
  await bodyPage.setContent(bodyHtml, { waitUntil: 'networkidle0' });
  const bodyPdfBuffer = await bodyPage.pdf({
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    margin: { top: '22mm', bottom: '22mm', left: '22mm', right: '22mm' },
    headerTemplate: `
      <div style="font-size: 8pt; width: 100%; display: flex; justify-content: space-between; padding: 0 22mm; font-family: 'Hanken Grotesk', Calibri, sans-serif; color: #7A4A2B; border-bottom: 1px solid #D6C0A0; padding-bottom: 4px;">
        <span style="font-weight: 700;">Espro POS – System User Manual</span>
        <span style="color: #C08F5E;">Retail &amp; Cafe Operations Hub</span>
      </div>
    `,
    footerTemplate: `
      <div style="font-size: 8pt; width: 100%; display: flex; justify-content: space-between; padding: 0 22mm; font-family: 'Hanken Grotesk', Calibri, sans-serif; color: #735B4D; border-top: 1px solid #D6C0A0; padding-top: 4px;">
        <span>Confidential – Internal Store Operations</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>
    `,
  });
  await bodyPage.close();
  await browser.close();

  console.log('Merging Cover Page and Body Pages using pdf-lib...');
  const mergedPdfDoc = await PDFDocument.create();

  // Load Cover
  const coverDoc = await PDFDocument.load(coverPdfBuffer);
  const [coverPageLoaded] = await mergedPdfDoc.copyPages(coverDoc, [0]);
  mergedPdfDoc.addPage(coverPageLoaded);

  // Load Body
  const bodyDoc = await PDFDocument.load(bodyPdfBuffer);
  const bodyPageIndices = bodyDoc.getPageIndices();
  const loadedBodyPages = await mergedPdfDoc.copyPages(bodyDoc, bodyPageIndices);
  loadedBodyPages.forEach((p) => mergedPdfDoc.addPage(p));

  const totalPageCount = mergedPdfDoc.getPageCount();
  console.log(`Total assembled PDF page count: ${totalPageCount} pages.`);

  const mergedPdfBytes = await mergedPdfDoc.save();
  const resolvedOutputPath = path.resolve(outputPath);
  fs.writeFileSync(resolvedOutputPath, mergedPdfBytes);
  console.log(`PDF successfully generated and saved to ${resolvedOutputPath} (${mergedPdfBytes.length} bytes).`);

  return { outputPath: resolvedOutputPath, pageCount: totalPageCount };
}

if (process.argv[1]?.endsWith('generate-friendly-pdf.mjs')) {
  generatePdf().catch((err) => {
    console.error('Error generating PDF:', err);
    process.exit(1);
  });
}
