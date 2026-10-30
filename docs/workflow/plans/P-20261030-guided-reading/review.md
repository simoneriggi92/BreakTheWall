# Bounded implementation review

The implementation follows the owner's direct request and the reviewed interaction, with these boundaries:

- Root Markdown tokens determine safe boundaries; the model accounts for every source line. No generated text, quiz gate or additional step is created when advancing.
- The new optional location field passes through existing progress validation and atomic storage; old files remain valid and keep their former overview. A stale reading reference uses the existing preservation/reset policy.
- Source text stays in the existing safe renderer. Original line offsets are retained for slices; the existing complete source, outline, highlighting and keyboard return are reused.
- The right-hand detail uses only canonical part ids, icons and joint data. Its vertical projection is presentational, preserves arrow direction and uses original whole-sheet numbers. Overview geometry and Run/Reassemble contracts are unchanged.
- No Studio/generation/provider changes, external dependencies, private material or publication actions were added. Material excluded from the question stays readable with the original exclusion reasons.
- The UI remains small: vertical navigation, current passage, highlighted source, drawing, and back/forward with one position count. Expanded source and part details are optional.

Residual limitations are recorded in verification. No evidence of improved learning is claimed; this is a source-navigation implementation ready for owner testing.
