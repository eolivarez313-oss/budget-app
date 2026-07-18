import { supabase } from './supabase'
import { Paystub, PaystubJob } from '../types'

// ── Jobs ──────────────────────────────────────────────────────────────────────

export async function loadJobs(userId: string): Promise<PaystubJob[]> {
  const { data, error } = await supabase
    .from('paystub_jobs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at')
  if (error) throw error
  return (data || []).map(r => ({
    id: r.id,
    employerName: r.employer_name,
    isActive: r.is_active,
    payFrequency: r.pay_frequency ?? undefined,
    createdAt: r.created_at,
  }))
}

export async function upsertJob(job: PaystubJob, userId: string): Promise<PaystubJob> {
  const { data, error } = await supabase
    .from('paystub_jobs')
    .upsert({
      id: job.id || undefined,
      user_id: userId,
      employer_name: job.employerName,
      is_active: job.isActive,
      pay_frequency: job.payFrequency ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return { id: data.id, employerName: data.employer_name, isActive: data.is_active, createdAt: data.created_at }
}

export async function deleteJob(id: string) {
  await supabase.from('paystub_jobs').delete().eq('id', id)
}

// ── Paystubs ──────────────────────────────────────────────────────────────────

export async function loadPaystubs(userId: string): Promise<Paystub[]> {
  const { data, error } = await supabase
    .from('paystubs')
    .select('*')
    .eq('user_id', userId)
    .order('pay_date', { ascending: false })
  if (error) throw error
  return (data || []).map(mapRow)
}

export async function savePaystub(p: Paystub, userId: string): Promise<Paystub> {
  const { data, error } = await supabase
    .from('paystubs')
    .upsert({
      id: p.id || undefined,
      user_id: userId,
      job_id: p.jobId ?? null,
      employer_name: p.employerName ?? null,
      pay_date: p.payDate ?? null,
      period_start: p.periodStart ?? null,
      period_end: p.periodEnd ?? null,
      gross_pay: p.grossPay ?? null,
      federal_tax: p.federalTax ?? null,
      state_tax: p.stateTax ?? null,
      social_security: p.socialSecurity ?? null,
      medicare: p.medicare ?? null,
      net_pay: p.netPay ?? null,
      ytd_gross: p.ytdGross ?? null,
      ytd_federal_tax: p.ytdFederalTax ?? null,
      ytd_state_tax: p.ytdStateTax ?? null,
      ytd_social_security: p.ytdSocialSecurity ?? null,
      ytd_medicare: p.ytdMedicare ?? null,
      ytd_net: p.ytdNet ?? null,
      pre_tax_deductions: p.preTaxDeductions,
      post_tax_deductions: p.postTaxDeductions,
      pto_accrued: p.ptoAccrued ?? null,
      pto_used: p.ptoUsed ?? null,
      pto_remaining: p.ptoRemaining ?? null,
      raw_text: p.rawText ?? null,
      is_confirmed: p.isConfirmed ?? false,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()
  if (error) throw error
  return mapRow(data)
}

export async function deletePaystub(id: string) {
  await supabase.from('paystubs').delete().eq('id', id)
}

function mapRow(r: any): Paystub {
  return {
    id: r.id,
    jobId: r.job_id ?? undefined,
    employerName: r.employer_name ?? undefined,
    payDate: r.pay_date ?? undefined,
    periodStart: r.period_start ?? undefined,
    periodEnd: r.period_end ?? undefined,
    grossPay: r.gross_pay != null ? Number(r.gross_pay) : undefined,
    federalTax: r.federal_tax != null ? Number(r.federal_tax) : undefined,
    stateTax: r.state_tax != null ? Number(r.state_tax) : undefined,
    socialSecurity: r.social_security != null ? Number(r.social_security) : undefined,
    medicare: r.medicare != null ? Number(r.medicare) : undefined,
    netPay: r.net_pay != null ? Number(r.net_pay) : undefined,
    ytdGross: r.ytd_gross != null ? Number(r.ytd_gross) : undefined,
    ytdFederalTax: r.ytd_federal_tax != null ? Number(r.ytd_federal_tax) : undefined,
    ytdStateTax: r.ytd_state_tax != null ? Number(r.ytd_state_tax) : undefined,
    ytdSocialSecurity: r.ytd_social_security != null ? Number(r.ytd_social_security) : undefined,
    ytdMedicare: r.ytd_medicare != null ? Number(r.ytd_medicare) : undefined,
    ytdNet: r.ytd_net != null ? Number(r.ytd_net) : undefined,
    preTaxDeductions: r.pre_tax_deductions ?? [],
    postTaxDeductions: r.post_tax_deductions ?? [],
    ptoAccrued: r.pto_accrued != null ? Number(r.pto_accrued) : undefined,
    ptoUsed: r.pto_used != null ? Number(r.pto_used) : undefined,
    ptoRemaining: r.pto_remaining != null ? Number(r.pto_remaining) : undefined,
    rawText: r.raw_text ?? undefined,
    isConfirmed: r.is_confirmed ?? false,
    createdAt: r.created_at ?? undefined,
  }
}
