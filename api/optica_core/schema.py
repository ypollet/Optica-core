"""Check manifests against the schema of their viewer, which builds on the common one.

    python -m optica_core.schema <viewer>/manifest.schema.json <manifest>...

Needs jsonschema (pip install 'optica-core[test]'), the viewers don't use it at run time.
"""

import json
import os
import sys

CORE_SCHEMA = os.path.join(os.path.dirname(__file__), "manifest.schema.json")


def load(path: str) -> dict:
    with open(path) as f:
        return json.load(f)


def validator(viewer_schema: str | None = None):
    """Validator of a viewer schema (`<viewer>/manifest.schema.json`), or of the common part alone."""
    from jsonschema import Draft202012Validator
    from referencing import Registry, Resource

    core = load(CORE_SCHEMA)
    registry = Registry().with_resource(core["$id"], Resource.from_contents(core))
    schema = load(viewer_schema) if viewer_schema else core
    return Draft202012Validator(schema, registry=registry)


def errors(validator, manifest: dict) -> list[str]:
    return [f"{'/'.join(map(str, error.absolute_path)) or '(root)'}: {error.message}"
            for error in sorted(validator.iter_errors(manifest), key=lambda error: list(map(str, error.absolute_path)))]


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    if len(argv) < 2:
        print(__doc__, file=sys.stderr)
        return 2
    check = validator(argv[0])
    failed = False
    for path in argv[1:]:
        found = errors(check, load(path))
        failed = failed or bool(found)
        print(f"{path}: {'valid' if not found else 'INVALID'}")
        for error in found:
            print(f"  {error}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
