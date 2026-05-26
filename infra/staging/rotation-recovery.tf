# rotation-recovery.tf — A2: auto-recover from RDS rotation collisions.
#
# When the RDS-managed secret rotates (every 7 days), the existing ECS task
# keeps using the old password until restart. This causes a multi-hour outage
# until manually intervened. EventBridge catches the `RotationSucceeded` event
# and invokes a Lambda that issues `ecs:UpdateService --force-new-deployment`,
# rolling the task with the fresh credential automatically (~90-120s).
#
# See docs/runbook.md "RDS rotation collision recovery" for the manual fallback
# this replaces. Backlog A2 / investigation report 2026-05-10.

# 1. Package the Python source into a zip Terraform can upload.
data "archive_file" "rotation_recovery" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/rotation_recovery"
  output_path = "${path.module}/.terraform/rotation_recovery.zip"
}

# 2. Lambda execution role — dedicated, not piggybacking on the shared
#    scheduler role. Keeps the rotation-recovery automation fully described in
#    this Terraform stack instead of split between IaC and prior out-of-band
#    bootstrapping.
resource "aws_iam_role" "rotation_recovery" {
  name = "denali-staging-rotation-recovery-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

# 3. Inline policy — least privilege:
#    - ECS: force-deploy + describe scoped to the staging web service only.
#    - Logs: scoped to this Lambda's log group only.
resource "aws_iam_role_policy" "rotation_recovery" {
  name = "denali-staging-rotation-recovery-permissions"
  role = aws_iam_role.rotation_recovery.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "StagingECSForceDeploy"
        Effect = "Allow"
        Action = [
          "ecs:UpdateService",
          "ecs:DescribeServices",
        ]
        Resource = "arn:aws:ecs:us-east-1:236823123138:service/denali-staging/denali-staging-web"
      },
      {
        Sid    = "Logs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = "arn:aws:logs:us-east-1:236823123138:log-group:/aws/lambda/denali-staging-rotation-recovery:*"
      },
    ]
  })
}

# 4. Log group — pre-create so retention is configured before the Lambda's
#    first invocation auto-creates one with default (never-expire) retention.
resource "aws_cloudwatch_log_group" "rotation_recovery" {
  name              = "/aws/lambda/denali-staging-rotation-recovery"
  retention_in_days = 30
}

# 5. The Lambda function itself. Matches the runtime pattern of
#    denali-staging-startup / denali-staging-shutdown (python3.12, 128 MB).
resource "aws_lambda_function" "rotation_recovery" {
  function_name = "denali-staging-rotation-recovery"
  role          = aws_iam_role.rotation_recovery.arn
  runtime       = "python3.12"
  handler       = "index.lambda_handler"
  memory_size   = 128
  timeout       = 60

  filename         = data.archive_file.rotation_recovery.output_path
  source_code_hash = data.archive_file.rotation_recovery.output_base64sha256

  depends_on = [aws_cloudwatch_log_group.rotation_recovery]
}

# 6. EventBridge rule — fires on Secrets Manager RotationSucceeded for our
#    specific staging RDS secret (filters out prod's secret + any other
#    rotations in the account).
resource "aws_cloudwatch_event_rule" "rotation_succeeded" {
  name        = "denali-staging-rotation-succeeded"
  description = "Forces ECS redeploy on staging RDS secret rotation (A2)."

  event_pattern = jsonencode({
    source        = ["aws.secretsmanager"]
    "detail-type" = ["AWS Service Event via CloudTrail", "AWS API Call via CloudTrail"]
    detail = {
      eventName = ["RotationSucceeded"]
      additionalEventData = {
        SecretId = [data.aws_secretsmanager_secret.rds_managed.arn]
      }
    }
  })
}

# 7. Wire the rule to the Lambda.
resource "aws_cloudwatch_event_target" "rotation_recovery" {
  rule      = aws_cloudwatch_event_rule.rotation_succeeded.name
  target_id = "RotationRecoveryLambda"
  arn       = aws_lambda_function.rotation_recovery.arn
}

# 8. Grant EventBridge permission to invoke the Lambda.
resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.rotation_recovery.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.rotation_succeeded.arn
}
