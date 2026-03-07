#!/bin/bash
# Deploy Denali email alerts scheduler stack
# Run from the infra/ directory: ./deploy-alerts-scheduler.sh
#
# Requires ALERT_PROCESS_SECRET to be set (or prompts for it).
# Add ALERT_PROCESS_SECRET to denali/prod/app in Secrets Manager.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STACK_NAME="denali-alerts-scheduler"
TEMPLATE="$SCRIPT_DIR/cfn-alerts-scheduler.json"
REGION="us-east-1"
APP_URL="${APP_URL:-https://denali.health}"

# Get or prompt for secret
if [ -z "${ALERT_PROCESS_SECRET:-}" ]; then
    read -rsp "Enter ALERT_PROCESS_SECRET: " ALERT_PROCESS_SECRET
    echo
fi

echo "Deploying $STACK_NAME..."

PARAMS="ParameterKey=AlertProcessSecret,ParameterValue=$ALERT_PROCESS_SECRET ParameterKey=AppUrl,ParameterValue=$APP_URL"

# Check if stack exists
if aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" &>/dev/null; then
    echo "   Stack exists, updating..."
    aws cloudformation update-stack \
        --stack-name "$STACK_NAME" \
        --template-body "file://$TEMPLATE" \
        --parameters $PARAMS \
        --capabilities CAPABILITY_NAMED_IAM \
        --tags Key=Project,Value=Denali \
        --region "$REGION" 2>&1 || echo "   (No updates needed)"

    echo "   Waiting for update..."
    aws cloudformation wait stack-update-complete \
        --stack-name "$STACK_NAME" \
        --region "$REGION" 2>/dev/null || true
else
    echo "   Creating new stack..."
    aws cloudformation create-stack \
        --stack-name "$STACK_NAME" \
        --template-body "file://$TEMPLATE" \
        --parameters $PARAMS \
        --capabilities CAPABILITY_NAMED_IAM \
        --tags Key=Project,Value=Denali \
        --region "$REGION"

    echo "   Waiting for creation (2-3 min)..."
    aws cloudformation wait stack-create-complete \
        --stack-name "$STACK_NAME" \
        --region "$REGION"
fi

echo ""
echo "Stack deployed. Outputs:"
aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[*].[OutputKey,OutputValue]" \
    --output table

echo ""
echo "EventBridge rule:"
schedule=$(aws events describe-rule --name "denali-daily-alerts" --region "$REGION" --query "ScheduleExpression" --output text 2>/dev/null || echo "NOT FOUND")
printf "   %-30s %s\n" "denali-daily-alerts" "$schedule"

echo ""
echo "Remember: Add ALERT_PROCESS_SECRET to denali/prod/app in Secrets Manager"
echo "Cleanup: aws cloudformation delete-stack --stack-name $STACK_NAME --region $REGION"
