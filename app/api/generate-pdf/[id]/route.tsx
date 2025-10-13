import { getSubscriptionEntitlements } from '@/lib/subscriptions/permissions';
import type { SubscriptionTier } from '@/lib/subscriptions/plans';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Fetch change order with related data
    const { data: changeOrder, error } = await supabase
      .from('change_orders')
      .select(
        '*, requests(client_message, projects(name, client_name)), users(name, company_name, email, subscription_tier, subscription_status)'
      )
      .eq('id', id)
      .single();

    if (error || !changeOrder) {
      return NextResponse.json(
        { error: 'Change order not found' },
        { status: 404 }
      );
    }

    const entitlements = getSubscriptionEntitlements(
      changeOrder.users?.subscription_tier as
        | SubscriptionTier
        | null
        | undefined,
      changeOrder.users?.subscription_status as string | null | undefined
    );

    // Generate HTML for PDF
    const html = generatePDFHTML(changeOrder, entitlements.watermarkText);

    // Return HTML that will be rendered as PDF by the browser
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}

function generatePDFHTML(
  changeOrder: any,
  watermarkText: string | null
): string {
  const projectName = changeOrder.requests?.projects?.name || 'Project';
  const clientName = changeOrder.requests?.projects?.client_name || 'Client';
  const userName = changeOrder.users?.name || 'Service Provider';
  const companyName = changeOrder.users?.company_name || '';
  const date = new Date(changeOrder.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Change Order - ${changeOrder.title}</title>
  <style>
    @media print {
      body { margin: 0; }
      .no-print { display: none; }
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      background: white;
      position: relative;
      min-height: 100vh;
    }
    
    .header {
      border-bottom: 3px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 28px;
      color: #2563eb;
    }
    
    .header .subtitle {
      color: #666;
      font-size: 14px;
    }
    
    .section {
      margin-bottom: 30px;
    }
    
    .section h2 {
      font-size: 18px;
      color: #2563eb;
      margin-bottom: 10px;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 5px;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }
    
    .info-item {
      padding: 15px;
      background: #f9fafb;
      border-radius: 8px;
    }
    
    .info-item label {
      display: block;
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 5px;
    }
    
    .info-item .value {
      font-size: 18px;
      font-weight: 600;
      color: #1a1a1a;
    }
    
    .description {
      background: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      white-space: pre-wrap;
      line-height: 1.8;
    }
    
    .message-box {
      background: #eff6ff;
      border-left: 4px solid #2563eb;
      padding: 20px;
      border-radius: 4px;
      white-space: pre-wrap;
      line-height: 1.8;
    }
    
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #666;
      font-size: 12px;
    }
    
    .print-button {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 24px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
      z-index: 2;
    }
    
    .print-button:hover {
      background: #1d4ed8;
    }

    .watermark {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 0;
      opacity: 0.08;
      font-size: 72px;
      font-weight: 700;
      color: #1d4ed8;
      text-transform: uppercase;
      letter-spacing: 8px;
    }

    .watermark span {
      padding: 0.5rem 1.5rem;
      border-radius: 9999px;
      border: 2px solid currentColor;
      background: rgba(255, 255, 255, 0.6);
    }

    .document {
      position: relative;
      z-index: 1;
    }

    @media print {
      body {
        max-width: none;
        padding: 20px;
      }
      .watermark {
        opacity: 0.15;
      }
    }
  </style>
</head>
<body>
  ${
    watermarkText
      ? `<div class="watermark"><span>${watermarkText}</span></div>`
      : ''
  }
  <div class="document">
    <button class="print-button no-print" onclick="window.print()">Print / Save as PDF</button>
    
    <div class="header">
      <h1>CHANGE ORDER</h1>
      <div class="subtitle">
        ${companyName ? `${companyName} • ` : ''}${userName}<br>
        Date: ${date}
      </div>
    </div>
    
    <div class="section">
      <h2>Project Information</h2>
      <div class="info-grid">
        <div class="info-item">
          <label>Project</label>
          <div class="value">${projectName}</div>
        </div>
        <div class="info-item">
          <label>Client</label>
          <div class="value">${clientName}</div>
        </div>
      </div>
    </div>
    
    <div class="section">
      <h2>Change Order Details</h2>
      <h3 style="margin-bottom: 10px; font-size: 20px;">${
        changeOrder.title
      }</h3>
      <div class="description">${changeOrder.description}</div>
    </div>
    
    <div class="section">
      <h2>Estimate</h2>
      <div class="info-grid">
        <div class="info-item">
          <label>Estimated Hours</label>
          <div class="value">${changeOrder.estimated_hours} hours</div>
        </div>
        <div class="info-item">
          <label>Estimated Cost</label>
          <div class="value">$${changeOrder.estimated_cost}</div>
        </div>
      </div>
    </div>
    
    ${
      changeOrder.reply_message
        ? `
    <div class="section">
      <h2>Message to Client</h2>
      <div class="message-box">${changeOrder.reply_message}</div>
    </div>
    `
        : ''
    }
    
    <div class="footer">
      <p>Generated by ScopeSafe • ${new Date().toLocaleDateString()}</p>
      <p>This change order is subject to client approval and may be modified upon agreement.</p>
    </div>
  </div>
</body>
</html>
  `;
}
