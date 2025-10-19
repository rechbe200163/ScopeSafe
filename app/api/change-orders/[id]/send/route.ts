import { NextResponse } from 'next/server';
import { Resend } from 'resend';

import type { LifetimeTier } from '@/lib/lifetime';
import { getSubscriptionEntitlements } from '@/lib/subscriptions/permissions';
import type { SubscriptionTier } from '@/lib/subscriptions/plans';
import { createClient } from '@/lib/supabase/server';

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL;

const resend = resendApiKey ? new Resend(resendApiKey) : null;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCurrency(value?: number | string | null) {
  const amount = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatHours(value?: number | string | null) {
  const hours = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (!Number.isFinite(hours)) return 'N/A';
  return `${Number(hours).toFixed(1)} hours`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!resend || !resendFromEmail) {
      return NextResponse.json(
        {
          error:
            'Email provider not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.',
        },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: changeOrder, error } = await supabase
      .from('change_orders')
      .select(
        '*, requests(client_message, projects(name, client_name, client_email, client_phone)), users(name, company_name, email, subscription_tier, subscription_status, lifetime_tier)'
      )
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !changeOrder) {
      return NextResponse.json(
        { error: 'Change order not found' },
        { status: 404 }
      );
    }

    const entitlements = getSubscriptionEntitlements(
      changeOrder.users?.subscription_tier as SubscriptionTier | null | undefined,
      changeOrder.users?.subscription_status as string | null | undefined,
      {
        lifetimeTier: changeOrder.users?.lifetime_tier as LifetimeTier | null | undefined,
      }
    );

    if (!entitlements.canSendEmails) {
      return NextResponse.json(
        {
          error:
            'Your current plan does not include automatic emails. Upgrade to unlock this feature.',
        },
        { status: 403 }
      );
    }

    const project = changeOrder.requests?.projects;
    const clientEmail = project?.client_email;

    if (!clientEmail) {
      return NextResponse.json(
        {
          error:
            'Client email is missing. Update the project with a client email before sending.',
        },
        { status: 400 }
      );
    }

    const origin =
      request.headers.get('origin') ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000';
    const pdfUrl = `${origin}/api/generate-pdf/${id}`;
    const dashboardUrl = `${origin}/dashboard/change-orders/${id}`;

    const replyMessage = changeOrder.reply_message || '';
    const escapedMessage = escapeHtml(replyMessage).replace(/\n/g, '<br />');

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1f2937; padding: 24px;">
        <h1 style="font-size: 20px; margin-bottom: 16px;">${
          changeOrder.title
        }</h1>
        <p style="margin-bottom: 16px;">Hello ${
          project?.client_name || 'there'
        },</p>
        ${
          replyMessage
            ? `<div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 14px; line-height: 1.6;">${escapedMessage}</p>
              </div>`
            : ''
        }
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 16px; margin-bottom: 8px;">Change Order Summary</h2>
          <ul style="padding-left: 16px; margin: 0; font-size: 14px; line-height: 1.6;">
            <li><strong>Project:</strong> ${project?.name || 'Project'}</li>
            <li><strong>Estimated Hours:</strong> ${formatHours(
              changeOrder.estimated_hours
            )}</li>
            <li><strong>Estimated Cost:</strong> ${formatCurrency(
              changeOrder.estimated_cost
            )}</li>
          </ul>
        </div>
        <div style="margin-bottom: 24px;">
          <a href="${pdfUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 10px 16px; border-radius: 6px; text-decoration: none; font-weight: 500;">View Change Order PDF</a>
          <p style="font-size: 12px; color: #6b7280; margin-top: 8px;">You can also review the change order online <a href="${dashboardUrl}" style="color: #2563eb;">here</a>.</p>
        </div>
        <p style="margin-top: 24px; font-size: 14px;">Thank you,<br/>${
          changeOrder.users?.name || 'Your project team'
        }</p>
      </div>
    `;

    const text = [
      `Hello ${project?.client_name || 'there'},`,
      '',
      replyMessage,
      '',
      `Project: ${project?.name || 'Project'}`,
      `Estimated Hours: ${formatHours(changeOrder.estimated_hours)}`,
      `Estimated Cost: ${formatCurrency(changeOrder.estimated_cost)}`,
      '',
      `View the change order PDF: ${pdfUrl}`,
      `Review online: ${dashboardUrl}`,
      '',
      `Thank you,`,
      changeOrder.users?.name || 'Your project team',
    ]
      .filter(Boolean)
      .join('\n');

    await resend.emails.send({
      from: resendFromEmail,
      to: clientEmail,
      subject: `${project?.name || 'Project'} - Change Order`,
      html,
      text,
    });

    await supabase
      .from('change_orders')
      .update({ status: 'sent', updated_at: new Date().toISOString() })
      .eq('id', id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Change order email error:', error);
    return NextResponse.json(
      { error: 'Failed to send change order email' },
      { status: 500 }
    );
  }
}
