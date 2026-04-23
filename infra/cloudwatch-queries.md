# CloudWatch Logs Insights Queries — Denali App Metrics

Log group: `/ecs/denali`
All queries filter for `[Metrics]` prefix emitted by `src/lib/metrics/logger.ts`.

## P95 Latency by Route

```
filter @message like "[Metrics]"
| parse @message /\"_m\":\"request\".*\"route\":\"(?<route>[^\"]+)\".*\"durationMs\":(?<ms>\d+)/
| stats avg(ms) as avg_ms, pct(ms, 95) as p95_ms, pct(ms, 99) as p99_ms, count() as requests by route
| sort p95_ms desc
```

## Error Rate by Route (5xx only)

```
filter @message like "[Metrics]" and @message like "\"_m\":\"request\""
| parse @message /\"route\":\"(?<route>[^\"]+)\".*\"status\":(?<status>\d+)/
| stats sum(status >= 500) as errors, count() as total, (sum(status >= 500) / count() * 100) as error_pct by route
| sort error_pct desc
```

## Claude API Latency & Tool Usage

```
filter @message like "[Metrics]" and @message like "\"_m\":\"claude\""
| parse @message /\"model\":\"(?<model>[^\"]+)\".*\"iterations\":(?<iters>\d+).*\"totalMs\":(?<ms>\d+).*\"timedOut\":(?<timeout>\w+)/
| stats avg(ms) as avg_ms, pct(ms, 95) as p95_ms, max(ms) as max_ms, avg(iters) as avg_iters, sum(timeout = "true") as timeouts, count() as calls by model
| sort avg_ms desc
```

## Fallback Fire Rate (withFallback timeouts)

```
filter @message like "[Metrics]" and @message like "\"_m\":\"fallback\""
| parse @message /\"label\":\"(?<label>[^\"]+)\".*\"fired\":(?<fired>\w+).*\"actualMs\":(?<ms>\d+)/
| stats sum(fired = "true") as timeouts, count() as total, (sum(fired = "true") / count() * 100) as timeout_pct, avg(ms) as avg_ms by label
| sort timeout_pct desc
```

## Recent Errors (last 15 minutes)

```
filter @message like "[Metrics]" and @message like "\"_m\":\"request\"" and @message like "\"status\":5"
| parse @message /\"route\":\"(?<route>[^\"]+)\".*\"status\":(?<status>\d+).*\"durationMs\":(?<ms>\d+)/
| sort @timestamp desc
| limit 50
```

## Hourly Traffic Summary

```
filter @message like "[Metrics]" and @message like "\"_m\":\"request\""
| parse @message /\"route\":\"(?<route>[^\"]+)\".*\"durationMs\":(?<ms>\d+)/
| stats count() as requests, avg(ms) as avg_ms by bin(1h) as hour
| sort hour desc
```
