# Behavior validation — 3 November 2026

The native engine and frontend were rebuilt, then every standard scenario was
launched from the dashboard and played to completion at 10× speed. These are
fixed-seed model results, not measurements of real cloud hardware.

| Preset | Completed | Scale up / down | Completed-request SLA |
| --- | ---: | ---: | ---: |
| Full lifecycle | 273 | 3 / 3 | 86.8% |
| Stable cluster | 173 | 0 / 0 | 100% |
| Traffic surge | 391 | 3 / 0 | 60.4% |
| Failure and recovery | 204 | 0 / 0 | 89.2% |
| Priority traffic | 175 | 0 / 0 | 50.3% |
| Underprovisioned cluster | 37 | 0 / 0 | 73.0% |
| Scale up then down | 132 | 2 / 2 | 84.8% |
| Remove idle servers | 11 | 0 / 4 | 100% |

The lifecycle and outage presets each recorded one failure and one recovery.
The combined scaling preset completed all 132 requests without failures or
rejections. The idle preset removed four servers without killing work.

## Regressions checked

- Every snapshot has its exact node inventory; node task counts equal cluster totals.
- Time-zero replay shows zero running, waiting and finished tasks, with no future traces.
- Failures, recoveries and scaling traces are timestamped and no longer truncated at 300 entries.
- CPU and RAM allocations remain within capacity.
- Submitted = completed + failed + rejected + unfinished at the observation horizon.
- Unschedulable requests are rejected rather than left in queues indefinitely.
- Zero completions display N/A for SLA compliance.
- Priority queues put higher priorities first, keeping FIFO ordering within a priority.
- Scale-down refuses busy nodes; removed nodes retain cost and availability history.
- Initial node counts outside enabled autoscaler bounds are rejected.
- Memory ranges, priority ratios, threshold ordering and outage windows are validated.
- Validation applies to policy experiments as well as individual simulations.
- Routing weights 1:2:4 produced 289:577:1155 assignments in the automated check.
- The UI weighted run produced 139:276:552 completions (plus active work at the horizon).
- Advanced settings accepted 20 nodes and 100 requests/second.
- JSON and CSV exports both downloaded successfully in the in-app browser.

## Reproduce

```powershell
npm run build:engine
npm run test:engine
node backend/tests/behavior.test.js
npm test
npm run build:frontend
.\start.bat
```

The original 17 C++ tests, added behavioral C++ regressions, API integration tests,
and preset/edge-case behavioral regressions passed.

## Interpretation

SLA compliance covers completed requests only. Unfinished, rejected and failed
requests are displayed separately. A stressed scenario missing its SLA is an
expected model outcome, not an application error. Priority scheduling does not
preempt running tasks. Scale-down removes only completely idle nodes, so it may
wait beyond a cooldown while work finishes. Cost remains a simplified model
that charges operational capacity-time, not a provider billing forecast.

The primary console replays completed results; it does not provide interactive
in-flight fault injection. Runs remain in memory and disappear on restart.
