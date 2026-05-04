# CLAUDE.md

Project notes for Claude. Gitignored — local-only, doesn't ship to the repo.

## Don't run the test suite after every edit

`test/loadGen.js` boots the full scramble engine including `public/scramble/solve.js`,
which is a heavy two-phase solver. Single-suite runs (e.g. `test/test_462_parity.js`)
are bearable; running multiple suites back-to-back takes minutes and doesn't
add value for routine code edits.

Rules of thumb:
- **Don't** auto-run tests as a sanity check after every change. The user catches
  most issues through actual app use.
- **Do** run tests only when:
  - The user explicitly asks for a test run.
  - You're shipping a *new behavior* that has a dedicated test (e.g. you just
    wrote `test/test_t2c_extras.js` to verify a new feature).
  - You've made a change that's likely to break a specific suite — and even
    then, run only that one suite, not all of them.
- If you do run, prefer one targeted suite (the most relevant), not the full set.
- The full set lives in `test/test_*.js` and runs through Node directly.
