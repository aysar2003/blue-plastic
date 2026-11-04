# Phase 21 — Legal SME layers (former “non-goals”)

**Status:** Complete

Adds the loops the owner asked for, **through the existing ERP layers** (schema → service → journal/flags → UI → tests), without cloning trademarks or controlling hardware.

## Legal layer (what this is / is not)

| Loop | In this product | Not this product |
| --- | --- | --- |
| FX hedging | IFRS 9 / IAS 39 **documentation** + MTM journal to Exchange Gain/Loss | Dealing desk, ISDA, speculative forwards trading |
| Kitchen POS | Staff kitchen display (OPEN→FIRED→READY→DONE) | IoT printers, health-code devices |
| Marketplace | First-party install of **granted** modules | Third-party code, Odoo-style plugins |
| WMS | Bins + human pick tasks | Robots, AS/RS, PLC |
| Sign / Discuss | SHA-256 audit certificate; `@mentions` | DocuSign / Slack trademarks, eIDAS QES |
| LMS | Employee courses + completion | Campus SIS, SCORM, student PII |
| Payroll backup | Runs, payslips, lines in JSON dump **and restore** | Scanned contracts / PDFs |

## Routes

- `/accounting/hedges`
- `/pos/kitchen`
- `/inventory/bins`
- `/employees/training`
- `/settings/marketplace`
- `/sign/[id]/certificate`

## Tests

`tests/erp-lite-complete.test.ts` — hedge band, kitchen bump, marketplace grants, mentions, digest.  
`tests/erp-readiness.test.ts` — pages + payroll dump/restore.
