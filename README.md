# pi-fuzz

Fuzz out the screen during long [pi](https://pi.dev) sessions to rest your eyes.

`/fuzz` covers the whole terminal with a low-contrast noise field and a small
status panel. The agent keeps running underneath. Press any key to unfuzz.

The panel shows:

- **status** – `working` (with a pulsing dot) or `idle`
- **model** – the current model id
- **context** – context window usage
- **fuzzed** – how long the screen has been fuzzed
- **clock** – current time

## Install

```sh
pi install npm:pi-fuzz
```

Then run `/fuzz` inside pi.

## Why

Watching tokens stream for a long time is hard on the eyes. Fuzz gives you a
calm, dark screen you can leave up while the agent works, with just enough
information to know it hasn't stalled.

## License

MIT
