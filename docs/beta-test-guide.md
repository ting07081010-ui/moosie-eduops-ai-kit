# Beta Test Guide

This guide is for non-author testers of the local, synthetic Moosie EduOps AI
Kit workflow. It is not a request to upload student data or deploy a bot.

## Safety boundary

Use only the repository's synthetic fixtures. Do not paste names, phone
numbers, email addresses, LINE IDs, school names, parent messages, attendance
history, health information, payment data, screenshots containing identifiers,
or API credentials into a terminal, issue, form, or document.

If you accidentally include real data, stop and contact the maintainer through
the private security channel. Do not open a public issue with the data.

## Prerequisites

- Node.js 20 or newer
- Git
- A local folder for a disposable clone
- No API key, model account, or LINE account is required for this beta path

## Clean mock-first scenario

~~~bash
git clone https://github.com/ting07081010-ui/moosie-eduops-ai-kit.git
cd moosie-eduops-ai-kit
npm ci
npm run cli:mock
npm run eval:structural
npm run privacy:regression
npm run schema:compat
npm test
npm run scan
~~~

Expected outcome:

- The mock CLI completes using fake data without an API key or network model
  call.
- Every deterministic command exits with status 0.
- The output includes a lesson record, parent-summary draft, task list, and
  risk check.

Record the actual duration from clone through the first successful mock output.
There is no claimed time target until non-author results are recorded.

## What to inspect

1. Was the setup path understandable from README?
2. Did the mock output clearly separate draft content, tasks, and risk checks?
3. Did any command fail or have confusing wording?
4. Which step was most useful, and which was most difficult?
5. Would you use or adapt this synthetic workflow? Describe the scenario
   without naming a person, school, or student.

## Reporting

Use [Feedback Template](feedback-template.md) or the Beta Feedback Issue Form.
Set the consent field to no if the maintainer may not summarize the finding
publicly.

A beta tester count is **not recorded** until an anonymized, consented record
with a date and source type exists. An issue or form without consent is useful
for maintenance but is not public adoption evidence.

## Cleanup

The clone contains only the sample toolkit and synthetic fixtures. Remove the
local clone using your normal local-file cleanup process when finished. Do not
send local configuration files, terminal histories, or screenshots containing
credentials to the maintainer.
