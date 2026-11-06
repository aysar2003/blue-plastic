# 07 — Jadwal: coverage for every business & industry

**Ujeeddo:** in Som ERP noqdo nidaam mid hoosta ka wada shaqeeya (horizontal core), oo **industry packs** lagu kordhiyo si ganacsi / urur kasta ugu habboonaado — maaha in hal code-base uu noqdo “SAP oo dhammaystiray adduunka” maalinta dambe.

**Xaqiiqo:** “Nooc walba” waxaa lagu gaaraa **core + configuration + vertical packs**, ma aha feature keliya. Qaar (baanka fulinta, healthcare clinical, PLC) weliba waa partner / out-of-scope hardware.

Hadda (Phase ≤ 33): SME / mid-market core + WMS/BI/close enterprise lite. Jadwalkan wuxuu bilaabmaa **Phase 34**.

---

## Mabaadi’da

1. **Core mid** — ledger, documents, inventory, HR, reports, API (L0–L9) waa aasaaska dhammaan.
2. **Pack = module + templates + checklist + reports** — tusaale: Construction, Restaurant, NGO — ma beddelo posting engine.
3. **Configuration first** — chart templates, tax packs, document kinds, feature flags ka hor custom code.
4. **Non-goals weliba** (haddii aan si gaar ah loo furin): untrusted plugins, DocuSign/eIDAS QES trademark, robots/PLC, IoT printers, FX dealing desk / ISDA.

```mermaid
flowchart LR
  core[Horizontal_core_L0_L9]
  config[Org_templates_tax_flags]
  packs[Industry_packs]
  partners[Regulated_partners]
  core --> config --> packs
  packs --> partners
```

---

## Wave A — Horizontal “any business” (Phases 34–40)

Ujeeddo: shirkad **kasta** oo buugaag + alaab/adeeg + cash leh ay isticmaali karto iyada oo aan industry gaar ah lahayn.

| Phase | Focus | Exit when |
| --- | --- | --- |
| **34** | **Industry pack framework** — `IndustryPack` model, install templates (CoA, items sample, tax, document kinds, dashboard presets) | Org can switch/install a pack without code deploy |
| **35** | **Multi-entity & intercompany harden** — IC matching, group close checklist, minority / ownership % on consol | Group of companies closes books together |
| **36** | **Subscriptions & recurring revenue** — bill schedules, deferred revenue lite | SaaS / membership / rentals post correctly |
| **37** | **Field service / jobs** — work orders for service (not MES), travel, parts on van stock | Service company runs jobs → invoice |
| **38** | **Contracts & milestones** — long contracts, retainage, progress bill deepen | Construction-lite / project billers |
| **39** | **Quality & compliance lite** — CAPA notes, document control link to Sign, audit trail packs | Auditable ops without clinical EMR |
| **40** | **Localization packs** — country tax/payroll CSV schemas (SO + 2–3 more), invoice e-format hooks | Multi-country SME without rewriting GL |

**Caddeyn:** Wave A ka dib systemku wuxuu u shaqeeyaa “ganacsi caadi ah oo adduunka ah” + groups + service/subscription — weli maaha bank core ama hospital EMR.

---

## Wave B — Industry vertical packs (Phases 41–50)

Hal phase = **hal pack** (templates + workflows + reports). Order = baahi caadi ah SME.

| Phase | Pack | Wuxuu ku darayaa |
| --- | --- | --- |
| **41** | **Retail & wholesale** | Price lists depth, promotions, multi-store replenishment, loyalty lite |
| **42** | **Restaurant / hospitality** | Kitchen already lite → recipes cost, tips, table turns, night audit |
| **43** | **Construction / contracting** | Retention, AIA-style progress, job cost vs budget, site stores |
| **44** | **Manufacturing discrete** | Routings, work centers, capacity calendar (software MES lite — maaha PLC) |
| **45** | **Distribution / 3PL** | ASN, dock appointments, wave/slotting deepen, carrier labels hooks |
| **46** | **Professional services** | Retainers, utilization, WIP, write-up/down |
| **47** | **Nonprofit / NGO** | Funds/restrictions, donor pledges, grant budgets, fund BS |
| **48** | **Education / training** | Programs, term fees, scholarships (maaha LMS buuxa) |
| **49** | **Healthcare admin** | Patient billing admin, insurance claims export — **clinical chart out** |
| **50** | **Agriculture / livestock** | Batches/lots deepen, farm locations, seasonal costing |

---

## Wave C — Organization types & scale (Phases 51–56)

| Phase | Focus | Exit when |
| --- | --- | --- |
| **51** | **Franchise / multi-brand** | Shared catalog, royalty accrual, brand P&L |
| **52** | **Holding / PE portfolio** | Roll-up KPIs, ownership waterfall lite |
| **53** | **Government / public sector lite** | Fund accounting deepen, commitment accounting, appropriation |
| **54** | **Cooperative / member org** | Member equity, patronage dividends |
| **55** | **High-volume / performance** | Partitioning strategy, read replicas guidance, archive jobs |
| **56** | **Marketplace operator** | Multi-seller settlement, commission, escrow lite |

---

## Wave D — Regulated / partner boundary (Phases 57–60)

Kuwan **ma buuxiyaan** non-goals; waxay dhigaan **adapters + certified partner slots**.

| Phase | Focus | Xadka |
| --- | --- | --- |
| **57** | **Banking / MFI lite** | Savings/loan products lite — **maaha** core banking / ISDA desk |
| **58** | **Insurance lite** | Policies & premiums admin — underwriting engine out |
| **59** | **e-Signature providers** | Adapter to *named* providers (not claiming DocuSign/eIDAS QES trademark) |
| **60** | **Trusted extension SDK** | Signed, reviewed first-party extensions only — untrusted plugins still out |

---

## Waqti qiyaas ah (calendar)

Aan loo qaadan “maalmo”; waa **hirgelin taxane ah**:

| Wave | Phases | Qiyaas (team 1–2) |
| --- | --- | --- |
| A Horizontal | 34–40 | ~3–5 bilood |
| B Verticals | 41–50 | ~6–10 bilood |
| C Org scale | 51–56 | ~3–5 bilood |
| D Regulated adapters | 57–60 | ~2–4 bilood |

**Wadarta qiyaasta:** ~14–24 bilood ilaa “coverage map” buuxda — iyadoo core hadda jiro.

---

## Prioritization default (haddii mid la dooranayo)

1. **34** pack framework (furaha dhammaan)
2. **35** multi-entity harden
3. **41 Retail** ama **43 Construction** (sida macmiilka ugu badan)
4. **44 Manufacturing discrete** (haddii WO/MES lite loo baahdo)
5. **47 NGO** / **46 Services** sida suuqa

---

## Metric “u shaqeeya industry X”

Pack waa **complete** marka:

1. Template CoA + tax + sample items install-garan karo
2. Operating loop 1–2 toddobaad ah (sell/buy/stock/pay) smoke test green
3. 3–5 report/dashboard presets
4. Close checklist keys ku habboon pack-ka
5. Docs + readiness row `INDUSTRY_PACKS`

---

## Waxa weliba ka baxsan jadwalkan (si ula kac ah)

- Robot / PLC / AS/RS hardware drivers  
- Untrusted third-party plugin store  
- Claiming DocuSign or eIDAS **qualified** trademark  
- Full clinical EMR, full core banking, FX dealing desk  

Kuwan waxaa lagu qori karaa **partner integrations** (Wave D), ma aha inay noqdaan core Som ERP.

---

## Next step

Confirm Wave A Phase **34** (Industry pack framework) in la bilaabo — ama dooro vertical ugu horreysa (41/43/44/47).
