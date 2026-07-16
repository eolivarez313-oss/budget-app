import { supabase } from './supabase'

export interface PlaidItem {
  id: string
  plaid_item_id: string
  institution_name: string
  last_synced_at: string | null
  error_code: string | null
  created_at: string
  plaid_accounts: PlaidLinkedAccount[]
}

export interface PlaidLinkedAccount {
  id: string
  plaid_account_id: string
  name: string
  type: string
  subtype: string | null
  mask: string | null
  balance_current: number | null
  balance_available: number | null
  last_synced_at: string | null
}

export interface SyncResult {
  added: number
  modified: number
  removed: number
}

export async function createLinkToken(): Promise<string> {
  const { data, error } = await supabase.functions.invoke('plaid-create-link-token')
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data.link_token as string
}

export async function exchangeToken(
  publicToken: string,
  metadata: { institution?: { institution_id?: string; name?: string } | null }
): Promise<void> {
  const { data, error } = await supabase.functions.invoke('plaid-exchange-token', {
    body: {
      public_token: publicToken,
      institution_id: metadata.institution?.institution_id ?? null,
      institution_name: metadata.institution?.name ?? 'Unknown Bank',
    },
  })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
}

export async function syncPlaidData(): Promise<SyncResult> {
  const { data, error } = await supabase.functions.invoke('plaid-sync')
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data as SyncResult
}

export async function syncInvestments(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('plaid-sync-investments')
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
}

export async function unlinkPlaidItem(plaidItemId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('plaid-unlink', {
    body: { plaid_item_id: plaidItemId },
  })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
}

export async function getLinkedItems(): Promise<PlaidItem[]> {
  const { data, error } = await supabase
    .from('plaid_items')
    .select('*, plaid_accounts(*)')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as PlaidItem[]
}
