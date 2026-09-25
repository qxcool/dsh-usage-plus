## DeepSeek Harness plugin development

Before changing plugin code, read https://dsh.pub/develop-plugin.md completely. Follow the pinned
runtime contract and verification boundaries there; this repository's own security, testing, and
release rules remain authoritative.

Target track: **Host + Web UI** (Host owns ledger/probes; Web client owns Plugins page + composer dock strip).

Compatible engines: `dsh >= 0.1.7-rc.1` (volatile Config forms, `configForms`, `plugins.item`, `conversation.composer.dock`).
