import boto3, os, json
from datetime import datetime, timedelta, timezone

ecs = boto3.client('ecs')
rds = boto3.client('rds')
elbv2 = boto3.client('elbv2')
ce = boto3.client('ce')
sns = boto3.client('sns')
cw = boto3.client('cloudwatch')

def handler(event, context):
    alerts = []
    status_lines = []
    now = datetime.now(timezone.utc)
    ct_hour = (now - timedelta(hours=6)).strftime('%I:%M %p CT')

    # --- ECS ---
    try:
        r = ecs.describe_services(cluster=os.environ['ECS_CLUSTER'], services=[os.environ['ECS_SERVICE']])
        svc = r['services'][0]
        desired = svc['desiredCount']
        running = svc['runningCount']
        if desired != running:
            alerts.append(f'ECS: desired={desired} but running={running}')
            status_lines.append(f'\u26a0\ufe0f ECS: desired={desired} running={running}')
        else:
            status_lines.append(f'\u2705 ECS: desired={desired} running={running}')
    except Exception as e:
        alerts.append(f'ECS check failed: {e}')
        status_lines.append(f'\u274c ECS: check failed')

    # --- RDS ---
    try:
        r = rds.describe_db_instances(DBInstanceIdentifier=os.environ['RDS_INSTANCE'])
        db = r['DBInstances'][0]
        db_status = db['DBInstanceStatus']
        db_public = db.get('PubliclyAccessible', False)
        if db_public:
            alerts.append('RDS: PubliclyAccessible is TRUE')
        # Unexpected states
        expected = ['available', 'stopped', 'starting', 'stopping']
        if db_status not in expected:
            alerts.append(f'RDS: unexpected status "{db_status}"')
            status_lines.append(f'\u26a0\ufe0f RDS: {db_status}')
        else:
            status_lines.append(f'\u2705 RDS: {db_status}')
    except Exception as e:
        alerts.append(f'RDS check failed: {e}')
        status_lines.append(f'\u274c RDS: check failed')

    # --- ALB Target Health ---
    try:
        tgs = elbv2.describe_target_groups(Names=[os.environ['ALB_TG_NAME']])
        tg_arn = tgs['TargetGroups'][0]['TargetGroupArn']
        health = elbv2.describe_target_health(TargetGroupArn=tg_arn)
        targets = health['TargetHealthDescriptions']
        healthy = sum(1 for t in targets if t['TargetHealth']['State'] == 'healthy')
        total = len(targets)
        if total == 0:
            status_lines.append(f'\u23f8\ufe0f ALB: no targets (infra likely stopped)')
        elif healthy < total:
            alerts.append(f'ALB: {healthy}/{total} healthy')
            status_lines.append(f'\u26a0\ufe0f ALB: {healthy}/{total} healthy')
        else:
            status_lines.append(f'\u2705 ALB: {healthy}/{total} healthy')
    except Exception as e:
        status_lines.append(f'\u2705 ALB: target check skipped')

    # --- Costs (MTD + yesterday + forecast) ---
    try:
        today = now.strftime('%Y-%m-%d')
        first = now.strftime('%Y-%m-01')
        yesterday = (now - timedelta(days=1)).strftime('%Y-%m-%d')
        day_before = (now - timedelta(days=2)).strftime('%Y-%m-%d')

        # MTD
        mtd = ce.get_cost_and_usage(
            TimePeriod={'Start': first, 'End': today},
            Granularity='MONTHLY',
            Metrics=['BlendedCost']
        )
        mtd_cost = float(mtd['ResultsByTime'][0]['Total']['BlendedCost']['Amount'])

        # Yesterday
        daily = ce.get_cost_and_usage(
            TimePeriod={'Start': day_before, 'End': yesterday},
            Granularity='DAILY',
            Metrics=['BlendedCost']
        )
        yest_cost = float(daily['ResultsByTime'][0]['Total']['BlendedCost']['Amount'])

        # Forecast
        try:
            last_day = (now.replace(month=now.month % 12 + 1, day=1) - timedelta(days=1)).strftime('%Y-%m-%d')
            fc = ce.get_cost_forecast(
                TimePeriod={'Start': today, 'End': last_day},
                Metric='BLENDED_COST',
                Granularity='MONTHLY'
            )
            forecast = float(fc['Total']['Amount'])
            forecast_line = f'${forecast:.2f}'
        except Exception:
            forecast = None
            forecast_line = 'N/A (not enough data)'

        status_lines.append(f'\U0001f4b0 Costs: MTD ${mtd_cost:.2f} | Yesterday ${yest_cost:.2f} | Forecast {forecast_line}')

        # Alert if daily cost > $3 (unexpected for pre-launch)
        if yest_cost > 3.0:
            alerts.append(f'Cost spike: yesterday ${yest_cost:.2f} (threshold $3.00)')
        if forecast and forecast > 60:
            alerts.append(f'Forecast ${forecast:.2f} exceeds $60/mo budget')

    except Exception as e:
        status_lines.append(f'\U0001f4b0 Costs: check failed ({e})')

    # --- Build message ---
    if alerts:
        subject = f'\u26a0\ufe0f Denali Alert — {len(alerts)} issue(s)'
        header = f'DENALI INFRA ALERT — {ct_hour}\n{"=" * 35}\n'
        alert_block = '\n'.join(f'  \u26a0\ufe0f {a}' for a in alerts)
        body = header + '\nISSUES:\n' + alert_block + '\n\nSTATUS:\n' + '\n'.join(f'  {s}' for s in status_lines)
    else:
        subject = f'\u2705 Denali OK — {ct_hour}'
        body = f'DENALI STATUS — {ct_hour}\n{"=" * 35}\n\n' + '\n'.join(f'  {s}' for s in status_lines)

    body += '\n\n---\ndenali.health infra monitor'

    # --- Send ---
    sns.publish(
        TopicArn=os.environ['SNS_TOPIC_ARN'],
        Subject=subject[:100],
        Message=body
    )

    print(f'Sent: {subject}')
    print(body)
    return {'statusCode': 200, 'alerts': len(alerts)}