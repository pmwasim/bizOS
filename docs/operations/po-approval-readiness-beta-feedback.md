# Private-beta feedback checklist — PO / approval readiness

Use after each beta session. Do not implement OCR, AI, or invoicing from this list during the
current release.

## Session

- Date:
- User / business:
- Completion time (minutes):
- Device (desktop / mobile width):

## Outcome checklist

- [ ] Found “Add customer PO” from the quotation
- [ ] Understood PO number / date / notes fields
- [ ] Uploaded a customer PO file successfully
- [ ] Understood approval status choices
- [ ] Uploaded approval evidence
- [ ] Understood **Ready to invoice** (or why it was not ready)

## Friction log

| Topic                            | Observed? | Notes         |
| -------------------------------- | --------- | ------------- |
| Fields user did not understand   |           |               |
| Upload failures                  |           |               |
| Readiness label confusion        |           |               |
| Requests for OCR / AI extraction |           | (record only) |
| Requests for invoicing next      |           | (record only) |

## Recommendation seed (invoice slice)

Based on evidence only:

1. Prefer the smallest invoice draft that copies quotation lines + linked PO number.
2. Do not start OCR until upload success rate and readiness comprehension are stable.
3. Keep “Ready to invoice” as the gate before any invoice create action.
