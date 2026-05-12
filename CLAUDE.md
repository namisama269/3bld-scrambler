# CLAUDE.md

Project notes for Claude. Gitignored — local-only, doesn't ship to the repo.

## Never run tests unless explicitly asked

`test/loadGen.js` boots the full scramble engine including
`public/scramble/solve.js`, which is a heavy two-phase solver. Even a single
suite is slow; running several back-to-back takes minutes.

Rule: **only run tests when the user explicitly asks.** No exceptions —
not as a sanity check after an edit, not because a change "looks risky," not
because a new behavior has a dedicated suite, not even one targeted suite.
The user runs tests themselves and verifies behavior through actual app use.

If you think tests are warranted, *suggest* it in a sentence and wait for the
user to tell you to run them. Don't run first and ask forgiveness.

The full set lives in `test/test_*.js` and runs through Node directly when
the user does ask.
