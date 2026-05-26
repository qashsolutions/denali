locals {
  common_tags = {
    Environment = var.environment
    ManagedBy   = "Terraform"
    Project     = "denali"
    CreatedBy   = "denali-pass1"
  }
}
