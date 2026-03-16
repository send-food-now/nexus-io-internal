// Generates a minimal valid PDF with sample resume text.
// Usage: node scripts/generate-test-pdf.mjs

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const resumeText = `ALEX CHEN
Senior Full-Stack Engineer | Singapore
alex.chen@email.com | github.com/alexchen

EXPERIENCE
Senior Software Engineer — Grab (2021–2024)
- Led migration of payment microservices from Node.js monolith to Go + gRPC
- Built real-time fraud detection system processing 50K transactions/sec using Kafka + Flink
- Mentored team of 5 junior engineers, ran weekly architecture reviews
- Reduced API latency by 40% via Redis caching + query optimization

Software Engineer — Shopee (2019–2021)
- Developed React + TypeScript seller dashboard serving 2M+ merchants
- Built CI/CD pipelines with GitHub Actions, Docker, Kubernetes
- Implemented A/B testing framework used across 3 product teams

EDUCATION
B.S. Computer Science — National University of Singapore (2019)

SKILLS
Languages: TypeScript, Python, Go, SQL
Frontend: React, Next.js, Tailwind CSS
Backend: Node.js, Express, FastAPI, gRPC
Data: PostgreSQL, Redis, Kafka, Apache Flink
Infra: AWS, Docker, Kubernetes, Terraform
AI/ML: PyTorch, LangChain, vector databases`;

// Build a minimal valid PDF containing the resume text
function buildPdf(text) {
  const lines = text.split('\n');
  const streamLines = lines.map((line, i) => {
    const escaped = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    return `BT /F1 10 Tf 50 ${800 - i * 14} Td (${escaped}) Tj ET`;
  }).join('\n');

  const stream = `${streamLines}`;
  const objects = [];

  // Obj 1: Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  // Obj 2: Pages
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
  // Obj 3: Page
  objects.push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj`);
  // Obj 4: Stream
  objects.push(`4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`);
  // Obj 5: Font
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj');

  let body = '';
  const offsets = [];
  let pos = '%PDF-1.4\n'.length;

  for (const obj of objects) {
    offsets.push(pos);
    const line = obj + '\n';
    body += line;
    pos += line.length;
  }

  const xrefStart = pos;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return '%PDF-1.4\n' + body + xref + trailer;
}

const pdfContent = buildPdf(resumeText);
const outPath = join(__dirname, '..', 'test', 'fixtures', 'sample-resume.pdf');
writeFileSync(outPath, pdfContent);
console.log(`Written to ${outPath} (${pdfContent.length} bytes)`);
