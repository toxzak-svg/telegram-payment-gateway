#!/bin/bash

# Copilot Setup Workflow Validation Script
# This script validates that the Copilot setup workflow is properly configured

echo "🔍 Validating Copilot Setup Configuration..."
echo "================================================"

# Check workflow file exists
if [ -f ".github/workflows/copilot-setup-steps.yml" ]; then
    echo "✅ Workflow file exists: .github/workflows/copilot-setup-steps.yml"
else
    echo "❌ Workflow file not found!"
    exit 1
fi

# Check job name
if grep -q "copilot-setup-steps:" .github/workflows/copilot-setup-steps.yml; then
    echo "✅ Job name is correct: copilot-setup-steps"
else
    echo "❌ Job name must be 'copilot-setup-steps'"
    exit 1
fi

# Check for key setup steps
key_steps=("Checkout code" "Set up Node.js" "Install dependencies")
for step in "${key_steps[@]}"; do
    if grep -q "$step" .github/workflows/copilot-setup-steps.yml; then
        echo "✅ Step found: $step"
    else
        echo "⚠️  Recommended step missing: $step"
    fi
done

# Check copilot instructions exists
if [ -f ".github/copilot-instructions.md" ]; then
    lines=$(wc -l < .github/copilot-instructions.md)
    echo "✅ Copilot instructions file exists: $lines lines"
    if [ $lines -gt 1000 ]; then
        echo "⚠️  Warning: File is over 1000 lines (recommended max)"
    fi
else
    echo "⚠️  No copilot-instructions.md found (optional but recommended)"
fi

# Check documentation exists
if [ -f "docs/COPILOT_SETUP.md" ]; then
    echo "✅ Copilot setup documentation exists"
else
    echo "⚠️  No Copilot setup documentation found"
fi

# Validate YAML syntax
echo ""
echo "Validating YAML syntax..."
if command -v python3 &> /dev/null; then
    if python3 -c "import yaml; yaml.safe_load(open('.github/workflows/copilot-setup-steps.yml'))" 2>/dev/null; then
        echo "✅ YAML syntax is valid"
    else
        echo "❌ YAML syntax error detected!"
        exit 1
    fi
elif command -v npx &> /dev/null; then
    # Fallback to js-yaml if Python not available
    if npx js-yaml .github/workflows/copilot-setup-steps.yml > /dev/null 2>&1; then
        echo "✅ YAML syntax is valid"
    else
        echo "❌ YAML syntax error detected!"
        exit 1
    fi
else
    echo "⚠️  Cannot validate YAML (neither Python nor js-yaml available)"
fi

echo ""
echo "================================================"
echo "✅ Copilot setup validation complete!"
echo ""
echo "Next steps:"
echo "1. Commit and push the workflow to your default branch"
echo "2. Assign an issue to Copilot or prompt it with a task"
echo "3. Copilot will use this setup for its environment"
echo ""
echo "Documentation: docs/COPILOT_SETUP.md"
