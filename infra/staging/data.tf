# data.tf — read-only references to existing AWS resources.
# NOT managed by this stack. Dependencies for resources in other .tf files.

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Shared ALB — owned outside this stack (prod + staging share it)
data "aws_lb" "shared" {
  name = var.alb_name
}

# HTTPS:443 listener on shared ALB — staging adds host-based rules
data "aws_lb_listener" "https" {
  load_balancer_arn = data.aws_lb.shared.arn
  port              = 443
}

# VPC the ALB lives in — for target group placement
data "aws_vpc" "main" {
  id = data.aws_lb.shared.vpc_id
}

# Public hosted zone (name supplied via var.route53_zone_name)
data "aws_route53_zone" "denali" {
  name         = var.route53_zone_name
  private_zone = false
}

# ECS task role — staging stack will add inline policy (denali-staging-runtime)
data "aws_iam_role" "ecs_task" {
  name = var.ecs_task_role_name
}

# ECS execution role — staging stack will add inline policy (denali-staging-secrets-access)
data "aws_iam_role" "ecs_execution" {
  name = var.ecs_execution_role_name
}

# RDS-managed DB secret — value rotated by RDS, never managed here
data "aws_secretsmanager_secret" "rds_managed" {
  name = var.rds_secret_name
}
