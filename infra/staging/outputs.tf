# Outputs added as resources are imported in subsequent turns.

output "rotation_recovery_lambda_arn" {
  description = "ARN of the RDS rotation recovery Lambda (A2)."
  value       = aws_lambda_function.rotation_recovery.arn
}

output "rotation_recovery_event_rule_arn" {
  description = "ARN of the EventBridge rule that triggers rotation recovery."
  value       = aws_cloudwatch_event_rule.rotation_succeeded.arn
}
