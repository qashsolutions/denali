"""RDS rotation collision recovery.

EventBridge fires this Lambda on Secrets Manager `RotationSucceeded` for the
RDS-managed staging secret. We respond with `ecs:UpdateService
--force-new-deployment` so the ECS task picks up the freshly-rotated password
without manual intervention.

Manual recovery cost (~30 min) is documented in docs/runbook.md; this Lambda
collapses that to ~90-120s.
"""

import json
import logging

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

ecs = boto3.client("ecs")

CLUSTER = "denali-staging"
SERVICE = "denali-staging-web"


def lambda_handler(event, context):
    # Dump the raw event so the first real fire confirms the filter-pattern
    # detail-type ("AWS Service Event via CloudTrail" vs alternatives). Cheap
    # insurance; the rule is narrow enough that volume stays low.
    logger.info("event=%s", json.dumps(event))

    secret_id = (
        event.get("detail", {})
        .get("additionalEventData", {})
        .get("SecretId")
    )
    logger.info("Rotation succeeded for SecretId=%s; forcing new deployment", secret_id)

    response = ecs.update_service(
        cluster=CLUSTER,
        service=SERVICE,
        forceNewDeployment=True,
    )
    deployment_id = response["service"]["deployments"][0]["id"]
    logger.info("Force-new-deployment dispatched: deploymentId=%s", deployment_id)

    return {"statusCode": 200, "deploymentId": deployment_id}
