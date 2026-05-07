variable "region" {
  description = "AWS region for staging resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "staging"
}

variable "alb_name" {
  type        = string
  description = "Name of the shared ALB used for staging host-based routing"
}

variable "route53_zone_name" {
  type        = string
  description = "Public Route 53 zone name with trailing dot (e.g. example.com.)"
}

variable "ecs_task_role_name" {
  type        = string
  description = "Existing ECS task role; staging stack attaches inline policy"
}

variable "ecs_execution_role_name" {
  type        = string
  description = "Existing ECS execution role; staging stack attaches inline policy"
}

variable "rds_secret_name" {
  type        = string
  description = "RDS-managed master credentials secret name"
  sensitive   = true
}
