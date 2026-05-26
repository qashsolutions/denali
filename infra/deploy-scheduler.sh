#!/bin/bash
# Deploy Denali ECS/RDS auto-scheduler stack
# Run from the infra/ directory: ./deploy-scheduler.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STACK_NAME="denali-scheduler"
TEMPLATE="$SCRIPT_DIR/cfn-scheduler.json"
REGION="us-east-1"

echo "🚀 Deploying $STACK_NAME..."

# Check if stack exists
if aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" &>/dev/null; then
    echo "   Stack exists, updating..."
    aws cloudformation update-stack \
        --stack-name "$STACK_NAME" \
        --template-body "file://$TEMPLATE" \
        --capabilities CAPABILITY_IAM \
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
        --capabilities CAPABILITY_IAM \
        --tags Key=Project,Value=Denali \
        --region "$REGION"

    echo "   Waiting for creation (2-3 min)..."
    aws cloudformation wait stack-create-complete \
        --stack-name "$STACK_NAME" \
        --region "$REGION"
fi

echo ""
echo "✅ Stack deployed. Outputs:"
aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[*].[OutputKey,OutputValue]" \
    --output table

echo ""
echo "📋 EventBridge rules:"
for rule in denali-shutdown-nightly denali-startup-daily denali-safety-stop-cron; do
    schedule=$(aws events describe-rule --name "$rule" --region "$REGION" --query "ScheduleExpression" --output text 2>/dev/null || echo "NOT FOUND")
    printf "   %-30s %s\n" "$rule" "$schedule"
done

echo ""
echo "🧹 Cleanup (if needed): aws cloudformation delete-stack --stack-name $STACK_NAME --region $REGION"
