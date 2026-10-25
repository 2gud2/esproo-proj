// ─── Master User-Friendly Manual Generator for Espro POS ───
import fs from 'fs';
import path from 'path';
import { generateDocx } from './generate-friendly-docx.mjs';
import { generatePdf } from './generate-friendly-pdf.mjs';

async function main() {
  console.log('================================================================');
  console.log('   ESPRO POS – USER-FRIENDLY SYSTEM MANUAL COMPILATION          ');
  console.log('   (Plain English, No IT Jargon, With Screenshot Spaces)        ');
  console.log('================================================================\n');

  const rootDir = path.resolve('.');
  const docxTarget = path.join(rootDir, 'Espro_POS_System_Manual.docx');
  const pdfTarget = path.join(rootDir, 'Espro_POS_System_Manual.pdf');

  console.log(`[1/3] Generating User-Friendly Word Document (.docx)...`);
  await generateDocx(docxTarget);
  const docxStats = fs.statSync(docxTarget);
  console.log(`✓ Word document updated: ${docxTarget} (${(docxStats.size / 1024).toFixed(1)} KB)\n`);

  console.log(`[2/3] Generating User-Friendly Print-Ready PDF (.pdf)...`);
  const pdfResult = await generatePdf(pdfTarget);
  const pdfStats = fs.statSync(pdfTarget);
  console.log(`✓ PDF document updated: ${pdfTarget} (${(pdfStats.size / 1024).toFixed(1)} KB, ${pdfResult.pageCount} pages)\n`);

  console.log(`[3/3] Verifying Output Deliverables in Project Root...`);
  const docxExists = fs.existsSync(docxTarget);
  const pdfExists = fs.existsSync(pdfTarget);

  if (docxExists && pdfExists) {
    console.log('================================================================');
    console.log('✓ SUCCESS: BOTH USER-FRIENDLY DELIVERABLES READY IN PROJECT ROOT:');
    console.log(`  1. ${docxTarget} (${docxStats.size} bytes)`);
    console.log(`  2. ${pdfTarget} (${pdfStats.size} bytes, ${pdfResult.pageCount} pages)`);
    console.log('================================================================\n');
  } else {
    console.error('ERROR: One or more deliverables could not be found.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal compilation error:', err);
  process.exit(1);
});
