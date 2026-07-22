# LINE Bot Workflow — Non-Production Roadmap

**Status: non-production reference implementation and roadmap item.** The
repository's LINE demo is not an approved school deployment, does not establish
compliance for minors' data, and must not be used as evidence of a live LINE
bot or external adoption.

## What the demo shows

[`examples/line-webhook-demo/`](../examples/line-webhook-demo/) demonstrates a
small command-based webhook surface for synthetic inputs:

| Command | Demonstrated workflow |
| --- | --- |
| `/summary` | Draft a parent weekly summary from a lesson record |
| `/risk` | Check a draft for privacy, over-promising, and tone risks |
| `/task` | Extract internal follow-up tasks from a lesson record |

The example requires local environment variables for an LLM API key and LINE
channel credentials. Never commit those credentials or add them to issues, PRs,
logs, screenshots, or fake-data fixtures.

## Current safety boundary

- Use only synthetic fixtures and opaque student codes such as `S-001` when
  reading, testing, or demonstrating the example.
- Treat every generated parent message as a draft. A teacher or authorized staff
  member must complete the human approval gate before any real parent-facing
  communication is sent.
- The demo's webhook signature handling and example commands are implementation
  details, not a production security or privacy certification.
- Do not connect the demo directly to a student database, CRM, payment system,
  attendance system, or production LINE account handling real minor data.

## Local review path

For an offline, fake-data walkthrough, use the maintained mock CLI rather than
the LINE demo:

```bash
npm run cli:mock
```

Run the privacy gate before merging any change that affects a data path,
prompt, or output handling:

```bash
npm run privacy:regression
npm run scan
```

These commands are repository checks, not authorization to process real data.

## Required work before any production proposal

The following items remain roadmap work and need a separately reviewed design,
implementation, tests, and operating owner before a real deployment can be
considered:

1. A documented data-flow and threat model for LINE events, logs, LLM calls,
   retention, deletion, and incident response.
2. A fail-closed privacy boundary that prevents high-risk personal data from
   reaching an LLM, with tests for the real ingress path.
3. Deployment-specific access control, secret management, audit logging, and
   monitoring that do not store raw minor data unnecessarily.
4. Consent, data-controller, retention, and deletion procedures appropriate to
   the deploying school and jurisdiction.
5. Human approval, escalation, and error-handling procedures for parent-facing
   messages.
6. A production readiness review with a named accountable maintainer and
   evidence from a safe, authorized test environment.

Until these are complete and reviewed, keep LINE work in the roadmap and use
the CLI plus synthetic fixtures for demonstrations.
