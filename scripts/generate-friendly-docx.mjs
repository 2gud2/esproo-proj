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
import { manualMeta, documentControl, chapters, appendices } from './friendly-content.mjs';

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
  screenshotBg: 'FDFBF7',
};

const A4_WIDTH_TWIPS = 11906;
const A4_HEIGHT_TWIPS = 16838;
const MARGIN_TWIPS = 1247; // 2.2 cm
const CONTENT_WIDTH_TWIPS = A4_WIDTH_TWIPS - MARGIN_TWIPS * 2; // 9412 twips

function createCalloutBox(type, title, content) {
  let borderColor = COLORS.info;
  let bgFill = 'EDF4F8';
  let titleColor = COLORS.info;

  if (type === 'TIP') {
    borderColor = COLORS.success;
    bgFill = 'EBF5F0';
    titleColor = COLORS.success;
  } else if (type === 'WARNING') {
    borderColor = COLORS.warning;
    bgFill = 'FDF4ED';
    titleColor = COLORS.warning;
  }

  return new Table({
    width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      left: { style: BorderStyle.SINGLE, size: 24, color: borderColor },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
            shading: { fill: bgFill, type: ShadingType.CLEAR },
            margins: { top: 140, bottom: 140, left: 180, right: 180 },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 60 },
                children: [
                  new TextRun({
                    text: `${type}: ${title}`,
                    bold: true,
                    size: 20,
                    color: titleColor,
                    font: 'Calibri',
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
          }),
        ],
      }),
    ],
  });
}

function createScreenshotBox(label, caption) {
  return new Table({
    width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.DASHED, size: 12, color: COLORS.caramel },
      bottom: { style: BorderStyle.DASHED, size: 12, color: COLORS.caramel },
      left: { style: BorderStyle.DASHED, size: 12, color: COLORS.caramel },
      right: { style: BorderStyle.DASHED, size: 12, color: COLORS.caramel },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
            shading: { fill: COLORS.screenshotBg, type: ShadingType.CLEAR },
            margins: { top: 200, bottom: 200, left: 240, right: 240 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 20, after: 60 },
                children: [
                  new TextRun({
                    text: 'SYSTEM SCREENSHOT PLACEHOLDER',
                    bold: true,
                    size: 18,
                    color: COLORS.mocha,
                    font: 'Calibri',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 60 },
                children: [
                  new TextRun({
                    text: `[ ${label} ]`,
                    bold: true,
                    size: 21,
                    color: COLORS.espresso,
                    font: 'Calibri',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 140, after: 140 },
                children: [
                  new TextRun({
                    text: '( Paste UI Screenshot Here )',
                    color: COLORS.tan,
                    size: 20,
                    font: 'Consolas',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 20 },
                children: [
                  new TextRun({
                    text: caption,
                    italics: true,
                    size: 18,
                    color: COLORS.mocha,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function createDataTable(headers, rows) {
  const colCount = headers.length;
  const colWidth = Math.floor(CONTENT_WIDTH_TWIPS / colCount);

  const headerCells = headers.map(
    (h) =>
      new TableCell({
        width: { size: colWidth, type: WidthType.DXA },
        shading: { fill: COLORS.mocha, type: ShadingType.CLEAR },
        margins: { top: 140, bottom: 140, left: 140, right: 140 },
        children: [
          new Paragraph({
            spacing: { before: 0, after: 0 },
            children: [
              new TextRun({
                text: h,
                bold: true,
                size: 19,
                color: COLORS.white,
                font: 'Calibri',
              }),
            ],
          }),
        ],
      })
  );

  const tableRows = [new TableRow({ children: headerCells, tableHeader: true })];

  rows.forEach((row, rIdx) => {
    const bgFill = rIdx % 2 === 0 ? COLORS.white : COLORS.warmSurface;
    const cells = row.map(
      (cellText) =>
        new TableCell({
          width: { size: colWidth, type: WidthType.DXA },
          shading: { fill: bgFill, type: ShadingType.CLEAR },
          margins: { top: 100, bottom: 100, left: 120, right: 120 },
          children: [
            new Paragraph({
              spacing: { before: 0, after: 0 },
              children: [
                new TextRun({
                  text: cellText,
                  size: 18,
                  color: COLORS.espresso,
                  font: 'Calibri',
                }),
              ],
            }),
          ],
        })
    );
    tableRows.push(new TableRow({ children: cells }));
  });

  return new Table({
    width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.tan },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.tan },
      left: { style: BorderStyle.SINGLE, size: 4, color: COLORS.tan },
      right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.tan },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: COLORS.tan },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: COLORS.tan },
    },
    rows: tableRows,
  });
}

export async function generateDocx(outputPath = './Espro_POS_System_Manual.docx') {
  console.log('Generating logo PNG from public/favicon.svg...');
  const svgPath = path.resolve('public/favicon.svg');
  const svgBuffer = fs.readFileSync(svgPath);
  const logoPngBuffer = await sharp(svgBuffer)
    .resize(200, 200)
    .composite([
      {
        input: Buffer.from(
          `<svg width="200" height="200"><circle cx="100" cy="100" r="96" fill="#F3E9D7" stroke="#C08F5E" stroke-width="6"/></svg>`
        ),
        blend: 'dest-over',
      },
    ])
    .png()
    .toBuffer();

  console.log('Assembling Word Document structure...');

  // Cover Page
  const coverTable = new Table({
    width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
            shading: { fill: COLORS.espresso, type: ShadingType.CLEAR },
            margins: { top: 900, bottom: 900, left: 700, right: 700 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 240 },
                children: [
                  new ImageRun({
                    data: logoPngBuffer,
                    transformation: { width: 90, height: 90 },
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 100, after: 60 },
                children: [
                  new TextRun({
                    text: 'ESPRO POS',
                    bold: true,
                    size: 54,
                    color: COLORS.cream,
                    font: 'Hanken Grotesk',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 180 },
                children: [
                  new TextRun({
                    text: 'RETAIL & CAFE OPERATIONS HUB',
                    size: 22,
                    color: COLORS.caramel,
                    font: 'Hanken Grotesk',
                    bold: true,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 80 },
                children: [
                  new TextRun({
                    text: 'System User Manual',
                    bold: true,
                    size: 40,
                    color: COLORS.white,
                    font: 'Hanken Grotesk',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 240 },
                children: [
                  new TextRun({
                    text: 'Store Operations & Training Guide',
                    size: 24,
                    color: COLORS.caramel,
                    font: 'Calibri',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 300, after: 40 },
                children: [
                  new TextRun({
                    text: 'Version 1.0  •  October 2026',
                    size: 20,
                    color: COLORS.cream,
                    font: 'Calibri',
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({
                    text: 'Prepared for: Espro Coffee & Tea',
                    size: 20,
                    color: COLORS.cream,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // Section 2: Document Control & Table of Contents
  const docControlChildren = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 0, after: 140 },
      children: [
        new TextRun({
          text: 'Document Control & System Information',
          bold: true,
          size: 36,
          color: COLORS.espresso,
          font: 'Hanken Grotesk',
        }),
      ],
      border: {
        bottom: { color: COLORS.mocha, size: 12, style: BorderStyle.SINGLE, space: 4 },
      },
    }),
    new Paragraph({
      spacing: { before: 120, after: 140 },
      children: [
        new TextRun({
          text: documentControl.purpose,
          size: 21,
          color: COLORS.espresso,
          font: 'Calibri',
        }),
      ],
    }),
    createDataTable(
      ['Document Property', 'Details'],
      [
        ['System Title', manualMeta.title + ' – ' + manualMeta.tagline],
        ['Manual Version', documentControl.version],
        ['Publication Date', documentControl.date],
        ['Intended Audience', documentControl.audience],
        ['Review & Status', documentControl.reviewStatus],
        ['Primary Currency & Time', 'Philippine Peso (₱) | Asia/Manila (PHT)'],
      ]
    ),
    new Paragraph({ spacing: { before: 240, after: 140 }, children: [] }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 140 },
      children: [
        new TextRun({
          text: 'Table of Contents',
          bold: true,
          size: 36,
          color: COLORS.espresso,
          font: 'Hanken Grotesk',
        }),
      ],
      border: {
        bottom: { color: COLORS.mocha, size: 12, style: BorderStyle.SINGLE, space: 4 },
      },
    }),
    new TableOfContents('Table of Contents', {
      hyperlink: true,
      headingStyleRange: '1-3',
    }),
  ];

  // Header and Footer
  const bodyHeader = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 0, after: 80 },
        border: {
          bottom: { color: COLORS.tan, size: 6, style: BorderStyle.SINGLE, space: 4 },
        },
        children: [
          new TextRun({
            text: 'Espro POS – System User Manual                    ',
            size: 17,
            color: COLORS.mocha,
            font: 'Calibri',
            bold: true,
          }),
          new TextRun({
            text: 'Retail & Cafe Operations Hub',
            size: 17,
            color: COLORS.textMuted,
            font: 'Calibri',
          }),
        ],
      }),
    ],
  });

  const bodyFooter = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 80, after: 0 },
        border: {
          top: { color: COLORS.tan, size: 6, style: BorderStyle.SINGLE, space: 4 },
        },
        children: [
          new TextRun({
            text: 'Confidential – Internal Store Operations                    ',
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

  // Generate All Chapters
  chapters.forEach((ch) => {
    bodyChildren.push(
      new Paragraph({
        pageBreakBefore: true,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 80 },
        children: [
          new TextRun({
            text: `Chapter ${ch.number} – ${ch.title}`,
            bold: true,
            size: 38,
            color: COLORS.espresso,
            font: 'Hanken Grotesk',
          }),
          new TextRun({
            text: `   [ ${ch.roleBadge} ]`,
            bold: true,
            size: 20,
            color: ch.roleBadge === 'ADMIN ONLY' ? COLORS.mocha : COLORS.success,
            font: 'Calibri',
          }),
        ],
        border: {
          bottom: { color: COLORS.mocha, size: 12, style: BorderStyle.SINGLE, space: 4 },
        },
      })
    );

    bodyChildren.push(
      new Paragraph({
        spacing: { before: 80, after: 40 },
        children: [
          new TextRun({ text: 'Purpose: ', bold: true, size: 21, color: COLORS.mocha, font: 'Calibri' }),
          new TextRun({ text: ch.purpose, size: 21, color: COLORS.espresso, font: 'Calibri' }),
        ],
      })
    );
    bodyChildren.push(
      new Paragraph({
        spacing: { before: 0, after: 140 },
        children: [
          new TextRun({ text: 'Where to find it: ', bold: true, size: 21, color: COLORS.mocha, font: 'Calibri' }),
          new TextRun({ text: ch.whereToFind, size: 21, color: COLORS.espresso, font: 'Calibri' }),
        ],
      })
    );

    bodyChildren.push(
      new Paragraph({
        spacing: { before: 60, after: 140 },
        children: [
          new TextRun({ text: ch.overview, size: 21, color: COLORS.espresso, font: 'Calibri' }),
        ],
      })
    );

    if (ch.screenshot) {
      bodyChildren.push(createScreenshotBox(ch.screenshot.label, ch.screenshot.caption));
      bodyChildren.push(new Paragraph({ spacing: { before: 100, after: 100 }, children: [] }));
    }

    if (ch.sections && ch.sections.length > 0) {
      ch.sections.forEach((sec) => {
        bodyChildren.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 180, after: 60 },
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

        if (sec.content) {
          const paragraphs = sec.content.split('\n\n');
          paragraphs.forEach((pText) => {
            bodyChildren.push(
              new Paragraph({
                spacing: { before: 0, after: 100 },
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

        if (sec.callouts && sec.callouts.length > 0) {
          sec.callouts.forEach((c) => {
            bodyChildren.push(createCalloutBox(c.type, c.title, c.content));
            bodyChildren.push(new Paragraph({ spacing: { before: 60, after: 60 }, children: [] }));
          });
        }

        if (sec.table) {
          bodyChildren.push(createDataTable(sec.table.headers, sec.table.rows));
          bodyChildren.push(new Paragraph({ spacing: { before: 80, after: 80 }, children: [] }));
        }

        if (sec.tasks && sec.tasks.length > 0) {
          sec.tasks.forEach((task) => {
            bodyChildren.push(
              new Paragraph({
                heading: HeadingLevel.HEADING_3,
                spacing: { before: 140, after: 60 },
                children: [
                  new TextRun({
                    text: `Procedure: ${task.title}`,
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
                  spacing: { before: 20, after: 50 },
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
                  'Expected Result',
                  task.expectedResult
                )
              );
              bodyChildren.push(new Paragraph({ spacing: { before: 60, after: 60 }, children: [] }));
            }
          });
        }
      });
    }
  });

  appendices.forEach((app) => {
    bodyChildren.push(
      new Paragraph({
        pageBreakBefore: true,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 100 },
        children: [
          new TextRun({
            text: `Appendix ${app.letter} – ${app.title}`,
            bold: true,
            size: 36,
            color: COLORS.espresso,
            font: 'Hanken Grotesk',
          }),
        ],
        border: {
          bottom: { color: COLORS.caramel, size: 12, style: BorderStyle.SINGLE, space: 4 },
        },
      })
    );

    if (app.content) {
      bodyChildren.push(
        new Paragraph({
          spacing: { before: 60, after: 120 },
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

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Calibri',
            size: 21,
            color: COLORS.espresso,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: A4_WIDTH_TWIPS, height: A4_HEIGHT_TWIPS },
            margin: { top: MARGIN_TWIPS, bottom: MARGIN_TWIPS, left: MARGIN_TWIPS, right: MARGIN_TWIPS },
          },
        },
        children: [coverTable],
      },
      {
        properties: {
          page: {
            size: { width: A4_WIDTH_TWIPS, height: A4_HEIGHT_TWIPS },
            margin: { top: MARGIN_TWIPS, bottom: MARGIN_TWIPS, left: MARGIN_TWIPS, right: MARGIN_TWIPS },
          },
        },
        children: docControlChildren,
      },
      {
        properties: {
          page: {
            size: { width: A4_WIDTH_TWIPS, height: A4_HEIGHT_TWIPS },
            margin: { top: MARGIN_TWIPS, bottom: MARGIN_TWIPS, left: MARGIN_TWIPS, right: MARGIN_TWIPS },
          },
        },
        headers: { default: bodyHeader },
        footers: { default: bodyFooter },
        children: bodyChildren,
      },
    ],
  });

  console.log(`Writing Word manual to ${outputPath}...`);
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  console.log(`Word manual saved successfully to ${outputPath} (${buffer.length} bytes).`);
  return outputPath;
}

if (process.argv[1]?.endsWith('generate-friendly-docx.mjs')) {
  generateDocx().catch((err) => {
    console.error('Error generating DOCX:', err);
    process.exit(1);
  });
}
