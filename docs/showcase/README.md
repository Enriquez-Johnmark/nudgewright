# Showcase

The engine has no pages of its own, so this shows it at work: the whole loop in code, the example run for real, the email it sent, and the tests behind its promises. All output here is what the commands actually printed.

| File | Shows |
|---|---|
| `walkthrough.mp4` | A one-minute captioned walkthrough: the example's code, running it, the email arriving once, the outbox tests passing, and the two products built on the engine |
| `code.png` | `examples/approve_and_send.rs`: draft, approve exactly what was seen, send once |
| `example.png` | `cargo run --example approve_and_send`: one message sent, none failed, blocked or unconfirmed |
| `mailpit.png` | The email in Mailpit, a local mail catcher, with the exact approved content |
| `tests.png` | `cargo test --test outbox`: the approval and exactly-once guarantees, each with a test |

## Making them again

```sh
docker compose up -d                                       # Postgres
docker run -d -p 8025:8025 -p 1025:1025 axllent/mailpit    # a local mail catcher
node scripts/showcase.mjs
```

It needs Node with Playwright (`npm i -g playwright`) and ffmpeg. It deletes only earlier emails to `client@example.test` from Mailpit, so the inbox shows this run's one email. The products' dashboards in the video come from sibling checkouts of Kompleto and Balanse (`KOMPLETO_DIR`, `BALANSE_DIR`); without them that scene is empty.
