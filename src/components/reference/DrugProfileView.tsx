// HistoMed-style «دارویاب» view for drugs that have a structured profile
// (lib/drugProfiles.ts). The dose tab embeds the existing Harriet Lane dose
// calculator / monograph, so nothing from the book view is lost.
import { useState, type ReactNode } from 'react'
import type { DrugProfile, ProfileAdverse, ProfileInteraction } from '../../lib/drugProfiles'
import type { DrugRefEntry } from '../../types/domain'
import { DrugMonograph, type PatientDoseContext } from './DrugMonograph'

type Tab = 'id' | 'ind' | 'dose' | 'contra' | 'adverse' | 'inter' | 'monitor'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'id', label: 'شناسایی' },
  { id: 'ind', label: 'موارد مصرف' },
  { id: 'dose', label: 'دوز و مصرف' },
  { id: 'contra', label: 'منع مصرف' },
  { id: 'adverse', label: 'عوارض' },
  { id: 'inter', label: 'تداخلات' },
  { id: 'monitor', label: 'پایش و نکات' },
]

const ADVERSE_GROUP: Record<ProfileAdverse['group'], string> = {
  major: 'عوارض اصلی',
  other: 'سایر عوارض',
  reported: 'گزارش‌شده (نادر)',
}

const EFFECT: Record<ProfileInteraction['effect'], string> = {
  increase: 'افزایش سطح / اثر',
  decrease: 'کاهش سطح / اثر',
  other: 'سایر تداخلات',
}

function Page({ p }: { p: string }) {
  return <span className="dp-page">HL p.{p}</span>
}

function Card({ title, icon, children, tone }: { title: string; icon: string; children: ReactNode; tone?: 'red' | 'amber' }) {
  return (
    <section className={`dp-card ${tone ?? ''}`}>
      <header>
        <span className="dp-ic" aria-hidden="true">
          {icon}
        </span>
        <h3>{title}</h3>
      </header>
      {children}
    </section>
  )
}

export function DrugProfileView({ profile, entry, ctx }: { profile: DrugProfile; entry: DrugRefEntry; ctx: PatientDoseContext }) {
  const [tab, setTab] = useState<Tab>('id')
  const absolute = profile.contraindications.filter((c) => c.level === 'absolute')
  const relative = profile.contraindications.filter((c) => c.level === 'relative')

  return (
    <div className="dp" dir="rtl">
      <section className="dp-head">
        <div className="dp-title">
          <span className="dp-ic lg" aria-hidden="true">
            💊
          </span>
          <div>
            <h2>{profile.nameFa}</h2>
            <span className="en">{profile.nameEn}</span>
            <span className="cls">{profile.classFa}</span>
          </div>
        </div>
        <div className="dp-chips">
          {entry.pregnancyCategory && <span className="dp-chip amber">بارداری: رده {entry.pregnancyCategory}</span>}
          {entry.breastfeedingCategory && <span className="dp-chip">شیردهی: {entry.breastfeedingCategory}</span>}
          {entry.renalCaution && <span className="dp-chip red">احتیاط کلیوی</span>}
          {entry.hepaticCaution && <span className="dp-chip red">احتیاط کبدی</span>}
          {profile.tags?.map((t) => (
            <span key={t} className="dp-chip green">
              {t}
            </span>
          ))}
        </div>
        <p className="dp-src">منبع: Harriet Lane Handbook 23e · {entry.sourcePages}</p>
      </section>

      <p className="dp-summary">{profile.summary}</p>

      <nav className="dp-tabs" aria-label="بخش‌های دارو">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'id' && (
        <>
          <Card title="شناسنامه دارو" icon="🪪">
            <dl className="dp-dl">
              <dt>نام ژنریک (فا)</dt>
              <dd>{profile.nameFa}</dd>
              <dt>نام ژنریک (EN)</dt>
              <dd dir="ltr">{profile.nameEn}</dd>
              <dt>دسته دارویی</dt>
              <dd>{profile.classFa}</dd>
              {entry.drugClass && (
                <>
                  <dt>Drug class</dt>
                  <dd dir="ltr">{entry.drugClass}</dd>
                </>
              )}
            </dl>
          </Card>
          {entry.tradeNames && (
            <Card title="نام‌های تجاری (طبق کتاب)" icon="🏷️">
              <p className="dp-en" dir="ltr">
                {entry.tradeNames}
              </p>
            </Card>
          )}
          <Card title="مکانیسم اثر و فارماکوکینتیک" icon="⚙️">
            <p className="dp-empty">در Harriet Lane نیامده است؛ چیزی اضافه نشد.</p>
          </Card>
        </>
      )}

      {tab === 'ind' && (
        <Card title="موارد مصرف (طبق دوزهای کتاب)" icon="✅">
          <ul className="dp-list">
            {profile.indications.map((i) => (
              <li key={i.text}>
                <b>{i.text}</b>
                {i.who && <span className="dp-who">{i.who}</span>}
                {i.note && <span className="dp-note">{i.note}</span>}
                <Page p={i.page} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {tab === 'dose' && (
        <div className="dp-dose" dir="ltr">
          <DrugMonograph entry={entry} ctx={ctx} />
        </div>
      )}

      {tab === 'contra' && (
        <>
          {absolute.length > 0 && (
            <Card title="منع مصرف مطلق" icon="⛔" tone="red">
              <ul className="dp-list">
                {absolute.map((c) => (
                  <li key={c.text} className="red">
                    <b>{c.text}</b>
                    {c.note && <span className="dp-note">{c.note}</span>}
                    <Page p={c.page} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card title="احتیاط / منع مصرف نسبی" icon="⚠️" tone="amber">
            {relative.length ? (
              <ul className="dp-list">
                {relative.map((c) => (
                  <li key={c.text} className="amber">
                    <b>{c.text}</b>
                    {c.note && <span className="dp-note">{c.note}</span>}
                    <Page p={c.page} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dp-empty">در کتاب ذکر نشده.</p>
            )}
          </Card>
        </>
      )}

      {tab === 'adverse' && (
        <Card title="عوارض جانبی" icon="💔">
          {(['major', 'other', 'reported'] as const).map((g) => {
            const items = profile.adverse.filter((a) => a.group === g)
            if (!items.length) return null
            return (
              <div key={g} className="dp-group">
                <h4>{ADVERSE_GROUP[g]}</h4>
                <ul className="dp-list">
                  {items.map((a) => (
                    <li key={a.text} className={a.serious ? 'red' : g === 'major' ? 'amber' : 'green'}>
                      <b>
                        {a.text} {a.serious && <span className="dp-sev red">جدی</span>}
                      </b>
                      {a.note && <span className="dp-note">{a.note}</span>}
                      <Page p={a.page} />
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
          <p className="dp-foot">گروه‌بندی همان عبارت کتاب است (عوارض اصلی / ممکن است رخ دهد / گزارش شده). کتاب درصد شیوع نمی‌دهد. برچسب «جدی» را Nephron برای عوارض تهدیدکننده حیات گذاشته است.</p>
        </Card>
      )}

      {tab === 'inter' && (
        <Card title="تداخل دارویی" icon="🔀">
          {(['increase', 'decrease', 'other'] as const).map((e) => {
            const items = profile.interactions.filter((x) => x.effect === e)
            if (!items.length) return null
            return (
              <div key={e} className="dp-group">
                <h4>{EFFECT[e]}</h4>
                <ul className="dp-list">
                  {items.map((x) => (
                    <li key={x.agents} className={x.level === 'avoid' ? 'red' : 'amber'}>
                      <b>
                        {x.text} <span className={`dp-sev ${x.level === 'avoid' ? 'red' : 'amber'}`}>{x.level === 'avoid' ? 'پرهیز' : 'پایش'}</span>
                      </b>
                      <span className="dp-agents" dir="ltr">
                        {x.agents}
                      </span>
                      {x.note && <span className="dp-note">← {x.note}</span>}
                      <Page p={x.page} />
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
          <p className="dp-foot">«پرهیز» یعنی کتاب صریحاً Avoid گفته؛ «پایش» یعنی کتاب تغییر سطح یا اثر را ذکر کرده است.</p>
        </Card>
      )}

      {tab === 'monitor' && (
        <>
          <Card title="پایش" icon="📈">
            <ul className="dp-list">
              {profile.monitoring.map((m) => (
                <li key={m.text} className="green">
                  <b>{m.text}</b>
                  <Page p={m.page} />
                </li>
              ))}
            </ul>
          </Card>
          {profile.administration.length > 0 && (
            <Card title="نحوه مصرف و نکات" icon="📝">
              <ul className="dp-list">
                {profile.administration.map((m) => (
                  <li key={m.text} className="green">
                    <b>{m.text}</b>
                    <Page p={m.page} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      <p className="dp-disclaimer">ⓘ این اطلاعات فقط از Harriet Lane 23e خلاصه و ترجمه شده و جایگزین قضاوت بالینی یا پروتکل بخش نیست. برای جزئیات، متن کامل کتاب در تب «دوز و مصرف» هست.</p>
    </div>
  )
}
