#!/bin/bash

# Test: Pattern verification mechanism works correctly
# Tests the run_pattern_verification() function with different scenarios

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_DIR=$(mktemp -d)
trap "rm -rf $TEST_DIR" EXIT

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS_COUNT=0
FAIL_COUNT=0

pass() {
  echo -e "${GREEN}PASS${NC}: $1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
  echo -e "${RED}FAIL${NC}: $1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

info() {
  echo -e "${YELLOW}INFO${NC}: $1"
}

# =============================================================================
# Source the pattern verification function from sprint-loop.sh
# We need to extract just that function for testing
# =============================================================================

# Create a test harness that sources just what we need
cat > "$TEST_DIR/test-harness.sh" <<'HARNESS'
#!/bin/bash

# Minimal dependencies for run_pattern_verification
set -euo pipefail

# The run_pattern_verification function from sprint-loop.sh
run_pattern_verification() {
  local pattern_file="$1"
  local pattern_name="$2"

  # Extract verify array from frontmatter using yq
  local verify_yaml
  verify_yaml=$(sed -n '/^---$/,/^---$/p' "$pattern_file" | head -n -1 | tail -n +2)

  # Check if verify section exists
  if ! echo "$verify_yaml" | yq -e '.verify' > /dev/null 2>&1; then
    echo '{"verified": true, "checks": [], "message": "No verification commands defined"}'
    return 0
  fi

  local checks_json="[]"
  local all_required_passed=true
  local total_checks=0
  local passed_checks=0

  # Iterate over each verification command
  local num_verifications
  num_verifications=$(echo "$verify_yaml" | yq '.verify | length')

  for ((i=0; i<num_verifications; i++)); do
    local verify_id verify_type verify_cmd verify_expect verify_desc verify_required
    verify_id=$(echo "$verify_yaml" | yq -r ".verify[$i].id // \"check-$i\"")
    verify_type=$(echo "$verify_yaml" | yq -r ".verify[$i].type // \"bash\"")
    verify_cmd=$(echo "$verify_yaml" | yq -r ".verify[$i].command // \"\"")
    verify_expect=$(echo "$verify_yaml" | yq -r ".verify[$i].expect // \"exit-code-0\"")
    verify_desc=$(echo "$verify_yaml" | yq -r ".verify[$i].description // \"\"")
    verify_required=$(echo "$verify_yaml" | yq -r ".verify[$i].required")
    [[ "$verify_required" == "null" || -z "$verify_required" ]] && verify_required="true"

    if [[ -z "$verify_cmd" ]]; then
      continue
    fi

    total_checks=$((total_checks + 1))

    # Execute the verification command
    local cmd_output
    local cmd_exit_code=0
    cmd_output=$(eval "$verify_cmd" 2>&1) || cmd_exit_code=$?

    # Evaluate expectation
    local check_passed=false
    case "$verify_expect" in
      exit-code-0)
        [[ $cmd_exit_code -eq 0 ]] && check_passed=true
        ;;
      empty)
        [[ -z "$cmd_output" ]] && check_passed=true
        ;;
      non-empty)
        [[ -n "$cmd_output" ]] && check_passed=true
        ;;
      contains-ok-or-empty)
        [[ -z "$cmd_output" || "$cmd_output" == "OK" ]] && check_passed=true
        ;;
      *)
        [[ $cmd_exit_code -eq 0 ]] && check_passed=true
        ;;
    esac

    if $check_passed; then
      passed_checks=$((passed_checks + 1))
    else
      if [[ "$verify_required" == "true" ]]; then
        all_required_passed=false
      fi
    fi

    # Build check result JSON
    local escaped_output
    escaped_output=$(printf '%s' "$cmd_output" | head -c 500 | jq -Rs '.')
    checks_json=$(echo "$checks_json" | jq \
      --arg id "$verify_id" \
      --arg desc "$verify_desc" \
      --argjson passed "$check_passed" \
      --argjson required "$(echo "$verify_required" | jq -R 'if . == "true" then true else false end')" \
      --argjson output "$escaped_output" \
      '. += [{"id": $id, "description": $desc, "passed": $passed, "required": $required, "output": $output}]')
  done

  # Build final result
  local result_json
  if $all_required_passed; then
    result_json=$(jq -n \
      --argjson verified true \
      --argjson checks "$checks_json" \
      --arg message "$passed_checks/$total_checks checks passed" \
      '{"verified": $verified, "checks": $checks, "message": $message}')
    echo "$result_json"
    return 0
  else
    result_json=$(jq -n \
      --argjson verified false \
      --argjson checks "$checks_json" \
      --arg message "Required verification(s) failed" \
      '{"verified": $verified, "checks": $checks, "message": $message}')
    echo "$result_json"
    return 1
  fi
}

# Export for use in test cases
export -f run_pattern_verification
HARNESS

chmod +x "$TEST_DIR/test-harness.sh"

# =============================================================================
# Test 1: Pattern with no verify section (should pass)
# =============================================================================
info "Test 1: Pattern with no verify section"

cat > "$TEST_DIR/no-verify.md" <<'PATTERN'
---
name: no-verify-test
description: A pattern without verification
---

# Test Pattern
This pattern has no verification commands.
PATTERN

source "$TEST_DIR/test-harness.sh"
RESULT=$(run_pattern_verification "$TEST_DIR/no-verify.md" "no-verify-test" 2>/dev/null)
VERIFIED=$(echo "$RESULT" | jq -r '.verified')

if [[ "$VERIFIED" == "true" ]]; then
  pass "Pattern with no verify section returns verified=true"
else
  fail "Pattern with no verify section should return verified=true, got $VERIFIED"
fi

# =============================================================================
# Test 2: Pattern where all required checks pass
# =============================================================================
info "Test 2: All required checks pass"

cat > "$TEST_DIR/all-pass.md" <<'PATTERN'
---
name: all-pass-test
description: A pattern where all checks pass
verify:
  - id: always-true
    type: bash
    command: "true"
    expect: exit-code-0
    description: A command that always succeeds
    required: true
  - id: empty-check
    type: bash
    command: "echo -n ''"
    expect: empty
    description: A command with empty output
    required: true
---

# Pattern content
PATTERN

source "$TEST_DIR/test-harness.sh"
RESULT=$(run_pattern_verification "$TEST_DIR/all-pass.md" "all-pass-test" 2>/dev/null)
VERIFIED=$(echo "$RESULT" | jq -r '.verified')
CHECKS_PASSED=$(echo "$RESULT" | jq '[.checks[] | select(.passed == true)] | length')

if [[ "$VERIFIED" == "true" ]] && [[ "$CHECKS_PASSED" == "2" ]]; then
  pass "All required checks pass: verified=true with 2 checks passed"
else
  fail "Expected verified=true with 2 checks passed, got verified=$VERIFIED checks=$CHECKS_PASSED"
fi

# =============================================================================
# Test 3: Pattern where a required check fails
# =============================================================================
info "Test 3: Required check fails"

cat > "$TEST_DIR/required-fail.md" <<'PATTERN'
---
name: required-fail-test
description: A pattern where a required check fails
verify:
  - id: always-fail
    type: bash
    command: "false"
    expect: exit-code-0
    description: A command that always fails
    required: true
---

# Pattern content
PATTERN

source "$TEST_DIR/test-harness.sh"
RESULT=$(run_pattern_verification "$TEST_DIR/required-fail.md" "required-fail-test" 2>/dev/null) || EXIT_CODE=$?
EXIT_CODE=${EXIT_CODE:-0}
VERIFIED=$(echo "$RESULT" | jq -r '.verified')

if [[ "$VERIFIED" == "false" ]] && [[ "$EXIT_CODE" != "0" ]]; then
  pass "Required check fails: verified=false with non-zero exit"
else
  fail "Expected verified=false with non-zero exit, got verified=$VERIFIED exit=$EXIT_CODE"
fi

# =============================================================================
# Test 4: Optional check fails but required passes
# =============================================================================
info "Test 4: Optional check fails, required passes"

cat > "$TEST_DIR/optional-fail.md" <<'PATTERN'
---
name: optional-fail-test
description: A pattern where optional check fails
verify:
  - id: required-pass
    type: bash
    command: "true"
    expect: exit-code-0
    description: A required check that passes
    required: true
  - id: optional-fail
    type: bash
    command: "false"
    expect: exit-code-0
    description: An optional check that fails
    required: false
---

# Pattern content
PATTERN

source "$TEST_DIR/test-harness.sh"
RESULT=$(run_pattern_verification "$TEST_DIR/optional-fail.md" "optional-fail-test" 2>/dev/null)
VERIFIED=$(echo "$RESULT" | jq -r '.verified')
REQUIRED_PASSED=$(echo "$RESULT" | jq '[.checks[] | select(.required == true and .passed == true)] | length')
OPTIONAL_FAILED=$(echo "$RESULT" | jq '[.checks[] | select(.required == false and .passed == false)] | length')

if [[ "$VERIFIED" == "true" ]] && [[ "$REQUIRED_PASSED" == "1" ]] && [[ "$OPTIONAL_FAILED" == "1" ]]; then
  pass "Optional fail doesn't block verification: verified=true"
else
  fail "Expected verified=true with 1 required pass and 1 optional fail"
fi

# =============================================================================
# Test 5: Test 'non-empty' expectation
# =============================================================================
info "Test 5: Non-empty expectation"

cat > "$TEST_DIR/non-empty.md" <<'PATTERN'
---
name: non-empty-test
description: A pattern testing non-empty expectation
verify:
  - id: has-output
    type: bash
    command: "echo 'some output'"
    expect: non-empty
    description: Should have some output
    required: true
  - id: no-output
    type: bash
    command: "echo -n ''"
    expect: non-empty
    description: Should fail - no output
    required: false
---

# Pattern content
PATTERN

source "$TEST_DIR/test-harness.sh"
RESULT=$(run_pattern_verification "$TEST_DIR/non-empty.md" "non-empty-test" 2>/dev/null)
FIRST_CHECK=$(echo "$RESULT" | jq '.checks[0].passed')
SECOND_CHECK=$(echo "$RESULT" | jq '.checks[1].passed')

if [[ "$FIRST_CHECK" == "true" ]] && [[ "$SECOND_CHECK" == "false" ]]; then
  pass "Non-empty expectation works correctly"
else
  fail "Expected first=true second=false, got first=$FIRST_CHECK second=$SECOND_CHECK"
fi

# =============================================================================
# Test 6: Test 'empty' expectation
# =============================================================================
info "Test 6: Empty expectation"

cat > "$TEST_DIR/empty.md" <<'PATTERN'
---
name: empty-test
description: A pattern testing empty expectation
verify:
  - id: is-empty
    type: bash
    command: "echo -n ''"
    expect: empty
    description: Should be empty
    required: true
  - id: not-empty
    type: bash
    command: "echo 'output'"
    expect: empty
    description: Should fail - has output
    required: false
---

# Pattern content
PATTERN

source "$TEST_DIR/test-harness.sh"
RESULT=$(run_pattern_verification "$TEST_DIR/empty.md" "empty-test" 2>/dev/null)
FIRST_CHECK=$(echo "$RESULT" | jq '.checks[0].passed')
SECOND_CHECK=$(echo "$RESULT" | jq '.checks[1].passed')

if [[ "$FIRST_CHECK" == "true" ]] && [[ "$SECOND_CHECK" == "false" ]]; then
  pass "Empty expectation works correctly"
else
  fail "Expected first=true second=false, got first=$FIRST_CHECK second=$SECOND_CHECK"
fi

# =============================================================================
# Test 7: Real-world pattern (implement-feature verification commands)
# =============================================================================
info "Test 7: Real-world implement-feature pattern verification"

# Create a mock git repo to test against
MOCK_REPO="$TEST_DIR/mock-repo"
mkdir -p "$MOCK_REPO"
cd "$MOCK_REPO"
git init --quiet
git config user.email "test@test.com"
git config user.name "Test"
echo "test" > file.txt
git add .
git commit -m "Initial commit" --quiet

# Now test the implement-feature pattern's verification commands
# We need working tree clean and tests passing

cat > "$TEST_DIR/implement-feature.md" <<'PATTERN'
---
name: implement-feature
verify:
  - id: tests-pass
    type: bash
    command: "true"
    expect: exit-code-0
    description: Tests pass (mocked)
    required: true
  - id: code-committed
    type: bash
    command: "git status --porcelain"
    expect: empty
    description: All changes must be committed
    required: true
---

# Pattern content
PATTERN

source "$TEST_DIR/test-harness.sh"
RESULT=$(run_pattern_verification "$TEST_DIR/implement-feature.md" "implement-feature" 2>/dev/null)
VERIFIED=$(echo "$RESULT" | jq -r '.verified')

if [[ "$VERIFIED" == "true" ]]; then
  pass "Real-world pattern verification passes in clean git repo"
else
  fail "Expected verified=true in clean git repo, got $VERIFIED"
fi

# Now make the repo dirty
echo "dirty" >> "$MOCK_REPO/file.txt"

RESULT=$(run_pattern_verification "$TEST_DIR/implement-feature.md" "implement-feature" 2>/dev/null) || true
VERIFIED=$(echo "$RESULT" | jq -r '.verified')
CODE_COMMITTED=$(echo "$RESULT" | jq '.checks[] | select(.id == "code-committed") | .passed')

if [[ "$VERIFIED" == "false" ]] && [[ "$CODE_COMMITTED" == "false" ]]; then
  pass "Real-world pattern verification fails in dirty git repo"
else
  fail "Expected verified=false with code-committed=false in dirty repo"
fi

cd - > /dev/null

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "============================================"
echo "Test Summary: $PASS_COUNT passed, $FAIL_COUNT failed"
echo "============================================"

if [[ $FAIL_COUNT -gt 0 ]]; then
  exit 1
fi

exit 0
