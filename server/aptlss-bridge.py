#!/usr/bin/env python3
"""
APTLSS Generator Bridge
Connects the Node.js dashboard to the Python APTLSS generator
"""

import sys
import json
import os
from pathlib import Path

# Add the APTLSS system path
APTLSS_PATH = Path(__file__).parent.parent.parent
sys.path.insert(0, str(APTLSS_PATH))

try:
    from api_multi_model_aptlss_generator import APTLSSGenerator
    from aptlss_validator import APTLSSValidator
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "APTLSS modules not found. Please ensure Python scripts are in parent directory."
    }))
    sys.exit(1)


def generate_aptlss(card_data: dict, settings: dict) -> dict:
    """
    Generate APTLSS for a single card.
    
    Args:
        card_data: Trello card data
        settings: Generation settings
        
    Returns:
        Result dictionary with success status and data
    """
    try:
        # Initialize generator
        generator = APTLSSGenerator()
        
        # Generate APTLSS
        result = generator.generate_aptlss(card_data)
        
        # Validate if requested
        if settings.get('validateBeforeGenerate', True):
            validator = APTLSSValidator()
            validation_result = validator.validate(result)
            
            if validation_result.get('sas_score', 0) < 95:
                return {
                    "success": False,
                    "error": f"Validation failed: SAS score {validation_result.get('sas_score')}",
                    "validation": validation_result
                }
        
        return {
            "success": True,
            "aptlss": result,
            "cardId": card_data.get('id'),
            "checklistId": result.get('checklist_id')
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "cardId": card_data.get('id')
        }


def main():
    """Main entry point for the bridge script."""
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "No input provided"
        }))
        sys.exit(1)
    
    try:
        # Parse input JSON
        input_data = json.loads(sys.argv[1])
        
        card_data = input_data.get('cardData')
        settings = input_data.get('settings', {})
        
        if not card_data:
            print(json.dumps({
                "success": False,
                "error": "No card data provided"
            }))
            sys.exit(1)
        
        # Generate APTLSS
        result = generate_aptlss(card_data, settings)
        
        # Output result as JSON
        print(json.dumps(result))
        
    except json.JSONDecodeError as e:
        print(json.dumps({
            "success": False,
            "error": f"Invalid JSON input: {str(e)}"
        }))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": f"Unexpected error: {str(e)}"
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()
