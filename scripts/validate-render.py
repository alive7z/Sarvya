"""Validate render.yaml against an explicitly supplied official Render schema.
Requires PyYAML and jsonschema; install them in a temporary virtual environment.
"""
import json
import pathlib
import sys
import yaml
import jsonschema

root = pathlib.Path(__file__).resolve().parent.parent
schema = json.loads(pathlib.Path(sys.argv[1]).read_text())
configuration = yaml.safe_load((root / 'render.yaml').read_text())
jsonschema.validators.validator_for(schema)(schema).validate(configuration)
print('Render Blueprint matches the official JSON schema.')
