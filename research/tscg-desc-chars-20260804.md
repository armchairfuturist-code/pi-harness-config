# TSCG description-length test — 2026-08-04

## Status: inconclusive; baseline retained

A six-probe comparison initially suggested that `aggressiveMaxDescChars=5` beat `30`. It is not accepted as a promotion result: the original capture proxy was missing and exact recovery was impossible. A first replacement proxy preserved stream forwarding and usage capture, but did not prove cache-busting semantics; the subsequent replacement test exposed isolated-agent package-resolution failures before it produced usable samples.

Therefore live and canonical config remain at the previously validated `aggressiveMaxDescChars: 30`.

## What is now fixed

- `bench/proxy-oi.mjs` is versioned, deployed by `install.sh`, localhost-only, forces identity encoding, forwards OpenAI-compatible streams, redacts credentials, atomically captures packets, and normalizes usage aliases.
- `bench/build-variant.sh` makes proxy routing explicit with `TSCG_PROXY_LILAC=1` rather than silently rewriting every variant.

## Required next experiment

Run an A/B in a stable agent directory that retains the installed npm root while each candidate overrides only the Pi TSCG config. Require six cold requests each, unique recorded cache keys, one request per probe, identical captured system/tool payloads except TSCG output, and a median win larger than within-variant variance. Do not promote a candidate otherwise.
