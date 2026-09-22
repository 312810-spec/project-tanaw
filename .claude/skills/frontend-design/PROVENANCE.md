# frontend-design — provenance

Vendored from the local `claude-plugins-official` marketplace
(`~/.claude/plugins/marketplaces/claude-plugins-official`), plugin
`frontend-design`, which that marketplace's own README describes as internally
developed and maintained by Anthropic. The plugin's `.claude-plugin/plugin.json`
declares `author: Anthropic <support@anthropic.com>`. That is upstream's
declaration of its own authorship, recorded here as provenance; Project TANAW
asserts no copyright over this content and adds no copyright line of its own,
because the upstream ships none.

Marketplace revision pointer at the time of vendoring: `.gcs-sha`
`c447c3207a425bc4e2a0d068435f64b0477ae981`. The marketplace directory is not a
git checkout on this machine, so that pointer is a revision identifier, not a
commit hash this repo can resolve.

## Verification (performed 2026-09-22, this wave)

| File | Upstream path | Status |
|---|---|---|
| `LICENSE.txt` | `…/plugins/frontend-design/skills/frontend-design/LICENSE.txt` | **byte-identical** — sha256 `0d542e0c…` on both sides |
| `SKILL.md` | `…/plugins/frontend-design/skills/frontend-design/SKILL.md` | differs only by the one intended `disable-model-invocation: true` frontmatter line |

`LICENSE.txt` is the Apache License 2.0 terms and terminates at
"END OF TERMS AND CONDITIONS". **The upstream original does the same** — it
omits the canonical appendix too. The absence is therefore not a vendoring
defect, and restoring the appendix would make this copy *diverge* from the
authoritative source rather than reconcile with it. Apache-2.0 §4(c) requires
retaining attribution notices present in the Source form; the upstream carries
no copyright notice line, so there is nothing further to preserve. §4(a) is
satisfied by the unmodified `LICENSE.txt` shipped alongside.

`disable-model-invocation: true` is the only deliberate change from upstream. It
makes the skill opt-in in this repo, whereas upstream's README describes it as
activating automatically. That is a **declaration of intent, not a mechanically
verified enforcement** (operating-rules §11): no test in this repo exercises it.
