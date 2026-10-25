// ─── Espro POS System User Manual - Word (.docx) Generator ───
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  WidthType,
  BorderStyle,
  ShadingType,
  AlignmentType,
  Header,
  Footer,
  PageNumber,
  ImageRun,
  TableOfContents,
  Packer
} from 'docx';
import { manualMeta, documentControl, chapters, appendices } from './manual-content.mjs';

// Color Palette Constants
const COLORS = {
  espresso: '2B1D16',
  mocha: '7A4A2B',
  caramel: 'C08F5E',
  cream: 'F3E9D7',
  warmSurface: 'FBF5EA',
  tan: 'D6C0A0',
  success: '2D6A4F',
  warning: 'C2671A',
  danger: 'B83A2E',
  info: '2E6585',
  white: 'FFFFFF',
  textMuted: '735B4D',
  calloutGreenBg: 'EAF4EE',
  calloutBlueBg: 'EBF3F8',
  calloutAmberBg: 'FDF3E9',
  calloutRedBg: 'FAEBEA',
};

const A4_WIDTH_TWIPS = 11907;
const A4_HEIGHT_TWIPS = 16839;
const MARGIN_TWIPS = 1247; // 22 mm (~2.2 cm)

/**
 * Convert public/favicon.svg to a high-resolution PNG on a cream circular badge.
 */
async function generateLogoPng() {
  const svgPath = path.resolve('public/favicon.svg');
  const svgContent = fs.readFileSync(svgPath, 'utf8');

  // Wrap in a circular cream background for a luxury cafe badge
  const circularSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
      <defs>
        <radialGradient id="grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#FFFFFF" />
          <stop offset="100%" stop-color="#F3E9D7" />
        </radialGradient>
      </defs>
      <circle cx="150" cy="150" r="140" fill="url(#grad)" stroke="#C08F5E" stroke-width="8"/>
      <g transform="translate(60, 60) scale(7.5)">
        <path d="M17 8h1a4 4 0 1 1 0 8h-1" fill="none" stroke="#7A4A2B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" fill="#C08F5E" fill-opacity="0.25" stroke="#7A4A2B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        <line x1="6" y1="2" x2="6" y2="4" stroke="#7A4A2B" stroke-width="2.2" stroke-linecap="round"/>
        <line x1="10" y1="2" x2="10" y2="4" stroke="#7A4A2B" stroke-width="2.2" stroke-linecap="round"/>
        <line x1="14" y1="2" x2="14" y2="4" stroke="#7A4A2B" stroke-width="2.2" stroke-linecap="round"/>
      </g>
    </svg>
  `;

  return await sharp(Buffer.from(circularSvg))
    .png()
    .toBuffer();
}

/**
 * Build a role badge paragraph.
 */
function createRoleBadge(badgeText) {
  const isAdmin = badgeText.includes('ADMIN');
  const bgColor = isAdmin ? COLORS.mocha : COLORS.success;
  return new Paragraph({
    spacing: { before: 80, after: 140 },
    children: [
      new TextRun({
        text: ` [${badgeText}] `,
        bold: true,
        size: 18, // 9pt
        color: COLORS.white,
        font: 'Consolas',
        shading: {
          fill: bgColor,
          type: ShadingType.CLEAR,
        },
      }),
    ],
  });
}

/**
 * Build a styled callout box table.
 */
function createCalloutBox(type, title, content) {
  let borderColor = COLORS.info;
  let bgColor = COLORS.calloutBlueBg;
  let label = 'NOTE';

  if (type === 'TIP') {
    borderColor = COLORS.success;
    bgColor = COLORS.calloutGreenBg;
    label = 'TIP';
  } else if (type === 'WARNING') {
    borderColor = COLORS.warning;
    bgColor = COLORS.calloutAmberBg;
    label = 'WARNING';
  } else if (type === 'IMPORTANT') {
    borderColor = COLORS.danger;
    bgColor = COLORS.calloutRedBg;
    label = 'IMPORTANT';
  }

  const cell = new TableCell({
    width: { size: 100, type: WidthType.PERCENTAGE },
    shading: { fill: bgColor },
    borders: {
      left: { style: BorderStyle.SINGLE, size: 28, color: borderColor },
      top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    },
    margins: { top: 140, bottom: 140, left: 200, right: 180 },
    children: [
      new Paragraph({
        spacing: { before: 0, after: 60 },
        children: [
          new TextRun({
            text: `${label}: `,
            bold: true,
            size: 20,
            color: borderColor,
            font: 'Hanken Grotesk',
          }),
          new TextRun({
            text: title,
            bold: true,
            size: 20,
            color: COLORS.espresso,
            font: 'Hanken Grotesk',
          }),
        ],
      }),
      new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({
            text: content,
            size: 19,
            color: COLORS.espresso,
            font: 'Calibri',
          }),
        ],
      }),
    ],
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: [cell] })],
  });
}

/**
 * Build a screenshot placeholder box.
 */
function createScreenshotBox(label, caption) {
  const cell = new TableCell({
    width: { size: 100, type: WidthType.PERCENTAGE },
    shading: { fill: COLORS.warmSurface },
    borders: {
      left: { style: BorderStyle.DASHED, size: 8, color: COLORS.tan },
      top: { style: BorderStyle.DASHED, size: 8, color: COLORS.tan },
      right: { style: BorderStyle.DASHED, size: 8, color: COLORS.tan },
      bottom: { style: BorderStyle.DASHED, size: 8, color: COLORS.tan },
    },
    margins: { top: 240, bottom: 240, left: 240, right: 240 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 40 },
        children: [
          new TextRun({
            text: label,
            bold: true,
            size: 20,
            color: COLORS.mocha,
            font: 'Consolas',
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({
            text: caption,
            italics: true,
            size: 18,
            color: COLORS.textMuted,
            font: 'Calibri',
          }),
        ],
      }),
    ],
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: [cell] })],
  });
}

/**
 * Build a formatted data table with Mocha headers, Tan borders, and Cream alternate rows.
 */
function createDataTable(headers, rows) {
  const tableRows = [];

  // Header Row
  const headerCells = headers.map((h) => {
    return new TableCell({
      shading: { fill: COLORS.mocha },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.tan },
        bottom: { style: BorderStyle.SINGLE, size: 8, color: COLORS.espresso },
        left: { style: BorderStyle.SINGLE, size: 4, color: COLORS.tan },
        right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.tan },
      },
      margins: { top: 120, bottom: 120, left: 140, right: 140 },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: h,
              bold: true,
              size: 19,
              color: COLORS.white,
              font: 'Hanken Grotesk',
            }),
          ],
        }),
      ],
    });
  });

  tableRows.push(
    new TableRow({
      tableHeader: true,
      cantSplit: true,
      children: headerCells,
    })
  );

  // Body Rows
  rows.forEach((row, rIdx) => {
    const isAlt = rIdx % 2 === 1;
    const bg = isAlt ? COLORS.warmSurface : COLORS.white;

    const dataCells = row.map((cellText) => {
      return new TableCell({
        shading: { fill: bg },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.tan },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.tan },
          left: { style: BorderStyle.SINGLE, size: 4, color: COLORS.tan },
          right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.tan },
        },
        margins: { top: 100, bottom: 100, left: 140, right: 140 },
        children: [
          new Paragraph({
            spacing: { line: 260 },
            children: [
              new TextRun({
                text: String(cellText),
                size: 19,
                color: COLORS.espresso,
                font: 'Calibri',
              }),
            ],
          }),
        ],
      });
    });

    tableRows.push(
      new TableRow({
        cantSplit: true,
        children: dataCells,
      })
    );
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows,
  });
}

/**
 * Master DOCX Generator Function
 */
export async function generateDocx(outputPath = 'Espro_POS_System_Manual.docx') {
  console.log('Generating logo PNG from public/favicon.svg...');
  const logoBuffer = await generateLogoPng();

  console.log('Assembling Word Document structure...');

  // 1. Cover Page Section
  const coverCell = new TableCell({
    width: { size: 100, type: WidthType.PERCENTAGE },
    shading: { fill: COLORS.espresso },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
    },
    margins: { top: 1200, bottom: 1200, left: 800, right: 800 },
    children: [
      // Logo Badge Image
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 400 },
        children: [
          new ImageRun({
            data: logoBuffer,
            transformation: { width: 140, height: 140 },
          }),
        ],
      }),

      // Caramel Accent Rule
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 300 },
        children: [
          new TextRun({
            text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            color: COLORS.caramel,
            bold: true,
            size: 20,
          }),
        ],
      }),

      // Main Title
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 100 },
        children: [
          new TextRun({
            text: manualMeta.title,
            bold: true,
            size: 72, // 36pt
            color: COLORS.cream,
            font: 'Hanken Grotesk',
          }),
        ],
      }),

      // Subtitle
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 140 },
        children: [
          new TextRun({
            text: manualMeta.subtitle,
            bold: true,
            size: 44, // 22pt
            color: COLORS.caramel,
            font: 'Hanken Grotesk',
          }),
        ],
      }),

      // Tagline
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 600 },
        children: [
          new TextRun({
            text: manualMeta.tagline,
            italics: true,
            size: 26, // 13pt
            color: COLORS.tan,
            font: 'Calibri',
          }),
        ],
      }),

      // Spacer
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 400 },
        children: [
          new TextRun({
            text: '✦  ✦  ✦',
            color: COLORS.caramel,
            size: 24,
          }),
        ],
      }),

      // Guide Sub-line
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 100 },
        children: [
          new TextRun({
            text: manualMeta.guideSubtitle,
            bold: true,
            size: 26,
            color: COLORS.cream,
            font: 'Hanken Grotesk',
          }),
        ],
      }),

      // Metadata Block
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 40 },
        children: [
          new TextRun({
            text: `Version ${manualMeta.version}  ·  ${manualMeta.date}`,
            size: 22,
            color: COLORS.tan,
            font: 'Calibri',
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 40 },
        children: [
          new TextRun({
            text: manualMeta.preparedFor,
            bold: true,
            size: 22,
            color: COLORS.cream,
            font: 'Calibri',
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 200 },
        children: [
          new TextRun({
            text: `${manualMeta.currency}  ·  ${manualMeta.timezone}`,
            size: 20,
            color: COLORS.tan,
            font: 'Consolas',
          }),
        ],
      }),
    ],
  });

  const coverTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: [coverCell] })],
  });

  // 2. Document Control & TOC Section
  const docControlChildren = [];

  docControlChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 160 },
      children: [
        new TextRun({
          text: 'Document Control & Release Record',
          bold: true,
          size: 40,
          color: COLORS.espresso,
          font: 'Hanken Grotesk',
        }),
      ],
    })
  );

  docControlChildren.push(
    new Paragraph({
      spacing: { before: 0, after: 200 },
      children: [
        new TextRun({
          text: 'This official document establishes standard operating protocols, role permissions, and technical workflows for Espro POS. It must be maintained in store operations and reviewed during barista and cashier onboarding.',
          size: 21,
          color: COLORS.espresso,
          font: 'Calibri',
        }),
      ],
    })
  );

  // Document Control Table
  const controlTableHeaders = ['Parameter', 'Specification Details'];
  const controlTableRows = [
    ['Document Title', 'Espro POS – Retail & Cafe Operations Hub System Manual'],
    ['Document ID', documentControl.version ? 'ESPRO-MAN-2026-V1' : 'ESPRO-MAN-01'],
    ['Software Version', `Version ${documentControl.version} (React + Supabase Edition)`],
    ['Release Date', documentControl.releaseDate],
    ['Classification', documentControl.classification],
    ['Target Audience', documentControl.targetAudience],
    ['Currency & Timezone', `${manualMeta.currency}  |  ${manualMeta.timezone}`],
    ['Prepared By', documentControl.preparedBy],
    ['Approved By', documentControl.approvedBy],
  ];

  docControlChildren.push(createDataTable(controlTableHeaders, controlTableRows));

  docControlChildren.push(
    new Paragraph({
      spacing: { before: 300, after: 120 },
      children: [
        new TextRun({
          text: 'Revision & Audit History',
          bold: true,
          size: 28,
          color: COLORS.mocha,
          font: 'Hanken Grotesk',
        }),
      ],
    })
  );

  const revHeaders = ['Rev', 'Release Date', 'Author / Engineer', 'Summary of Changes'];
  const revRows = documentControl.revisions.map((r) => [r.version, r.date, r.author, r.notes]);
  docControlChildren.push(createDataTable(revHeaders, revRows));

  // Table of Contents Header & Native TOC Field
  docControlChildren.push(
    new Paragraph({
      pageBreakBefore: true,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 160 },
      children: [
        new TextRun({
          text: 'Table of Contents',
          bold: true,
          size: 40,
          color: COLORS.espresso,
          font: 'Hanken Grotesk',
        }),
      ],
    })
  );

  docControlChildren.push(
    new Paragraph({
      spacing: { before: 0, after: 200 },
      children: [
        new TextRun({
          text: 'Click on any heading below to navigate directly to that section in Microsoft Word.',
          size: 20,
          italics: true,
          color: COLORS.textMuted,
          font: 'Calibri',
        }),
      ],
    })
  );

  docControlChildren.push(
    new TableOfContents('Table of Contents', {
      hyperlink: true,
      headingStyleRange: '1-3',
    })
  );

  // 3. Body Section with Header & Footer
  const bodyHeader = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 0, after: 100 },
        children: [
          new TextRun({
            text: 'Espro POS – System Manual',
            bold: true,
            size: 18,
            color: COLORS.mocha,
            font: 'Hanken Grotesk',
          }),
          new TextRun({
            text: '          ·          Retail & Cafe Operations Hub',
            size: 17,
            color: COLORS.textMuted,
            font: 'Calibri',
          }),
        ],
        border: {
          bottom: {
            color: COLORS.tan,
            size: 6,
            style: BorderStyle.SINGLE,
            space: 4,
          },
        },
      }),
    ],
  });

  const bodyFooter = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 100, after: 0 },
        border: {
          top: {
            color: COLORS.tan,
            size: 6,
            style: BorderStyle.SINGLE,
            space: 4,
          },
        },
        children: [
          new TextRun({
            text: 'Confidential – Internal Use Only                    ',
            size: 17,
            color: COLORS.textMuted,
            font: 'Calibri',
          }),
          new TextRun({
            text: 'Page ',
            size: 17,
            color: COLORS.mocha,
            font: 'Calibri',
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            size: 17,
            color: COLORS.mocha,
            font: 'Calibri',
          }),
          new TextRun({
            text: ' of ',
            size: 17,
            color: COLORS.mocha,
            font: 'Calibri',
          }),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES],
            size: 17,
            color: COLORS.mocha,
            font: 'Calibri',
          }),
        ],
      }),
    ],
  });

  const bodyChildren = [];

  // Generate All 14 Chapters
  chapters.forEach((ch) => {
    // Heading 1 - Chapter Title (Always starts on a new page)
    bodyChildren.push(
      new Paragraph({
        pageBreakBefore: true,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 80 },
        children: [
          new TextRun({
            text: `Chapter ${ch.number} – ${ch.title}`,
            bold: true,
            size: 40, // 20pt
            color: COLORS.espresso,
            font: 'Hanken Grotesk',
          }),
        ],
        border: {
          bottom: {
            color: COLORS.mocha,
            size: 12,
            style: BorderStyle.SINGLE,
            space: 4,
          },
        },
      })
    );

    // Role Badge
    if (ch.roleBadge) {
      bodyChildren.push(createRoleBadge(ch.roleBadge));
    }

    // Purpose Callout / Meta
    bodyChildren.push(
      new Paragraph({
        spacing: { before: 80, after: 80 },
        children: [
          new TextRun({
            text: 'Purpose: ',
            bold: true,
            size: 21,
            color: COLORS.mocha,
            font: 'Calibri',
          }),
          new TextRun({
            text: ch.purpose,
            size: 21,
            color: COLORS.espresso,
            font: 'Calibri',
          }),
        ],
      })
    );

    bodyChildren.push(
      new Paragraph({
        spacing: { before: 0, after: 160 },
        children: [
          new TextRun({
            text: 'Where to find it: ',
            bold: true,
            size: 21,
            color: COLORS.mocha,
            font: 'Calibri',
          }),
          new TextRun({
            text: ch.whereToFind,
            size: 21,
            color: COLORS.espresso,
            font: 'Calibri',
          }),
        ],
      })
    );

    // Screen Overview
    bodyChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 180, after: 80 },
        children: [
          new TextRun({
            text: 'Screen Overview & Architecture',
            bold: true,
            size: 28, // 14pt
            color: COLORS.mocha,
            font: 'Hanken Grotesk',
          }),
        ],
      })
    );

    bodyChildren.push(
      new Paragraph({
        spacing: { before: 0, after: 180 },
        children: [
          new TextRun({
            text: ch.overview,
            size: 21,
            color: COLORS.espresso,
            font: 'Calibri',
          }),
        ],
      })
    );

    // Screenshot Placeholder
    if (ch.screenshot) {
      bodyChildren.push(createScreenshotBox(ch.screenshot.label, ch.screenshot.caption));
      bodyChildren.push(new Paragraph({ spacing: { before: 100, after: 100 }, children: [] }));
    }

    // Chapter Sub-sections
    if (ch.sections && ch.sections.length > 0) {
      ch.sections.forEach((sec) => {
        bodyChildren.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 80 },
            children: [
              new TextRun({
                text: sec.heading,
                bold: true,
                size: 28,
                color: COLORS.mocha,
                font: 'Hanken Grotesk',
              }),
            ],
          })
        );

        // Section Content
        if (sec.content) {
          const paragraphs = sec.content.split('\n\n');
          paragraphs.forEach((pText) => {
            bodyChildren.push(
              new Paragraph({
                spacing: { before: 0, after: 120 },
                children: [
                  new TextRun({
                    text: pText.trim(),
                    size: 21,
                    color: COLORS.espresso,
                    font: 'Calibri',
                  }),
                ],
              })
            );
          });
        }

        // Section Callouts
        if (sec.callouts && sec.callouts.length > 0) {
          sec.callouts.forEach((c) => {
            bodyChildren.push(createCalloutBox(c.type, c.title, c.content));
            bodyChildren.push(new Paragraph({ spacing: { before: 80, after: 80 }, children: [] }));
          });
        }

        // Section Table
        if (sec.table) {
          bodyChildren.push(createDataTable(sec.table.headers, sec.table.rows));
          bodyChildren.push(new Paragraph({ spacing: { before: 100, after: 100 }, children: [] }));
        }

        // Step-by-Step Tasks
        if (sec.tasks && sec.tasks.length > 0) {
          sec.tasks.forEach((task) => {
            bodyChildren.push(
              new Paragraph({
                heading: HeadingLevel.HEADING_3,
                spacing: { before: 160, after: 80 },
                children: [
                  new TextRun({
                    text: `Task: ${task.title}`,
                    bold: true,
                    size: 24,
                    color: COLORS.espresso,
                    font: 'Hanken Grotesk',
                  }),
                ],
              })
            );

            task.steps.forEach((step, sIdx) => {
              bodyChildren.push(
                new Paragraph({
                  spacing: { before: 20, after: 60 },
                  indent: { left: 360 },
                  children: [
                    new TextRun({
                      text: `${sIdx + 1}. `,
                      bold: true,
                      size: 21,
                      color: COLORS.mocha,
                      font: 'Consolas',
                    }),
                    new TextRun({
                      text: step,
                      size: 21,
                      color: COLORS.espresso,
                      font: 'Calibri',
                    }),
                  ],
                })
              );
            });

            if (task.expectedResult) {
              bodyChildren.push(
                createCalloutBox(
                  'TIP',
                  'Expected System Result',
                  task.expectedResult
                )
              );
              bodyChildren.push(
                new Paragraph({ spacing: { before: 80, after: 80 }, children: [] })
              );
            }
          });
        }
      });
    }
  });

  // Generate All 5 Appendices
  appendices.forEach((app, appIdx) => {
    bodyChildren.push(
      new Paragraph({
        pageBreakBefore: true,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 120 },
        children: [
          new TextRun({
            text: app.title,
            bold: true,
            size: 38,
            color: COLORS.espresso,
            font: 'Hanken Grotesk',
          }),
        ],
        border: {
          bottom: {
            color: COLORS.caramel,
            size: 12,
            style: BorderStyle.SINGLE,
            space: 4,
          },
        },
      })
    );

    if (app.content) {
      bodyChildren.push(
        new Paragraph({
          spacing: { before: 0, after: 160 },
          children: [
            new TextRun({
              text: app.content,
              size: 21,
              color: COLORS.espresso,
              font: 'Calibri',
            }),
          ],
        })
      );
    }

    if (app.table) {
      bodyChildren.push(createDataTable(app.table.headers, app.table.rows));
    }
  });

  // Construct Document
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Calibri',
            size: 21, // 10.5pt
            color: COLORS.espresso,
          },
          paragraph: {
            spacing: {
              line: 276, // 1.15 line spacing
              before: 0,
              after: 120,
            },
          },
        },
      },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            font: 'Hanken Grotesk',
            size: 40, // 20pt
            bold: true,
            color: COLORS.espresso,
          },
          paragraph: {
            spacing: { before: 240, after: 120 },
          },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            font: 'Hanken Grotesk',
            size: 28, // 14pt
            bold: true,
            color: COLORS.mocha,
          },
          paragraph: {
            spacing: { before: 200, after: 80 },
          },
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            font: 'Hanken Grotesk',
            size: 24, // 12pt
            bold: true,
            color: COLORS.espresso,
          },
          paragraph: {
            spacing: { before: 160, after: 60 },
          },
        },
      ],
    },
    sections: [
      // Section 1: Cover Page
      {
        properties: {
          page: {
            size: { width: A4_WIDTH_TWIPS, height: A4_HEIGHT_TWIPS },
            margin: { top: MARGIN_TWIPS, bottom: MARGIN_TWIPS, left: MARGIN_TWIPS, right: MARGIN_TWIPS },
          },
        },
        children: [coverTable],
      },

      // Section 2: Document Control & Table of Contents
      {
        properties: {
          page: {
            size: { width: A4_WIDTH_TWIPS, height: A4_HEIGHT_TWIPS },
            margin: { top: MARGIN_TWIPS, bottom: MARGIN_TWIPS, left: MARGIN_TWIPS, right: MARGIN_TWIPS },
          },
        },
        children: docControlChildren,
      },

      // Section 3: Main Manual Chapters & Appendices (With Header and Footer)
      {
        properties: {
          page: {
            size: { width: A4_WIDTH_TWIPS, height: A4_HEIGHT_TWIPS },
            margin: { top: MARGIN_TWIPS, bottom: MARGIN_TWIPS, left: MARGIN_TWIPS, right: MARGIN_TWIPS },
          },
        },
        headers: {
          default: bodyHeader,
        },
        footers: {
          default: bodyFooter,
        },
        children: bodyChildren,
      },
    ],
  });

  console.log(`Compiling Word document to ${outputPath}...`);
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  console.log(`Word manual successfully saved to ${outputPath} (${buffer.length} bytes).`);
  return outputPath;
}

if (process.argv[1]?.endsWith('generate-docx.mjs')) {
  generateDocx().catch((err) => {
    console.error('Error generating DOCX:', err);
    process.exit(1);
  });
}
