# ──────────────────────────────────────────────────────
# Denali AWS aliases — paste into ~/.zshrc then: source ~/.zshrc
# ──────────────────────────────────────────────────────

denali-up() {
  local REGION="us-east-1"
  local DB="denali-prod"
  local CLUSTER="denali"
  local SERVICE="denali-web"

  echo "🔄 Starting RDS $DB..."
  local status=$(aws rds describe-db-instances --db-instance-identifier "$DB" --region "$REGION" \
    --query "DBInstances[0].DBInstanceStatus" --output text)

  if [[ "$status" == "stopped" ]]; then
    aws rds start-db-instance --db-instance-identifier "$DB" --region "$REGION" > /dev/null
    echo "   RDS start initiated. Polling..."
    while true; do
      status=$(aws rds describe-db-instances --db-instance-identifier "$DB" --region "$REGION" \
        --query "DBInstances[0].DBInstanceStatus" --output text)
      if [[ "$status" == "available" ]]; then
        echo "   ✅ RDS available"
        break
      fi
      echo "   ⏳ RDS status: $status (waiting 15s...)"
      sleep 15
    done
  elif [[ "$status" == "available" ]]; then
    echo "   ✅ RDS already available"
  else
    echo "   ⚠️  RDS status: $status (waiting for it to settle...)"
    aws rds wait db-instance-available --db-instance-identifier "$DB" --region "$REGION"
    echo "   ✅ RDS available"
  fi

  echo "🔄 Scaling ECS $SERVICE to 1..."
  aws ecs update-service --cluster "$CLUSTER" --service "$SERVICE" --desired-count 1 --region "$REGION" > /dev/null
  echo "   ✅ ECS desired=1"
  echo ""
  denali-status
}

denali-down() {
  local REGION="us-east-1"
  local DB="denali-prod"
  local CLUSTER="denali"
  local SERVICE="denali-web"

  echo "🔄 Scaling ECS $SERVICE to 0..."
  aws ecs update-service --cluster "$CLUSTER" --service "$SERVICE" --desired-count 0 --region "$REGION" > /dev/null

  echo "   Waiting for tasks to drain..."
  while true; do
    local running=$(aws ecs describe-services --cluster "$CLUSTER" --services "$SERVICE" --region "$REGION" \
      --query "services[0].runningCount" --output text)
    if [[ "$running" == "0" ]]; then
      echo "   ✅ ECS drained (0 tasks)"
      break
    fi
    echo "   ⏳ $running task(s) still running (waiting 10s...)"
    sleep 10
  done

  echo "🔄 Stopping RDS $DB..."
  local status=$(aws rds describe-db-instances --db-instance-identifier "$DB" --region "$REGION" \
    --query "DBInstances[0].DBInstanceStatus" --output text)

  if [[ "$status" == "available" ]]; then
    aws rds stop-db-instance --db-instance-identifier "$DB" --region "$REGION" > /dev/null
    echo "   ✅ RDS stop initiated"
  elif [[ "$status" == "stopped" ]]; then
    echo "   ✅ RDS already stopped"
  else
    echo "   ⚠️  RDS status: $status — skipping stop"
  fi

  echo ""
  echo "💤 Denali is down. Run 'denali-up' to restart."
}

denali-status() {
  local REGION="us-east-1"
  local DB="denali-prod"
  local CLUSTER="denali"
  local SERVICE="denali-web"

  echo "┌─────────────────────────────────────┐"
  echo "│        DENALI INFRA STATUS          │"
  echo "├─────────────────────────────────────┤"

  # RDS
  local rds_status=$(aws rds describe-db-instances --db-instance-identifier "$DB" --region "$REGION" \
    --query "DBInstances[0].DBInstanceStatus" --output text 2>/dev/null || echo "ERROR")
  local rds_icon="❌"
  [[ "$rds_status" == "available" ]] && rds_icon="✅"
  [[ "$rds_status" == "starting" ]] && rds_icon="⏳"
  [[ "$rds_status" == "stopping" ]] && rds_icon="⏳"
  printf "│ %s RDS %-8s  %-19s│\n" "$rds_icon" "$DB" "$rds_status"

  # ECS
  local ecs_info=$(aws ecs describe-services --cluster "$CLUSTER" --services "$SERVICE" --region "$REGION" \
    --query "services[0].[desiredCount,runningCount]" --output text 2>/dev/null || echo "0 0")
  local desired=$(echo "$ecs_info" | awk '{print $1}')
  local running=$(echo "$ecs_info" | awk '{print $2}')
  local ecs_icon="❌"
  [[ "$running" -gt 0 ]] && ecs_icon="✅"
  [[ "$desired" -gt 0 && "$running" == "0" ]] && ecs_icon="⏳"
  printf "│ %s ECS %-8s  desired=%s running=%s │\n" "$ecs_icon" "$SERVICE" "$desired" "$running"

  # ALB target health
  local tg_arn=$(aws elbv2 describe-target-groups --load-balancer-arn \
    $(aws elbv2 describe-load-balancers --names denali-alb --region "$REGION" \
      --query "LoadBalancers[0].LoadBalancerArn" --output text 2>/dev/null) \
    --region "$REGION" --query "TargetGroups[0].TargetGroupArn" --output text 2>/dev/null || echo "")

  if [[ -n "$tg_arn" && "$tg_arn" != "None" ]]; then
    local health=$(aws elbv2 describe-target-health --target-group-arn "$tg_arn" --region "$REGION" \
      --query "TargetHealthDescriptions[0].TargetHealth.State" --output text 2>/dev/null || echo "unknown")
    local alb_icon="❌"
    [[ "$health" == "healthy" ]] && alb_icon="✅"
    [[ "$health" == "initial" ]] && alb_icon="⏳"
    printf "│ %s ALB %-8s  target: %-12s │\n" "$alb_icon" "denali-alb" "$health"
  else
    printf "│ ⚠️  ALB %-8s  no target group      │\n" "denali-alb"
  fi

  echo "└─────────────────────────────────────┘"
}
