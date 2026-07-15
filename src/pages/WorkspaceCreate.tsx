import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Plus, Trash2, Users, User, Check } from 'lucide-react'
import { useStore, makeWorkspace } from '../store/useStore'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input, Field, Select } from '../components/ui/Input'
import { getInitialData } from '../store/initialData'
import { uuid } from '../utils/uuid'
import { Contributor, PayFrequency } from '../types'
import { formatCurrency } from '../utils/formatters'

type Step = 'name' | 'type' | 'contributors' | 'done'

const FREQ_LABELS: Record<PayFrequency, string> = {
  weekly: 'Weekly',
  biweekly: 'Every 2 Weeks',
  'semi-monthly': 'Twice a Month',
  monthly: 'Monthly',
}

const PPM: Record<PayFrequency, number> = { weekly: 4, biweekly: 2, 'semi-monthly': 2, monthly: 1 }

function toMonthly(amount: number, freq: PayFrequency): number {
  const ppm = PPM[freq]
  return amount * ppm
}

export function WorkspaceCreate() {
  const { createWorkspace } = useStore()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('name')
  const [name, setName] = useState('')
  const [type, setType] = useState<'personal' | 'household'>('personal')
  const [contributors, setContributors] = useState<Contributor[]>([
    { id: uuid(), name: '', incomeAmount: 0, payFrequency: 'biweekly' },
  ])
  const [newContrib, setNewContrib] = useState({ name: '', amount: '', freq: 'biweekly' as PayFrequency })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const totalMonthly = contributors.reduce((s, c) => s + toMonthly(c.incomeAmount, c.payFrequency), 0)

  function validateStep(): boolean {
    const errs: Record<string, string> = {}
    if (step === 'name' && !name.trim()) errs.name = 'Workspace name is required'
    if (step === 'contributors') {
      if (type === 'personal' && (!contributors[0]?.incomeAmount || contributors[0].incomeAmount <= 0)) {
        errs.income = 'Enter your paycheck amount'
      }
      if (type === 'household' && contributors.length < 2) {
        errs.contributors = 'Add at least 2 contributors for a household budget'
      }
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function next() {
    if (!validateStep()) return
    if (step === 'name') setStep('type')
    else if (step === 'type') setStep('contributors')
    else if (step === 'contributors') finish()
  }

  function finish() {
    const initial = getInitialData()
    const wsSettings = {
      ...initial.settings,
      name: name.trim(),
      paycheckAmount: type === 'personal' ? contributors[0]?.incomeAmount : undefined,
      monthlyIncome: type === 'personal' ? toMonthly(contributors[0]?.incomeAmount ?? 0, contributors[0]?.payFrequency ?? 'biweekly') : undefined,
      payFrequency: type === 'personal' ? contributors[0]?.payFrequency : undefined,
    }
    const ws = makeWorkspace(
      { ...initial, accounts: [], transactions: [], budgets: [], goals: [], netWorthHistory: [], subscriptions: [], settings: wsSettings, merchantRules: {} },
      uuid(),
      name.trim(),
      type,
      contributors.filter(c => c.name.trim() && c.incomeAmount > 0),
    )
    createWorkspace(ws)
    navigate('/budgets')
  }

  function addContributor() {
    if (!newContrib.name.trim() || !newContrib.amount) return
    const amount = parseFloat(newContrib.amount)
    if (isNaN(amount) || amount <= 0) return
    setContributors(prev => [...prev, {
      id: uuid(),
      name: newContrib.name.trim(),
      incomeAmount: amount,
      payFrequency: newContrib.freq,
    }])
    setNewContrib({ name: '', amount: '', freq: 'biweekly' })
    setErrors({})
  }

  function removeContributor(id: string) {
    setContributors(prev => prev.filter(c => c.id !== id))
  }

  const stepIndex = { name: 0, type: 1, contributors: 2, done: 3 }
  const steps = ['Name', 'Type', 'Income']

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 540, margin: '0 auto', width: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: '#F3F4F6', border: '1px solid var(--border)', borderRadius: 8, padding: 8, cursor: 'pointer', display: 'flex', color: 'var(--text-muted)' }}
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px' }}>New workspace</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            Step {stepIndex[step] + 1} of {steps.length}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div style={{ display: 'flex', gap: 6 }}>
        {steps.map((s, i) => (
          <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ height: 3, borderRadius: 99, background: i <= stepIndex[step] ? 'var(--accent)' : 'var(--border)', transition: 'background 0.3s' }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: i <= stepIndex[step] ? 'var(--accent)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {s}
            </span>
          </div>
        ))}
      </div>

      {/* Step: Name */}
      {step === 'name' && (
        <Card style={{ padding: '28px 24px' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Name your workspace</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
            This is how you'll identify it in the switcher. Something like "Household" or "Side Business" works well.
          </p>
          <Field label="Workspace name" error={errors.name}>
            <Input
              value={name}
              onChange={e => { setName(e.target.value); setErrors({}) }}
              placeholder="e.g. Household Budget"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') next() }}
            />
          </Field>
        </Card>
      )}

      {/* Step: Type */}
      {step === 'type' && (
        <Card style={{ padding: '28px 24px' }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Choose the type</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
            Personal budgets are for one income. Household budgets support multiple people's incomes combined.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {([
              { value: 'personal', icon: User,  title: 'Personal', desc: 'One income source. Just you.' },
              { value: 'household', icon: Users, title: 'Household', desc: 'Multiple incomes. Family or partners.' },
            ] as const).map(opt => (
              <button
                key={opt.value}
                onClick={() => {
                  setType(opt.value)
                  // Reset contributors to appropriate default
                  setContributors(opt.value === 'personal'
                    ? [{ id: uuid(), name: '', incomeAmount: 0, payFrequency: 'biweekly' }]
                    : []
                  )
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '16px 18px', borderRadius: 12, textAlign: 'left',
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: type === opt.value ? 'var(--accent-dim)' : '#F9FAFB',
                  border: `2px solid ${type === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                <opt.icon size={22} color={type === opt.value ? 'var(--accent)' : 'var(--text-muted)'} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{opt.title}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{opt.desc}</p>
                </div>
                {type === opt.value && <Check size={16} color="var(--accent)" />}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Step: Contributors (income) */}
      {step === 'contributors' && (
        <Card style={{ padding: '28px 24px' }}>
          {type === 'personal' ? (
            <>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Your paycheck</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
                Enter your take-home paycheck amount and how often you get paid.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="Paycheck amount" error={errors.income}>
                  <Input
                    type="number" min="0" step="any" placeholder="0.00"
                    value={contributors[0]?.incomeAmount || ''}
                    onChange={e => setContributors([{ ...contributors[0], incomeAmount: parseFloat(e.target.value) || 0 }])}
                    autoFocus
                  />
                </Field>
                <Field label="Pay frequency">
                  <Select
                    value={contributors[0]?.payFrequency ?? 'biweekly'}
                    onChange={e => setContributors([{ ...contributors[0], payFrequency: e.target.value as PayFrequency }])}
                  >
                    {Object.entries(FREQ_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                </Field>
              </div>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Add contributors</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
                Add each person's income. You can mix different pay schedules.
              </p>

              {/* Existing contributors */}
              {contributors.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {contributors.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#F9FAFB', borderRadius: 10, border: '1px solid var(--border)' }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{c.name}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {formatCurrency(c.incomeAmount, '$')} · {FREQ_LABELS[c.payFrequency]}
                        </p>
                      </div>
                      <button onClick={() => removeContributor(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4 }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new contributor form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px', background: '#FAFBFC', borderRadius: 10, border: '1px solid var(--border)' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Add person</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Field label="Name">
                    <Input placeholder="e.g. Partner" value={newContrib.name} onChange={e => setNewContrib(p => ({ ...p, name: e.target.value }))} />
                  </Field>
                  <Field label="Paycheck amount">
                    <Input type="number" min="0" step="any" placeholder="0.00" value={newContrib.amount} onChange={e => setNewContrib(p => ({ ...p, amount: e.target.value }))} />
                  </Field>
                </div>
                <Field label="Frequency">
                  <Select value={newContrib.freq} onChange={e => setNewContrib(p => ({ ...p, freq: e.target.value as PayFrequency }))}>
                    {Object.entries(FREQ_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                </Field>
                <Button variant="secondary" onClick={addContributor} size="sm" style={{ alignSelf: 'flex-start' }}>
                  <Plus size={13} /> Add
                </Button>
              </div>

              {errors.contributors && <p style={{ fontSize: 12, color: 'var(--danger)', marginTop: 8 }}>{errors.contributors}</p>}

              {totalMonthly > 0 && (
                <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--accent-dim)', borderRadius: 10, border: '1px solid rgba(6,198,138,0.2)' }}>
                  <p style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                    Combined monthly income: {formatCurrency(totalMonthly, '$')}
                  </p>
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        {step !== 'name' ? (
          <Button variant="secondary" onClick={() => {
            if (step === 'type') setStep('name')
            else if (step === 'contributors') setStep('type')
          }}>
            <ArrowLeft size={14} /> Back
          </Button>
        ) : <div />}
        <Button onClick={next} style={{ minWidth: 120 }}>
          {step === 'contributors' ? 'Create workspace' : 'Continue'} <ArrowRight size={14} />
        </Button>
      </div>
    </div>
  )
}
