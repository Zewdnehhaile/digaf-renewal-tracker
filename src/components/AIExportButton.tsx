import React from 'react';
import { Download, FileText, Sparkles } from 'lucide-react';
import { soundService } from '../services/sound';

interface AIExportButtonProps {
  title: string;
  textRaw: string;
  metadata?: Record<string, string>;
  label?: string;
  size?: 'xs' | 'sm' | 'md';
  isZewdneh?: boolean;
}

export default function AIExportButton({
  title,
  textRaw,
  metadata = {},
  label = "Export AI Intelligence",
  size = "xs",
  isZewdneh = false
}: AIExportButtonProps) {

  const parseTextToLines = (text: string): string[] => {
    return text.split('\n').map(l => l.trim()).filter(Boolean);
  };

  const handleExportJPG = () => {
    soundService.playSuccessChime();

    // Create high-res canvas
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1500;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill background with elegant off-white
    ctx.fillStyle = '#fafafb';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dynamic colorful perimeter border
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 16;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

    // Left structural color strip representing Digaf colors (Gold/Indigo)
    ctx.fillStyle = '#D97706'; // Premium Gold
    ctx.fillRect(16, 16, 10, canvas.height - 32);

    // Premium Slate Gradient Header Block
    const gradient = ctx.createLinearGradient(26, 16, canvas.width - 16, 165);
    gradient.addColorStop(0, '#0F172A'); // Slate 900
    gradient.addColorStop(0.5, '#1E1B4B'); // Indigo 950
    gradient.addColorStop(1, '#311042'); // Deep Purple/Plum
    ctx.fillStyle = gradient;
    ctx.fillRect(26, 16, canvas.width - 42, 150);

    // Golden indicator line under header
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(26, 166, canvas.width - 42, 4);

    // Header typography
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 26px "Inter", "Segoe UI", sans-serif';
    ctx.fillText('DIGAF MICROFINANCE INSTITUTION (MFI)', 60, 65);

    // System tag
    ctx.fillStyle = '#C4B5FD'; // Accent soft purple
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.fillText('✨ AUTOMATED INTEL & RENEWAL STRATEGIST SYSTEM', 60, 95);

    // Specific exported document title
    ctx.fillStyle = '#FCD34D'; // Bright gold
    ctx.font = 'bold 18px "Inter", sans-serif';
    ctx.fillText(title.toUpperCase(), 60, 135);

    // Metadata section box with soft blue background
    ctx.fillStyle = '#F1F5F9';
    ctx.fillRect(50, 195, canvas.width - 100, 75);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(50, 195, canvas.width - 100, 75);

    // Write metadata tags
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 12px "Inter", sans-serif';
    let metaX = 80;
    
    // Add default system timestamp if not exists
    const finalMetadata = {
      ...metadata,
      date: metadata.date || new Date().toLocaleString(),
      engine: 'Gemini AI Core'
    };

    Object.entries(finalMetadata).forEach(([k, v]) => {
      ctx.fillStyle = '#64748B';
      ctx.fillText(`${k.toUpperCase()}:`, metaX, 222);
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      ctx.fillText(`${v}`, metaX, 245);
      ctx.font = 'bold 12px "Inter", sans-serif';
      metaX += Math.max(180, (canvas.width - 160) / Object.keys(finalMetadata).length);
    });

    // Content renderer
    ctx.fillStyle = '#334155';
    let y = 310;
    const marginX = 80;
    const maxWidth = canvas.width - 160;
    const lines = parseTextToLines(textRaw);

    lines.forEach(line => {
      let isHeading = false;
      let textLineClean = line;

      // Handle custom headings logic (Markdown-like tags)
      if (line.startsWith('###') || line.startsWith('##') || line.startsWith('**') || line.endsWith(':')) {
        isHeading = true;
        textLineClean = line.replace(/[\*\#]/g, '').trim();
      }

      if (isHeading) {
        ctx.fillStyle = '#4F46E5'; // Rich royal indigo
        ctx.font = 'bold 17px "Inter", sans-serif';
        y += 15;
      } else {
        ctx.fillStyle = '#334155'; // Soft charcoal for reading
        ctx.font = 'normal 13.5px "Inter", sans-serif';
        
        // Add elegant circular dot for bullet records
        if (line.trim().startsWith('-') || line.trim().startsWith('•') || line.trim().startsWith('*')) {
          ctx.fillStyle = '#D97706'; // Gold bullet
          ctx.beginPath();
          ctx.arc(65, y + 6, 4, 0, 2 * Math.PI);
          ctx.fill();
          ctx.fillStyle = '#334155';
          textLineClean = line.replace(/^[\s\-\*•]+/, '').trim();
        }
      }

      // Word wrapping logic
      const words = textLineClean.split(' ');
      let currentLineOutput = '';

      for (let n = 0; n < words.length; n++) {
        const testLine = currentLineOutput ? `${currentLineOutput} ${words[n]}` : words[n];
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
          ctx.fillText(currentLineOutput, marginX, y);
          currentLineOutput = words[n];
          y += 22;
          if (y > canvas.height - 100) break; // Bounds check
        } else {
          currentLineOutput = testLine;
        }
      }
      
      ctx.fillText(currentLineOutput, marginX, y);
      y += isHeading ? 25 : 23;
    });

    // Legal disclaimer and stamp watermark block on footer
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(50, canvas.height - 75, canvas.width - 100, 1.5);

    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 10px "Inter", sans-serif';
    ctx.fillText('💼 DIGAF MFI ADMINISTRATIVE CONTROL BOARD — CONFIDENTIAL COUPLING', 50, canvas.height - 45);
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.fillText('VERIFIED SECURITY HEARTBEAT ONLINE', canvas.width - 320, canvas.height - 45);

    // Save as JPEG to user download folder
    const filename = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}.jpg`;
    const imageUrl = canvas.toDataURL('image/jpeg', 0.95);
    const downloadLink = document.createElement('a');
    downloadLink.download = filename;
    downloadLink.href = imageUrl;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const handleExportPDF = () => {
    soundService.playSuccessChime();

    // Compose a highly colourful and clear CSS/HTML layout
    const formattedHtml = `
      <html>
      <head>
        <title>${title}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@500;700&display=swap');
          
          body {
            font-family: 'Inter', sans-serif;
            color: #1e293b;
            background-color: #ffffff;
            margin: 0;
            padding: 40px;
            font-size: 13px;
            line-height: 1.6;
          }

          .border-wrapper {
            border: 8px solid #f1f5f9;
            border-left: 12px solid #d97706; /* Golden strip */
            padding: 30px;
            border-radius: 12px;
          }

          .header {
            background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%);
            color: white;
            padding: 35px 40px;
            border-radius: 8px;
            margin-bottom: 30px;
            border-bottom: 4px solid #f59e0b; /* Bright gold board */
            position: relative;
          }

          .header h1 {
            font-size: 22px;
            font-weight: 800;
            margin: 0 0 5px 0;
            letter-spacing: -0.025em;
          }

          .header .subtitle {
            font-family: 'JetBrains Mono', monospace;
            font-size: 10px;
            color: #c4b5fd;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 0.1em;
          }

          .header .doc-title {
            color: #fcd34d;
            font-size: 15px;
            font-weight: 600;
            margin-top: 15px;
            margin-bottom: 0;
          }

          .metadata-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 15px 25px;
            border-radius: 8px;
            margin-bottom: 35px;
          }

          .metadata-item {
            display: flex;
            flex-direction: column;
          }

          .metadata-label {
            font-size: 9px;
            font-weight: 800;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .metadata-value {
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
            font-weight: 700;
            color: #0f172a;
            margin-top: 4px;
          }

          .content-block {
            margin-bottom: 40px;
          }

          .content-line {
            margin-bottom: 14px;
          }

          .heading-line {
            font-size: 16px;
            font-weight: 800;
            color: #4f46e5;
            margin-top: 25px;
            margin-bottom: 10px;
            border-left: 3px solid #8b5cf6;
            padding-left: 10px;
          }

          .bullet-line {
            position: relative;
            padding-left: 20px;
          }

          .bullet-line::before {
            content: "•";
            position: absolute;
            left: 5px;
            color: #d97706;
            font-weight: 900;
            font-size: 16px;
            line-height: 1;
            top: -1px;
          }

          .footer {
            margin-top: 50px;
            border-top: 1.5px solid #e2e8f0;
            padding-top: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 10px;
            color: #94a3b8;
            font-weight: 600;
          }

          .footer .brand {
            font-family: 'JetBrains Mono', monospace;
          }

          /* Print directive to retain backgrounds, banners, and colorful layouts perfectly */
          @media print {
            body {
              padding: 0;
            }
            .border-wrapper {
              border: none;
              padding: 0;
            }
            .header {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%) !important;
            }
            .metadata-grid {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              background-color: #f8fafc !important;
            }
            .bullet-line::before {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <div class="border-wrapper">
          <div class="header">
            <h1>DIGAF MICROFINANCE INSTITUTION (MFI)</h1>
            <div class="subtitle">⚡ AUTOMATED INTEL & RENEWAL STRATEGIST SYSTEM</div>
            <div class="doc-title">${title.toUpperCase()}</div>
          </div>

          <div class="metadata-grid">
            <div class="metadata-item">
              <span class="metadata-label">Compiled Date</span>
              <span class="metadata-value">${metadata.date || new Date().toLocaleString()}</span>
            </div>
            <div class="metadata-item">
              <span class="metadata-label">Operator Requestor</span>
              <span class="metadata-value">${metadata.officer || 'Digaf Operator'}</span>
            </div>
            <div class="metadata-item">
               <span class="metadata-label font-sans">Core Intelligence Node</span>
              <span class="metadata-value">Gemini Core AI</span>
            </div>
          </div>

          <div class="content-block">
            ${textRaw.split('\n').map(line => {
              const trimmed = line.trim();
              if (!trimmed) return '';
              
              const isHeading = trimmed.startsWith('###') || trimmed.startsWith('##') || trimmed.startsWith('**') || trimmed.endsWith(':');
              const cleanText = trimmed.replace(/[\#\*]/g, '');

              if (isHeading) {
                return `<div class="heading-line">${cleanText}</div>`;
              } else if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('*')) {
                const innerText = trimmed.replace(/^[\s\-\*•]+/, '');
                return `<div class="content-line bullet-line">${innerText}</div>`;
              } else {
                return `<div class="content-line">${trimmed}</div>`;
              }
            }).join('')}
          </div>

          <div class="footer">
            <span>💼 CONFIDENTIAL COUPLING — ADMINISTRATIVE USE ONLY</span>
            <span class="brand">DIGAF SECURE HEARTBEAT SYSTEM</span>
          </div>
        </div>

        <script>
          // Automatically launch browser print layout once outside iframe sandbox
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 600);
          };
        </script>
      </body>
      </html>
    `;

    // 1. Direct File download of the printable document - 100% secure & functional in every sandboxed iframe environment
    const blob = new Blob([formattedHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const cleanFileName = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_report.html`;
    
    const downloadLink = document.createElement('a');
    downloadLink.download = cleanFileName;
    downloadLink.href = url;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);

    // 2. Fallback: also try triggering in-iframe print
    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(formattedHtml);
        doc.close();

        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (e) {
            console.warn("Iframe direct print limited by sandbox policy.", e);
          }
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 1000);
        }, 500);
      }
    } catch (err) {
      console.warn("Print frame deployment exception", err);
    }
  };

  const getButtonPadding = () => {
    if (size === 'xs') return 'p-1 px-2 text-[9.5px] rounded-md';
    if (size === 'sm') return 'p-1.5 px-3 text-[10.5px] rounded-lg';
    return 'p-2 px-4 text-xs rounded-xl';
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2 font-sans select-none">
      <button
        onClick={handleExportPDF}
        className={`${getButtonPadding()} bg-linear-to-r from-red-600 to-rose-500 hover:brightness-105 active:scale-95 text-white font-extrabold shadow-sm flex items-center gap-1 cursor-pointer transition-all border-none`}
        title="Print or Save as high fidelity colorful vector PDF"
      >
        <FileText className="w-3.5 h-3.5 shrink-0" />
        PDF
      </button>

      {isZewdneh && (
        <button
          onClick={handleExportJPG}
          className={`${getButtonPadding()} bg-linear-to-r from-[#8B5CF6] to-[#C4B5FD] hover:brightness-105 active:scale-95 text-white font-extrabold shadow-sm flex items-center gap-1 cursor-pointer transition-all border-none`}
          title="Download high-resolution colourful JPEG file"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          JPG
        </button>
      )}

      <span className="text-[8px] text-slate-400 font-mono flex items-center gap-1 font-bold ml-1 uppercase">
        <Sparkles className="w-2.5 h-2.5 text-[#8B5CF6]" />
        Hi-Res AI Output
      </span>
    </div>
  );
}
