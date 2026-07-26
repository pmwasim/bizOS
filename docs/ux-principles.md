# UX principles

Status: Accepted

## Rules

1. **Start with the next action.** Every work item states who should do what, by when, and why.
2. **Use business language first.** Formal accounting or legal terms appear as secondary context.
3. **One primary action per surface.** Secondary actions are quieter; destructive actions are
   separated and explained.
4. **Reveal complexity when earned.** Advanced fields appear because a choice requires them, not
   because the data model has them.
5. **Show consequences before commitment.** Finalize, send, cancel, refund, and approve screens
   explain the durable outcome.
6. **Prevent errors before explaining them.** Defaults and constraints should make invalid states
   hard to create.
7. **Make recovery explicit.** An error says what happened, what is preserved, and how to proceed.
8. **Preserve context.** Returning from a customer, attachment, or approval restores the work.
9. **Never encode meaning with color alone.** Status uses text, icon, shape, and accessible color.
10. **Design for interruption.** Drafts persist safely and display their last saved state.

## Vocabulary

- Prefer verbs: **Send offer**, **Ask for approval**, **Record payment**.
- Avoid abstract commands: **Process**, **Post**, **Execute**, **Submit transaction**.
- State labels describe reality: **Waiting for Noor**, **Customer viewed**, **Payment overdue**.
- Do not use “success” when the system only accepted work asynchronously; use **Scheduled**.
- Translate meaning, not database enum names.

## Form behavior

- Ask only for information required for the current outcome.
- Put smart defaults beside a plain explanation and keep them reversible.
- Preserve user input after validation errors.
- Validate at field, section, and finalization boundaries.
- Format dates, currency, numbers, names, and addresses by locale; store canonical values.
- Searchable selectors replace long dropdowns. Recent and relevant choices come first.

## Approvals

An approval view shows the request, material changes, amount and currency, tax impact, evidence,
policy reason, requester, due time, and downstream effect. Approve and return-for-change require
deliberate actions. Rejection requires a useful reason.

## Accessibility baseline

- WCAG 2.2 AA is the release floor.
- Keyboard-only operation covers every workflow.
- Touch targets are at least 44 by 44 CSS pixels.
- Text can scale to 200% without loss of function.
- Focus order follows reading order and focus is never hidden.
- Motion respects reduced-motion settings.
- Arabic and other right-to-left layouts are tested, not visually mirrored by assumption.

## UX acceptance

Each product story includes a plain-language review, keyboard path, empty/loading/error states,
small-screen behavior, localization expansion, and recovery from interruption.
