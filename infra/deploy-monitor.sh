#!/bin/bash
# Deploy Denali infra monitor stack (SNS + Lambda + EventBridge)
# Sends health + cost digest twice daily via SMS + email

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STACK_NAME="denali-monitor"
TEMPLATE="$SCRIPT_DIR/cfn-monitor.json"
REGION="us-east-1"

echo "🚀 Deploying $STACK_NAME..."

if aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" &>/dev/null; then
    echo "   Stack exists, updating..."
    aws cloudformation update-stack \
        --stack-name "$STACK_NAME" \
        --template-body "file://$TEMPLATE" \
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
        --capabilities CAPABILITY_NAMED_IAM \
        --tags Key=Project,Value=Denali \
        --region "$REGION"

    echo "   Waiting for creation (1-2 min)..."
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
echo "📋 Schedule:"
echo "   Morning: 8:00 AM CT daily"
echo "   Evening: 8:00 PM CT daily"
echo ""
echo "📧 Subscribers:"
echo "   SMS:   +1 (469) 203-9202"
echo "   Email: ramanac@gmail.com"
echo "   Email: admin@denali.health"
echo ""
echo "⚠️  IMPORTANT: Check your email inboxes and CONFIRM the SNS subscriptions!"
echo "   Both ramanac@gmail.com and admin@denali.health will receive confirmation emails."
echo "   SMS is auto-confirmed."
echo ""
echo "🧪 Test now: aws lambda invoke --function-name denali-monitor --region $REGION /tmp/monitor-out.json && cat /tmp/monitor-out.json"
echo ""
echo "🧹 Cleanup: aws cloudformation delete-stack --stack-name $STACK_NAME --region $REGION"
