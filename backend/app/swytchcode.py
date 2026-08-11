import json
import subprocess
from datetime import datetime, timezone


class SwytchcodeError(Exception):
    def __init__(self, message: str, category: str = "internal", retryable: bool = False):
        super().__init__(message)
        self.message = message
        self.category = category
        self.retryable = retryable


_trace: list[dict] = []
_TRACE_LIMIT = 100


def get_trace() -> list[dict]:
    return list(reversed(_trace))


def exec_tool(canonical_id: str, args: dict) -> dict:
    try:
        result = _exec_tool(canonical_id, args)
        _trace.append(
            {"timestamp": datetime.now(timezone.utc).isoformat(), "canonical_id": canonical_id, "status": "ok"}
        )
        if len(_trace) > _TRACE_LIMIT:
            del _trace[: len(_trace) - _TRACE_LIMIT]
        return result
    except SwytchcodeError as e:
        _trace.append(
            {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "canonical_id": canonical_id,
                "status": "error",
                "detail": e.message,
            }
        )
        if len(_trace) > _TRACE_LIMIT:
            del _trace[: len(_trace) - _TRACE_LIMIT]
        raise


def _exec_tool(canonical_id: str, args: dict) -> dict:
    payload = json.dumps({"tool": canonical_id, "args": args})
    result = subprocess.run(
        ["swytchcode", "exec", "--json"],
        input=payload,
        capture_output=True,
        text=True,
        timeout=30,
    )

    if result.returncode == 0:
        try:
            envelope = json.loads(result.stdout)
        except json.JSONDecodeError as e:
            raise SwytchcodeError(f"response was not valid JSON: {e}", category="internal", retryable=False)
        status_code = envelope.get("status_code")
        data = envelope.get("data", envelope)

        if status_code is not None and status_code >= 400:
            message = data.get("error", data) if isinstance(data, dict) else data
            category = "auth" if status_code in (401, 403) else "network"
            raise SwytchcodeError(f"upstream {status_code}: {message}", category=category, retryable=status_code >= 500)

        if envelope.get("truncated") and isinstance(data, str):
            raise SwytchcodeError("response too large and was truncated", category="internal", retryable=False)

        if isinstance(data, str):
            stripped = data.strip()
            # Upstream sometimes returns a plain auth error string instead of JSON.
            lower = stripped.lower()
            if "authenticated" in lower or "unauthorized" in lower or "forbidden" in lower:
                raise SwytchcodeError(stripped, category="auth", retryable=False)
            try:
                data = json.loads(stripped)
            except json.JSONDecodeError:
                raise SwytchcodeError(
                    f"response is not valid JSON: {stripped[:240]}",
                    category="auth" if "auth" in lower else "internal",
                    retryable=False,
                )

        if not isinstance(data, dict):
            raise SwytchcodeError(
                f"unexpected response shape: expected object, got {type(data).__name__}",
                category="internal",
                retryable=False,
            )
        return data

    for line in result.stderr.splitlines():
        line = line.strip()
        if line.startswith("{"):
            try:
                err = json.loads(line)
                raise SwytchcodeError(
                    err.get("error", "unknown error"),
                    category=err.get("category", "internal"),
                    retryable=bool(err.get("retryable", False)),
                )
            except json.JSONDecodeError:
                continue

    raise SwytchcodeError(result.stderr.strip() or "swytchcode exec failed with no error detail")
